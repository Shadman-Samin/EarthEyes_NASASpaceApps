"""Compute change analysis from extracted windows and write public bundles."""
import argparse
import json
import shutil
import time
from datetime import datetime
from pathlib import Path

import numpy as np
from scipy import ndimage

import config

INVALID = -32768
DB_SCALE = 100.0
MAX_CLUSTERS = 12
MIN_CLUSTER_M2 = 5000
WATER_DARK = "dark"


def load_date(site_dir, date):
    data = np.load(site_dir / f"{date}.npz")
    db = data["db"].astype(np.float32) / DB_SCALE
    valid = data["db"] != INVALID
    meta = {
        "acquired_at": data["acquired_at"].item(),
        "granule": data["granule"].item(),
        "source_url": data["source_url"].item(),
        "polarization": data["polarization"].item(),
        "epsg": int(data["epsg"]),
        "spacing_m": float(data["spacing_m"]),
        "corners": data["corners"],
        "lookup": data["lookup"],
        "read_shape": data["read_shape"],
        "factor": int(data["factor"]),
    }
    return db, valid, meta


def otsu_threshold(values, bins=256):
    if values.size < 10:
        return float(values.min()) if values.size else -25.0
    lo, hi = float(np.percentile(values, 1)), float(np.percentile(values, 99))
    if hi <= lo:
        return float(values.mean())
    hist, edges = np.histogram(values, bins=bins, range=(lo, hi))
    total = int(hist.sum())
    centers = (edges[:-1] + edges[1:]) / 2
    sum_total = float((hist * centers).sum())
    w_b = 0
    sum_b = 0.0
    best_t, best_var = float(lo), -1.0
    for t in range(bins):
        w_b += int(hist[t])
        if w_b == 0:
            continue
        w_f = total - w_b
        if w_f == 0:
            break
        sum_b += float(hist[t]) * centers[t]
        mean_b = sum_b / w_b
        mean_f = (sum_total - sum_b) / w_f
        var_between = w_b * w_f * (mean_b - mean_f) ** 2
        if var_between > best_var:
            best_var = var_between
            best_t = centers[t]
    return float(best_t)


def water_mask(db, valid):
    vals = db[valid]
    t = otsu_threshold(vals)
    raw = db < t
    mask = ndimage.binary_opening(raw, structure=np.ones((3, 3)), iterations=1)
    mask = ndimage.binary_closing(mask, structure=np.ones((5, 5)), iterations=1)
    mask = mask & valid
    return mask, t


def label_clusters(mask, spacing_m, min_area_m2=MIN_CLUSTER_M2):
    structure = np.ones((3, 3), dtype=int)
    labeled, count = ndimage.label(mask, structure=structure)
    if count == 0:
        return []
    slices = ndimage.find_objects(labeled)
    pixel_area = spacing_m * spacing_m
    clusters = []
    for i, sl in enumerate(slices, start=1):
        if sl is None:
            continue
        count_px = int((labeled[sl] == i).sum())
        area_m2 = count_px * pixel_area
        if area_m2 < min_area_m2:
            continue
        yc, xc = ndimage.center_of_mass(mask, labeled, index=i)
        yslice, xslice = sl
        clusters.append(
            {
                "id": i,
                "pixels": count_px,
                "area_km2": round(area_m2 / 1e6, 3),
                "centroid_px": [round(float(xc), 1), round(float(yc), 1)],
                "bbox_px": [
                    int(xslice.start),
                    int(yslice.start),
                    int(xslice.stop - 1),
                    int(yslice.stop - 1),
                ],
            }
        )
    clusters.sort(key=lambda c: -c["area_km2"])
    return clusters[:MAX_CLUSTERS]


