"""Noise-aware SAR change statistics shared by analysis and validation."""
from math import erf, sqrt
import warnings

import numpy as np
from scipy import ndimage
from scipy.special import polygamma

DB_SCALE = 100.0
INVALID = -32768
MAX_CLUSTERS = 12
MIN_CLUSTER_M2 = 5000


def sigma_db(looks):
    """Conditional log-Gamma standard deviation, not calibrated measurement error."""
    looks = np.asarray(looks, dtype=np.float64)
    valid = np.isfinite(looks) & (looks > 0)
    return 10 / np.log(10) * np.sqrt(polygamma(1, np.where(valid, looks, np.nan)))


def sigma_difference(looks_a, looks_b):
    return np.sqrt(sigma_db(looks_a) ** 2 + sigma_db(looks_b) ** 2)


def noise_fraction(k):
    """Two-sided fraction of pure-noise pixels that exceed k sigma."""
    return 2.0 * (1.0 - 0.5 * (1.0 + erf(k / sqrt(2.0))))


def decode(array, scale=DB_SCALE):
    return array.astype(np.float32) / scale


def load_date(site_dir, date):
    with np.load(site_dir / f"{date}.npz") as data:
        if int(data.get("cache_version", 0)) != 3 or not bool(data.get("grid_verified", False)):
            raise ValueError(f"{date}: a verified v3 extraction is required")
        encoded, looks = data["db"], data["looks"].astype(np.float32)
        valid = data["valid"] & data["roi_mask"] & (encoded != INVALID) & np.isfinite(looks) & (looks > 0)
        db = np.where(valid, decode(encoded), np.nan)
        looks[~valid] = np.nan
        meta = {key: data[key].item() for key in ("acquired_at", "granule", "source_url", "polarization", "product",
                                                "processing", "quality_dtype", "request_hash")}
        meta.update({key: data[key] for key in ("corners", "lookup", "pixel_area_m2", "roi_mask", "transform", "roi")})
        meta.update(epsg=int(data["epsg"]), spacing_m=float(data["spacing_m"]),
                    valid_fraction=float(valid.sum() / data["roi_mask"].sum()),
                    mean_db=float(np.mean(db[valid])), mean_looks=float(np.mean(looks[valid])),
                    native_quality_fraction=float(data["native_quality_fraction"]),
                    grid_signature=str(data["signature"].item()))
    return db, valid, looks, meta


def composite(entries):
    """Valid-sample median; no assumed independent-look gain from compositing."""
    valid_dates = np.stack([np.isfinite(entry[0]) & entry[1] for entry in entries])
    stack = np.where(valid_dates, np.stack([entry[0] for entry in entries]), np.nan)
    looks = np.where(valid_dates, np.stack([entry[2] for entry in entries]), np.nan)
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message="All-NaN slice encountered", category=RuntimeWarning)
        db = np.nanmedian(stack, axis=0)
        look = np.nanmedian(looks, axis=0)
    valid = valid_dates.sum(axis=0) > len(entries) // 2
    db[~valid] = np.nan
    look[~valid] = np.nan
    return db, valid, look


def otsu_threshold(values, bins=256):
    values = np.asarray(values, dtype=np.float64)
    values = values[np.isfinite(values)]
    if not values.size:
        raise ValueError("no valid samples for a water threshold")
    if values.size < 10:
        return float(values.min())
    lo, hi = float(np.percentile(values, 1)), float(np.percentile(values, 99))
    if hi <= lo:
        return float(values.mean())
    hist, edges = np.histogram(values, bins=bins, range=(lo, hi))
    total = int(hist.sum())
    centers = (edges[:-1] + edges[1:]) / 2
    sum_total = float((hist * centers).sum())
    weight_b = 0
    sum_b = 0.0
    best_t, best_var = float(lo), -1.0
    for index in range(bins):
        weight_b += int(hist[index])
        if weight_b == 0:
            continue
        weight_f = total - weight_b
        if weight_f == 0:
            break
        sum_b += float(hist[index]) * centers[index]
        mean_b = sum_b / weight_b
        mean_f = (sum_total - sum_b) / weight_f
        between = weight_b * weight_f * (mean_b - mean_f) ** 2
        if between > best_var:
            best_var = between
            best_t = centers[index]
    return float(best_t)


