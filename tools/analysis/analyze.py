"""Publish reproducible, sensitivity-labeled results from verified GCOV caches."""
import argparse
import hashlib
import json
from datetime import datetime, timezone

import numpy as np

import config
import render
import stats
from extract import resolve_site

K_SIGMA = 2.5
K_SWEEP = (2.0, 2.5, 3.0)
ALGORITHM_VERSION = "3.0.0"


def config_hash(site):
    return hashlib.sha256(json.dumps(site, sort_keys=True, default=str).encode()).hexdigest()[:16]


def epoch_bounds(dates):
    size = max(1, min(3, len(dates) // 2))
    return dates[:size], dates[-size:]


def analyze_site(site):
    site_dir = config.cache_dir(site)
    wanted = sorted(set(site["dates"]))
    missing = [day for day in wanted if not (site_dir / f"{day}.npz").exists()]
    if missing:
        raise ValueError(f"{site['id']}: incomplete requested series; missing verified dates: {', '.join(missing)}")
    if len(wanted) < 2:
        raise ValueError("at least two distinct verified dates are required")
    loaded = {day: stats.load_date(site_dir, day) for day in wanted}
    first_entry = loaded[wanted[0]]
    meta0 = first_entry[3]
    for day, entry in loaded.items():
        meta = entry[3]
        if (entry[0].shape != first_entry[0].shape or meta["grid_signature"] != meta0["grid_signature"]
                or meta["epsg"] != meta0["epsg"] or not np.array_equal(meta["transform"], meta0["transform"])
                or not np.array_equal(meta["roi_mask"], meta0["roi_mask"])
                or not np.allclose(meta["pixel_area_m2"], meta0["pixel_area_m2"], rtol=0, atol=1e-6)):
            raise ValueError(f"{day}: source grid/measurement footprint differs")
        if (meta["product"] != site["product"] or meta["polarization"] != site["polarization_label"]
                or not np.array_equal(meta["roi"], site["roi"]) or not meta["acquired_at"].startswith(day)):
            raise ValueError(f"{day}: cached product, polarization, bbox or date differs from the request")
        fields = meta["granule"].split("_")
        if len(fields) < 14 or tuple(fields[i] for i in (5, 6, 7, 8, 9, 13)) != tuple(
                meta0["granule"].split("_")[i] for i in (5, 6, 7, 8, 9, 13)):
            raise ValueError(f"{day}: acquisition mode or processing baseline differs")
        if meta["processing"] != meta0["processing"]:
            raise ValueError(f"{day}: source corrections differ within the series")

    spacing, pixel_area, roi_mask = meta0["spacing_m"], meta0["pixel_area_m2"], meta0["roi_mask"]
    common = np.logical_and.reduce([entry[1] for entry in loaded.values()]) & roi_mask
    if not common.any():
        raise ValueError("no valid common footprint across the requested dates")
    # Every epoch and time-series point uses the same ground, not each date's coverage.
    entries = {day: (entry[0], common, entry[2]) for day, entry in loaded.items()}
    first_dates, last_dates = epoch_bounds(wanted)
    first = stats.composite([entries[day] for day in first_dates])
    last = stats.composite([entries[day] for day in last_dates])
    delta, changed, threshold, sigma = stats.change(*first, *last, K_SIGMA)
    retained = np.zeros_like(common)
    components, sweep = [], {}
    for k in K_SWEEP:
        _, screened, _, _ = stats.change(*first, *last, k)
        mask = np.zeros_like(common)
        for sign, kind in ((1, "brighter"), (-1, "darker")):
            selected = screened & (delta * sign > 0)
            mask |= stats.cluster_mask(selected, spacing, pixel_area_m2=pixel_area)
            if k == K_SIGMA:
                components.extend({**component, "kind": kind} for component in
                                  stats.clusters(selected, spacing, pixel_area_m2=pixel_area))
        sweep[str(k)] = stats.mask_area_km2(mask, spacing, pixel_area)
        if k == K_SIGMA:
            retained = mask

    parameters = {"k_sigma": K_SIGMA, "k_sweep": K_SWEEP, "min_cluster_m2": stats.MIN_CLUSTER_M2,
                  "water_threshold_offsets_db": [-1, 0, 1], "epoch_size": len(first_dates),
                  "independent_look_gain_assumed": False, "area_basis": "WGS84 ellipsoidal local equal-area cells"}
    identity = config_hash({"site": site, "algorithm": ALGORITHM_VERSION, "parameters": parameters,
                            "inputs": [loaded[day][3]["request_hash"] for day in wanted]})
    claims = []
    coastal = site["phenomenon"] == "coastal-water-change"
    water = {day: stats.water_extent(entries[day], spacing, pixel_area_m2=pixel_area) for day in wanted} if coastal else {}
    first_water = stats.water_extent(first, spacing, pixel_area_m2=pixel_area) if coastal else None
    last_water = stats.water_extent(last, spacing, pixel_area_m2=pixel_area) if coastal else None
    if coastal:
        claims.append({"id": "water_extent_change", "label": "Water-candidate area change", "unit": "km2",
                       "value": round(last_water["area_km2"] - first_water["area_km2"], 3),
                       "method": "Otsu dark-water candidates and morphological filtering on fixed median epochs.",
                       "sensitivity": {"low": round(last_water["low_km2"] - first_water["high_km2"], 3),
                                       "high": round(last_water["high_km2"] - first_water["low_km2"], 3),
                                       "basis": "Each epoch threshold varied independently by +/-1 dB; not a confidence interval."}})
    claims.extend([
        {"id": "retained_brightness_change_area", "label": "Area retained by the brightness screen", "unit": "km2",
         "value": sweep[str(K_SIGMA)], "method": "Same-sign connected components at least 5,000 m2 after a local conditional noise screen. Zero retained area is not proof of no change.",
         "sensitivity": {"low": min(sweep.values()), "high": max(sweep.values()),
                         "basis": "k varied from 2 to 3 under a conditional log-Gamma model; not calibrated significance."}},
        {"id": "median_backscatter_change", "label": "Median brightness change", "value": round(float(np.median(delta[common])), 3),
         "unit": "dB", "method": "Pixel-wise last-minus-first median epoch difference on the common valid footprint."},
    ])
    public_dir = config.PUBLIC / site["id"]
    raster_dir = public_dir / "rasters"
    raster_dir.mkdir(parents=True, exist_ok=True)
    delta_name, water_name = f"{identity}-delta.webp", f"{identity}-water.webp"
    coordinates = render.delta_image(delta, retained, raster_dir / delta_name, meta0["transform"], meta0["epsg"])
    if coastal and coordinates:
        render.water_image(first_water["mask"], last_water["mask"], raster_dir / water_name, meta0["transform"], meta0["epsg"])
    processing = json.loads(meta0["processing"])
    fields = meta0["granule"].split("_")
    area = stats.mask_area_km2(common, spacing, pixel_area)
    manifest = {
        "schema_version": ALGORITHM_VERSION, "id": f"{site['id']}-{identity}", "status": "exploratory_derived",
        "site": site["id"], "label": site["label"], "module": site["module"], "phenomenon": site["phenomenon"],
        "generated_at": datetime.now(timezone.utc).isoformat(), "bbox": list(site["roi"]),
        "product": site["product"], "polarization": site["polarization_label"],
        "source_maturity": {"nisar-gcov": "validated", "nisar-gcov-beta": "beta", "nisar-gcov-provisional": "provisional"}[site["product"]],
        "window": dict(zip(("start", "end"), site["date_window"])),
        "grid": {"width": int(first_entry[0].shape[1]), "height": int(first_entry[0].shape[0]), "spacing_m": spacing,
                 "epsg": int(meta0["epsg"]), "transform": meta0["transform"].tolist(), "corners": meta0["corners"].tolist(),
                 "signature": meta0["grid_signature"], "area_basis": parameters["area_basis"]},
        "dates": [{"date": day, **{key: loaded[day][3][key] for key in
                  ("acquired_at", "granule", "source_url", "valid_fraction", "mean_looks", "native_quality_fraction")}}
                  for day in wanted],
        "time_series": [{"date": day, "mean_db": round(float(np.mean(entries[day][0][common])), 3),
                         "valid_area_km2": area, **({"water_km2": water[day]["area_km2"], "water_low_km2": water[day]["low_km2"],
                                                    "water_high_km2": water[day]["high_km2"]} if coastal else {})} for day in wanted],
        "epochs": {"first": {"dates": first_dates, "water": {k: v for k, v in first_water.items() if k != "mask"} if coastal else None},
                   "last": {"dates": last_dates, "water": {k: v for k, v in last_water.items() if k != "mask"} if coastal else None}},
        "claims": claims,
        "change": {"k": K_SIGMA, "median_conditional_threshold_db": round(threshold, 3),
                   "median_conditional_sigma_db": round(sigma, 3), "retained_component_count": len(components),
                   "retained_components": sorted(components, key=lambda item: -item["area_km2"])[:12],
                   "sweep_area_km2": sweep, "common_valid_area_km2": area,
                   "common_valid_fraction": round(float(pixel_area[common].sum() / pixel_area[roi_mask].sum()), 6),
                   "screen_model": "Conditional log-Gamma from native numberOfLooks; effective independence after geocoding is unknown."},
        "validation": {"status": "unchecked", "checked_at": None, "references": [], "maturity": None},
        "provenance": {"algorithm_version": ALGORITHM_VERSION, "config_hash": identity, "collection": site["collection"],
                       "series": dict(zip(("relative_orbit", "direction", "frame", "mode", "polarization_token", "baseline"),
                                          [fields[i] for i in (5, 6, 7, 8, 9, 13)])),
                       "parameters": parameters, "source_processing": processing,
                       "measurement_quantization_db": 0.01, "geometry_checked_dates": len(wanted),
                       "citations": ["https://nisar-docs.asf.alaska.edu/gcov/", "https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html"]},
        "limitations": [
            "Source-product maturity and EarthEyes result validation are different. These results remain exploratory.",
            f"Source noiseCorrectionApplied={processing.get('noiseCorrectionApplied', 'unknown')}; thermal-noise and shadow residuals are not estimated here.",
            "numberOfLooks is not verified effective independent looks after geocoding. No extra precision is assumed from spatial or temporal averaging.",
            "Threshold sweeps are sensitivity ranges, not confidence intervals; cluster filtering is not a detection limit.",
            "Water candidates can include other dark surfaces. Dates, tides and clouds can disagree across sensors; agreement is not ground truth.",
            "Brightness cannot establish water depth, tide stage, ice velocity, cause, or a public warning.",
        ],
        "raster": {"format": "webp-rgba", "coordinates": coordinates,
                   "delta_url": f"/analysis/{site['id']}/rasters/{delta_name}",
                   "water_change_url": f"/analysis/{site['id']}/rasters/{water_name}" if coastal else None,
                   "placement": "Nearest-neighbor display reprojection to Web Mercator; all measurements use the native grid."} if coordinates else None,
    }
    path = public_dir / "manifest.json"
    if path.exists():
        previous = json.loads(path.read_text(encoding="utf-8"))
        if previous.get("id") == manifest["id"]:
            manifest["validation"] = previous["validation"]
    path.write_text(json.dumps(manifest, indent=2, allow_nan=False), encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site")
    parser.add_argument("--bbox")
    parser.add_argument("--start")
    parser.add_argument("--end")
    parser.add_argument("--product", default="nisar-gcov-provisional", choices=sorted(config.COLLECTIONS))
    parser.add_argument("--label")
    parser.add_argument("--phenomenon")
    parser.add_argument("--read-px", type=int)
    parser.add_argument("--target-px", type=int)
    manifest = analyze_site(resolve_site(parser.parse_args()))
    print(json.dumps({"id": manifest["id"], "claims": manifest["claims"], "common_valid_fraction": manifest["change"]["common_valid_fraction"]}, indent=2))


if __name__ == "__main__":
    main()