def lonlat_for_pixel(cluster, meta, width, height):
    lookup = meta["lookup"]
    cx, cy = cluster["centroid_px"]
    u = cx / max(width - 1, 1) * (lookup.shape[1] - 1)
    v = cy / max(height - 1, 1) * (lookup.shape[0] - 1)
    r0, c0 = int(np.floor(v)), int(np.floor(u))
    dr, dc = v - r0, u - c0
    r0 = min(r0, lookup.shape[0] - 2)
    c0 = min(c0, lookup.shape[1] - 2)
    tl = lookup[r0, c0]
    tr = lookup[r0, c0 + 1]
    bl = lookup[r0 + 1, c0]
    br = lookup[r0 + 1, c0 + 1]
    top = tl * (1 - dc) + tr * dc
    bottom = bl * (1 - dc) + br * dc
    lonlat = top * (1 - dr) + bottom * dr
    return [round(float(lonlat[0]), 5), round(float(lonlat[1]), 5)]


def pair_change(db1, valid1, db2, valid2, threshold_db=1.5):
    common = valid1 & valid2
    delta = np.full(db1.shape, np.nan, dtype=np.float32)
    delta[common] = db2[common] - db1[common]
    gain = common & (delta > threshold_db)
    loss = common & (delta < -threshold_db)
    changed = common & (np.abs(delta) > threshold_db)
    return delta, gain, loss, changed, common


def write_raster(path, array_int16):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(array_int16.astype("<i2").tobytes())