def water_mask(db, valid, threshold=None):
    valid = valid & np.isfinite(db)
    values = db[valid]
    limit = otsu_threshold(values) if threshold is None else threshold
    raw = (db < limit) & valid
    mask = ndimage.binary_opening(raw, structure=np.ones((3, 3)), iterations=1)
    mask = ndimage.binary_closing(mask, structure=np.ones((5, 5)), iterations=1)
    return mask & valid, limit


def mask_area_km2(mask, spacing_m, pixel_area_m2=None):
    area = float(mask.sum()) * spacing_m * spacing_m if pixel_area_m2 is None else float(pixel_area_m2[mask].sum())
    return round(area / 1e6, 6)


def cluster_mask(mask, spacing_m, min_area_m2=MIN_CLUSTER_M2, pixel_area_m2=None):
    labeled, _ = ndimage.label(mask, structure=np.ones((3, 3), dtype=int))
    weights = np.full(mask.size, spacing_m * spacing_m) if pixel_area_m2 is None else pixel_area_m2.ravel()
    areas = np.bincount(labeled.ravel(), weights=weights)
    areas[0] = 0
    return areas[labeled] >= min_area_m2


def clusters(mask, spacing_m, min_area_m2=MIN_CLUSTER_M2, pixel_area_m2=None):
    labeled, count = ndimage.label(mask, structure=np.ones((3, 3), dtype=int))
    if count == 0:
        return []
    pixel_area = spacing_m * spacing_m
    found = []
    for index, sl in enumerate(ndimage.find_objects(labeled), start=1):
        if sl is None:
            continue
        pixels = int((labeled[sl] == index).sum())
        area = pixels * pixel_area if pixel_area_m2 is None else float(pixel_area_m2[sl][labeled[sl] == index].sum())
        if area < min_area_m2:
            continue
        ys, xs = sl
        rows, cols = np.nonzero(labeled[sl] == index)
        yc, xc = rows.mean() + ys.start, cols.mean() + xs.start
        found.append({
            "id": index,
            "pixels": pixels,
            "area_km2": round(area / 1e6, 6),
            "centroid_px": [round(float(xc), 1), round(float(yc), 1)],
            "bbox_px": [int(xs.start), int(ys.start), int(xs.stop - 1), int(ys.stop - 1)],
        })
    found.sort(key=lambda cluster: -cluster["area_km2"])
    return found


def change(db_a, valid_a, looks_a, db_b, valid_b, looks_b, k):
    """Screen brightness changes using a local, explicitly conditional noise model."""
    sigma = sigma_difference(looks_a, looks_b)
    common = valid_a & valid_b & np.isfinite(db_a) & np.isfinite(db_b) & np.isfinite(sigma)
    delta = np.full(db_a.shape, np.nan, dtype=np.float32)
    delta[common] = db_b[common] - db_a[common]
    median = float(np.median(sigma[common])) if common.any() else float("nan")
    changed = common & (np.abs(delta) > k * sigma)
    return delta, changed, k * median, median


def lonlat_for_pixel(cluster, meta, width, height):
    lookup = meta["lookup"]
    cx, cy = cluster["centroid_px"]
    u = cx / max(width - 1, 1) * (lookup.shape[1] - 1)
    v = cy / max(height - 1, 1) * (lookup.shape[0] - 1)
    r0, c0 = int(np.floor(v)), int(np.floor(u))
    dr, dc = v - r0, u - c0
    r0 = min(r0, lookup.shape[0] - 2)
    c0 = min(c0, lookup.shape[1] - 2)
    top = lookup[r0, c0] * (1 - dc) + lookup[r0, c0 + 1] * dc
    bottom = lookup[r0 + 1, c0] * (1 - dc) + lookup[r0 + 1, c0 + 1] * dc
    lonlat = top * (1 - dr) + bottom * dr
    return [round(float(lonlat[0]), 5), round(float(lonlat[1]), 5)]


def water_extent(entry, spacing_m, offsets=(-1.0, 0.0, 1.0), pixel_area_m2=None):
    """Water area at the Otsu threshold and at +/- dB offsets (threshold sensitivity)."""
    db, valid = entry[0], entry[1]
    _, limit = water_mask(db, valid)
    areas = []
    for offset in offsets:
        mask, _ = water_mask(db, valid, threshold=limit + offset)
        areas.append(mask_area_km2(mask, spacing_m, pixel_area_m2))
    mask, _ = water_mask(db, valid, threshold=limit)
    return {
        "area_km2": areas[offsets.index(0.0)],
        "low_km2": min(areas),
        "high_km2": max(areas),
        "threshold_db": round(limit, 2),
        "mask": mask,
    }