def analyze_site(site_id, pairs):
    site = config.SITES[site_id]
    cache_dir = config.CACHE / site_id
    public_dir = config.PUBLIC / site_id
    raster_dir = public_dir / "rasters"
    raster_dir.mkdir(parents=True, exist_ok=True)

    dates = [d for d in site["dates"] if (cache_dir / f"{d}.npz").exists()]
    loaded = {date: load_date(cache_dir, date) for date in dates}
    spacing_m = loaded[dates[0]][2]["spacing_m"]
    db0, valid0, meta0 = loaded[dates[0]]
    height, width = db0.shape

    # copy calibrated rasters
    for date, (db, valid, meta) in loaded.items():
        encoded = np.where(db > -30000, np.clip(np.round(db * DB_SCALE), -32767, 32767), INVALID).astype(np.int16)
        write_raster(raster_dir / f"{date}.db.i16", encoded)

    # per-date water mapping (kuakata)
    water = {}
    if site["phenomenon"] == "coastal-water-change":
        for date in dates:
            db, valid, _ = loaded[date]
            mask, threshold = water_mask(db, valid)
            water[date] = {
                "fraction": round(float(mask.sum()) / max(int(valid.sum()), 1), 4),
                "area_km2": round(float(mask.sum()) * spacing_m * spacing_m / 1e6, 3),
                "threshold_db": round(threshold, 2),
            }

    # pair analysis
    pair_results = {}
    persistent_changed = np.zeros((height, width), dtype=bool)
    for pair in pairs:
        f, t = pair
        if f not in loaded or t not in loaded:
            continue
        db1, valid1, _ = loaded[f]
        db2, valid2, _ = loaded[t]
        delta, gain, loss, changed, common = pair_change(db1, valid1, db2, valid2, threshold_db=1.5)
        persistent_changed |= changed

        gain_clusters = label_clusters(gain, spacing_m)
        loss_clusters = label_clusters(loss, spacing_m)
        for cluster in gain_clusters:
            cluster["kind"] = "gain"
            cluster["centroid_lonlat"] = lonlat_for_pixel(cluster, meta0, width, height)
        for cluster in loss_clusters:
            cluster["kind"] = "loss"
            cluster["centroid_lonlat"] = lonlat_for_pixel(cluster, meta0, width, height)

        delta_enc = np.where(common & np.isfinite(delta), np.clip(np.round(delta * DB_SCALE), -32767, 32767), INVALID).astype(np.int16)
        write_raster(raster_dir / f"{f}--{t}.delta.i16", delta_enc)

        changed_fraction = float(changed.sum()) / max(int(common.sum()), 1)
        changed_area = round(changed_fraction * common.sum() * spacing_m * spacing_m / 1e6, 3)
        pair_story = build_pair_story(site, f, t, water, changed_fraction, changed_area, gain_clusters, loss_clusters, threshold_db=1.5)
        pair_results[f"{f}--{t}"] = {
            "from": f,
            "to": t,
            "threshold_db": 1.5,
            "changed_fraction": round(changed_fraction, 4),
            "changed_area_km2": changed_area,
            "gain_area_km2": round(sum(c["area_km2"] for c in gain_clusters), 3),
            "loss_area_km2": round(sum(c["area_km2"] for c in loss_clusters), 3),
            "clusters": gain_clusters + loss_clusters,
            "delta_url": f"rasters/{f}--{t}.delta.i16",
            "story": pair_story,
        }

    persistent_clusters = label_clusters(persistent_changed, spacing_m)

    # time series
    series = []
    for date in dates:
        db, valid, _ = loaded[date]
        vals = db[valid]
        entry = {"date": date, "mean_db": round(float(vals.mean()), 2)}
        if date in water:
            entry["water_fraction"] = water[date]["fraction"]
        series.append(entry)

    # story
    story = build_story(site_id, dates, loaded, water, pair_results, persistent_clusters, spacing_m)

    manifest = {
        "site": site_id,
        "placeId": site_id,
        "label": site["label"],
        "module": site["module"],
        "phenomenon": site["phenomenon"],
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "algorithm_version": "1.0.0",
        "grid": {
            "width": int(width),
            "height": int(height),
            "spacing_m": float(spacing_m),
            "epsg": int(meta0["epsg"]),
            "corners": [[round(float(a), 5), round(float(b), 5)] for a, b in meta0["corners"]],
        },
        "raster": {
            "format": "int16_le",
            "unit": "dB",
            "scale": 0.01,
            "invalid": INVALID,
            "urls": {date: f"rasters/{date}.db.i16" for date in dates},
        },
        "dates": [
            {
                "date": date,
                "acquired_at": loaded[date][2]["acquired_at"],
                "granule": loaded[date][2]["granule"],
                "source_url": loaded[date][2]["source_url"],
                "polarization": loaded[date][2]["polarization"],
                "valid_fraction": float(np.load(cache_dir / f"{date}.npz")["valid_fraction"]),
                "mean_db": float(np.load(cache_dir / f"{date}.npz")["mean_db"]),
                "p2_db": float(np.load(cache_dir / f"{date}.npz")["p2_db"]),
                "p98_db": float(np.load(cache_dir / f"{date}.npz")["p98_db"]),
            }
            for date in dates
        ],
        "time_series": series,
        "water": water,
        "pairs": pair_results,
        "persistent_clusters": [
            {
                **cluster,
                "kind": "persistent",
                "centroid_lonlat": lonlat_for_pixel(cluster, meta0, width, height),
            }
            for cluster in persistent_clusters
        ],
        "story": story,
        "provenance": {
            "mission": "NISAR",
            "collection": config.COLLECTION_SHORT,
            "product": "L2 GCOV (gamma-0, radiometrically terrain corrected)",
            "polarization": site["polarization_label"],
            "dates": dates,
            "citations": [
                "NASA ISRO NISAR L2 GCOV Provisional, Alaska Satellite Facility (ASF), via CMR",
            ],
        },
        "limitations": [
            "Single-polarization amplitude change; not ground deformation or velocity.",
            "Provisional NISAR calibration; values may shift with reprocessing.",
            "Radar brightness alone cannot confirm water depth, tide stage, or ice thickness.",
            "Not a hazard warning; for situational understanding only.",
        ],
    }
    public_dir.mkdir(parents=True, exist_ok=True)
    (public_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, default=_json_default), encoding="utf-8")
    print(json.dumps(manifest["story"], indent=2, default=_json_default))
    print("pairs:", {k: {kk: vv for kk, vv in v.items() if kk != "clusters"} for k, v in pair_results.items()})
    print("persistent_clusters:", len(persistent_clusters))


def _json_default(o):
    if isinstance(o, np.generic):
        return float(o)
    raise TypeError(f"not serializable: {type(o)}")


def build_pair_story(site, f, t, water, changed_fraction, changed_area, gain_clusters, loss_clusters, threshold_db=1.5):
    """Plain-language summary for one date pair, so the prose matches the selection."""
    pct = changed_fraction * 100
    clusters = gain_clusters + loss_clusters
    n_clusters = len(clusters)
    top = clusters[0] if clusters else None
    top_txt = f" The largest changed cluster covers {top['area_km2']:.1f} km²." if top else ""
    if site["phenomenon"] == "coastal-water-change":
        w_f = water.get(f, {}).get("area_km2", 0)
        w_t = water.get(t, {}).get("area_km2", 0)
        dw = w_t - w_f
        headline = f"Coastal water around {site['label']} changed between {f} and {t}."
        summary = (
            f"Dark (radar-absorbing) water covered about {w_f:.1f} km² on {f} and "
            f"{w_t:.1f} km² on {t} — a {dw:+.1f} km² ({dw / max(w_f, 0.01) * 100:+.0f}%) shift. "
            f"About {changed_area:.1f} km² ({pct:.0f}%) of the analyzed window changed brightness by more than {threshold_db:g} dB between the two dates, "
            f"in {n_clusters} clusters.{top_txt}"
        )
    else:
        headline = f"Ice-surface change near {site['label']} between {f} and {t}."
        summary = (
            f"About {changed_area:.1f} km² ({pct:.0f}%) of the analyzed window changed radar brightness by more than {threshold_db:g} dB between "
            f"{f} and {t}, across {n_clusters} clusters.{top_txt}"
        )
    return {"headline": headline, "summary": summary}


def build_story(site_id, dates, loaded, water, pair_results, persistent_clusters, spacing_m):
    site = config.SITES[site_id]
    first, last = dates[0], dates[-1]
    key = f"{first}--{last}"
    pair = pair_results.get(key, {})
    if site["phenomenon"] == "coastal-water-change":
        w_first = water.get(first, {}).get("area_km2", 0)
        w_last = water.get(last, {}).get("area_km2", 0)
        dw = w_last - w_first
        changed = pair.get("changed_area_km2", 0)
        pct = pair.get("changed_fraction", 0) * 100
        n_clusters = len(pair.get("clusters", []))
        headline = f"Coastal water around {site['label']} between {first} and {last}."
        summary = (
            f"Over the full season, dark (radar-absorbing) water covered about {w_first:.1f} km² on {first} and "
            f"{w_last:.1f} km² on {last} — a {dw:+.1f} km² ({dw / max(w_first, 0.01) * 100:+.0f}%) shift. "
            f"About {changed:.1f} km² ({pct:.0f}%) of the analyzed window changed brightness between the two dates, "
            f"in {n_clusters} clusters."
        )
        detail = (
            "This is derived from calibrated NISAR L-band HV backscatter (gamma-0). Calm water absorbs radar and "
            "appears dark; rougher or vegetated surfaces appear brighter. Brightness change alone cannot tell water "
            "depth, tide stage, or cause, and NISAR is still provisional, so treat this as situational context, not "
            "a flood forecast."
        )
    else:
        changed = pair.get("changed_area_km2", 0)
        pct = pair.get("changed_fraction", 0) * 100
        n_clusters = len(pair.get("clusters", []))
        headline = f"Ice-surface change near {site['label']} across {len(dates)} acquisitions."
        summary = (
            f"Between {first} and {last}, about {changed:.1f} km² ({pct:.0f}%) of the analyzed window changed radar "
            f"brightness in {n_clusters} clusters, with {len(persistent_clusters)} clusters changing persistently "
            "across the season."
        )
        detail = (
            "Derived from calibrated NISAR L-band HH backscatter (gamma-0) on a single ascending orbit track. "
            "Amplitude change indicates surface change, not ice speed or mass loss. Values are provisional."
        )
    return {
        "headline": headline,
        "summary": summary,
        "detail": detail,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    args = parser.parse_args()
    site = config.SITES[args.site]
    dates = site["dates"]
    pairs = [(dates[i], dates[i + 1]) for i in range(len(dates) - 1)] + [(dates[0], dates[-1])]
    analyze_site(args.site, pairs)


if __name__ == "__main__":
    main()
