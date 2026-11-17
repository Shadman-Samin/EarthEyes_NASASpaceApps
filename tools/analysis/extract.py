"""Bounded GCOV extraction with verified grids, masks and source radiometry."""
import argparse
import concurrent.futures as futures
import hashlib
import json

import numpy as np
from rasterio.crs import CRS
from rasterio.warp import transform, transform_bounds

import cmr
import config
import discover
import projection
from remote import GRID, open_remote

INVALID = -32768
DB_SCALE = 100.0
CACHE_VERSION = 3
LOOKUP_SIZE = 33
PARAMETERS = "/science/LSAR/GCOV/metadata/processingInformation/parameters/"


def window_indices(values, low, high):
    (indices,) = np.where((values >= low) & (values <= high))
    if not indices.size:
        raise ValueError("requested bbox is outside the source grid")
    return int(indices.min()), int(indices.max()) + 1


def centered_window(low, high, size):
    if high - low > size:
        raise ValueError(f"requested grid window is {high - low} pixels; limit is {size}; use a smaller bbox")
    return low, high


def read_grid(handle):
    x = np.asarray(handle[f"{GRID}/xCoordinates"][:], dtype=np.float64)
    y = np.asarray(handle[f"{GRID}/yCoordinates"][:], dtype=np.float64)
    epsg = int(handle[f"{GRID}/projection"].attrs.get("epsg_code", 0))
    for axis in (x, y):
        if axis.size < 2 or not np.isfinite(axis).all() or not np.allclose(np.diff(axis), axis[1] - axis[0], rtol=0, atol=1e-6):
            raise ValueError("source grid must be finite and regularly spaced")
    if x[1] <= x[0] or y[1] >= y[0] or not CRS.from_epsg(epsg).is_projected:
        raise ValueError("source grid must be projected and north-up")
    return x, y, epsg


def grid_signature(x, y, epsg):
    digest = hashlib.sha256(str(epsg).encode())
    for values in (x, y):
        digest.update(str(values.shape).encode())
        digest.update(np.asarray(values, dtype="<f8").tobytes())
    return digest.hexdigest()


def valid_samples(power, mask, exceptions, polarization=None):
    valid = np.isfinite(power) & (power > 0) & (mask > 0) & (mask != 255)
    if exceptions.dtype == np.uint16:
        bits = {"HH": 256, "HV": 512, "VH": 1024, "VV": 2048, "LH": 4096, "LV": 8192, "RH": 16384, "RV": 32768}
        if polarization not in bits:
            raise ValueError("uint16 exception masks require a known polarization")
        return valid & ((exceptions & 255) == 0) & ((exceptions & bits[polarization]) != 0)
    if exceptions.dtype != np.uint8:
        raise ValueError("unrecognized input exception mask encoding")
    return valid & (exceptions == 0)


def compute_window(site, x, y, epsg):
    bounds = transform_bounds("EPSG:4326", CRS.from_epsg(epsg), *site["roi"], densify_pts=21)
    if not np.isfinite(bounds).all():
        raise ValueError("bbox cannot be transformed to the source grid")
    dx, dy = abs(float(x[1] - x[0])), abs(float(y[1] - y[0]))
    if bounds[0] < x.min() - dx / 2 or bounds[2] > x.max() + dx / 2 or bounds[1] < y.min() - dy / 2 or bounds[3] > y.max() + dy / 2:
        raise ValueError("requested bbox is not fully covered by the source grid")
    i0, i1 = window_indices(x, bounds[0], bounds[2])
    j0, j1 = window_indices(y, bounds[1], bounds[3])
    factor = max(1, int(np.ceil(max(i1 - i0, j1 - j0) / site["target_px"])))
    i1 = i0 + int(np.ceil((i1 - i0) / factor)) * factor
    j1 = j0 + int(np.ceil((j1 - j0) / factor)) * factor
    centered_window(i0, i1, site["read_px"])
    centered_window(j0, j1, site["read_px"])
    if i1 > x.size or j1 > y.size:
        raise ValueError("complete output blocks exceed the source grid")
    return i0, i1, j0, j1, factor


def grid_geometry(site, x, y, epsg, window):
    i0, i1, j0, j1, factor = window
    dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
    width, height = (i1 - i0) // factor, (j1 - j0) // factor
    left, top = float(x[i0]) - dx / 2, float(y[j0]) - dy / 2
    affine = np.array([dx * factor, 0, left, 0, dy * factor, top])
    crs = CRS.from_epsg(epsg)
    xs = left + np.arange(width + 1) * dx * factor
    ys = top + np.arange(height + 1) * dy * factor
    cx, cy = np.meshgrid((xs[:-1] + xs[1:]) / 2, (ys[:-1] + ys[1:]) / 2)
    lon, lat = transform(crs, "EPSG:4326", cx.ravel(), cy.ravel())
    lon, lat = np.array(lon).reshape(cx.shape), np.array(lat).reshape(cy.shape)
    west, south, east, north = site["roi"]
    in_lon = (lon >= west) & (lon <= east) if west < east else (lon >= west) | (lon <= east)
    roi_mask = in_lon & (lat >= south) & (lat <= north)
    if not roi_mask.any():
        raise ValueError("bbox contains no output pixel centers")

    # Local ellipsoidal equal-area projection avoids UTM/polar scale bias in totals.
    center_lon, center_lat = float(lon[height // 2, width // 2]), float(lat[height // 2, width // 2])
    equal_area = CRS.from_string(f"+proj=laea +lat_0={center_lat} +lon_0={center_lon} +datum=WGS84 +units=m +no_defs")
    gx, gy = np.meshgrid(xs, ys)
    ax, ay = transform(crs, equal_area, gx.ravel(), gy.ravel())
    ax, ay = np.array(ax).reshape(gx.shape), np.array(ay).reshape(gy.shape)
    bx, by = ax[:-1, 1:] - ax[:-1, :-1], ay[:-1, 1:] - ay[:-1, :-1]
    cx, cy = ax[1:, 1:] - ax[:-1, :-1], ay[1:, 1:] - ay[:-1, :-1]
    dxs, dys = ax[1:, :-1] - ax[:-1, :-1], ay[1:, :-1] - ay[:-1, :-1]
    area = np.abs(bx * cy - by * cx + cx * dys - cy * dxs) / 2
    if not np.isfinite(area).all() or np.any(area <= 0):
        raise ValueError("invalid equal-area cell geometry")
    corner_lon, corner_lat = transform(crs, "EPSG:4326", [xs[0], xs[-1], xs[-1], xs[0]], [ys[0], ys[0], ys[-1], ys[-1]])
    ux, uy = np.meshgrid(np.linspace(xs[0] + affine[0] / 2, xs[-1] - affine[0] / 2, LOOKUP_SIZE),
                         np.linspace(ys[0] + affine[4] / 2, ys[-1] - affine[4] / 2, LOOKUP_SIZE))
    ulon, ulat = transform(crs, "EPSG:4326", ux.ravel(), uy.ravel())
    return {"transform": affine, "roi_mask": roi_mask, "pixel_area_m2": area,
            "corners": np.column_stack((corner_lon, corner_lat)),
            "lookup": np.column_stack((ulon, ulat)).reshape(LOOKUP_SIZE, LOOKUP_SIZE, 2)}


def save_grid(site_dir, x, y, epsg, window=None):
    np.savez(site_dir / "grid.npz", x=x, y=y, epsg=epsg, signature=np.array(grid_signature(x, y, epsg)), window=window)


def load_grid(site_dir):
    path = site_dir / "grid.npz"
    if not path.exists():
        return None
    with np.load(path) as data:
        x, y, epsg = data["x"], data["y"], int(data["epsg"])
    return x, y, epsg, grid_signature(x, y, epsg)


def block_reduce(values, valid, factor):
    """Average linear samples only when every native sample in the block is valid."""
    height, width = values.shape
    if height % factor or width % factor:
        raise ValueError("incomplete averaging blocks")
    shape = (height // factor, factor, width // factor, factor)
    counts = valid.reshape(shape).sum(axis=(1, 3))
    total = np.where(valid, values, 0.0).reshape(shape).sum(axis=(1, 3))
    return np.where(counts == factor * factor, total / (factor * factor), np.nan).astype(np.float32)


def read_processing(handle):
    result = {}
    for name in ("noiseCorrectionApplied", "radiometricTerrainCorrectionApplied", "shadowMaskingApplied",
                 "rtc/outputBackscatterNormalizationConvention", "rtc/outputBackscatterExpressionConvention"):
        path = PARAMETERS + name
        value = handle[path][()] if path in handle else "unknown"
        result[name] = value.decode() if isinstance(value, bytes) else str(value)
    if (result["rtc/outputBackscatterNormalizationConvention"].lower() != "gamma0"
            or result["rtc/outputBackscatterExpressionConvention"].lower() != "linear power"
            or result["radiometricTerrainCorrectionApplied"].lower() != "true"):
        raise ValueError("source metadata does not establish terrain-corrected gamma0 linear power")
    return result


def extract_one(site, granule, site_dir, grid, force=False):
    out_path = site_dir / f"{granule['date']}.npz"
    contract = [CACHE_VERSION, site.get("roi"), site.get("product"), site.get("polarization"), site.get("read_px"), site.get("target_px"), granule.get("title")]
    request_hash = hashlib.sha256(json.dumps(contract).encode()).hexdigest()
    if out_path.exists() and not force:
        with np.load(out_path) as data:
            if (int(data.get("cache_version", 0)) == CACHE_VERSION and bool(data.get("grid_verified", False))
                    and str(data["request_hash"].item()) == request_hash
                    and (grid is None or str(data["signature"].item()) == grid[3])):
                return f"skip verified {granule['date']}"
        raise ValueError("existing cache has a different request; use --force to replace only this requested date")
    handle = open_remote(granule["data_url"])
    try:
        x, y, epsg = read_grid(handle)
        signature = grid_signature(x, y, epsg)
        if grid is not None and signature != grid[3]:
            raise ValueError(f"{granule['date']}: grid does not match the series grid")
        window = compute_window(site, x, y, epsg)
        i0, i1, j0, j1, factor = window
        processing = read_processing(handle)
        mask = np.asarray(handle[f"{GRID}/mask"][j0:j1, i0:i1])
        exceptions = np.asarray(handle[f"{GRID}/inputDataExceptionMask"][j0:j1, i0:i1])
        looks = np.asarray(handle[f"{GRID}/numberOfLooks"][j0:j1, i0:i1], dtype=np.float32)
        quality = valid_samples(np.array(1.), mask, exceptions, site["polarization_label"])
        quality &= np.isfinite(looks) & (looks > 0)
        geometry = grid_geometry(site, x, y, epsg, window)

        encoded = None
        legacy_dir = config.CACHE / site["id"]
        legacy = legacy_dir / f"{granule['date']}.npz"
        if site.get("product", "nisar-gcov-provisional") == "nisar-gcov-provisional" and legacy.exists() and quality.all():
            previous_grid = load_grid(legacy_dir)
            projector = projection.Projector(epsg)
            old_corners = [projector.inverse(float(x[i]), float(y[j])) for i, j in ((i0, j0), (i1 - 1, j0), (i1 - 1, j1 - 1), (i0, j1 - 1))]
            with np.load(legacy) as old:
                if (previous_grid is not None and previous_grid[3] == signature
                        and str(old["granule"].item()) == granule["title"]
                        and str(old["polarization"].item()) == site["polarization_label"]
                        and int(old["factor"]) == factor and tuple(old["read_shape"]) == mask.shape
                        and old["db"].shape == geometry["roi_mask"].shape
                        # With <=255 samples, a missing sample cannot round up to 255.
                        and factor * factor <= 255 and "valid8" in old
                        and old["valid8"].shape == old["db"].shape and np.all(old["valid8"] == 255)
                        and np.all((old["db"] > -8000) & (old["db"] < 32767))
                        and np.allclose(old["corners"], old_corners, rtol=0, atol=1e-7)):
                    encoded = old["db"].copy()
        reused = encoded is not None
        if encoded is None:
            power = np.asarray(handle[f"{GRID}/{site['polarization']}"][j0:j1, i0:i1], dtype=np.float32)
            quality &= np.isfinite(power) & (power > 0)
            mean_power = block_reduce(power, quality, factor)
            db = np.full(mean_power.shape, np.nan, dtype=np.float32)
            positive = np.isfinite(mean_power) & (mean_power > 0)
            db[positive] = 10 * np.log10(mean_power[positive])
            encoded = np.full(db.shape, INVALID, dtype=np.int16)
            encoded[positive] = np.clip(np.round(db[positive] * DB_SCALE), -32767, 32767).astype(np.int16)
        mean_looks = block_reduce(looks, quality, factor)
        valid = (encoded != INVALID) & np.isfinite(mean_looks) & geometry["roi_mask"]
        if not valid.any():
            raise ValueError(f"{granule['date']}: no valid output pixels")
        encoded[~valid] = INVALID
        mean_looks[~valid] = np.nan
        temporary = out_path.with_suffix(".partial.npz")
        np.savez_compressed(temporary, db=encoded, valid=valid, looks=mean_looks, **geometry,
                            cache_version=CACHE_VERSION, grid_verified=True, request_hash=request_hash,
                            epsg=epsg, signature=signature, spacing_m=abs(float(x[1] - x[0])) * factor,
                            read_shape=mask.shape, factor=factor, window=window, roi=site["roi"],
                            acquired_at=granule["acquired_at"], granule=granule["title"],
                            source_url=granule["data_url"], polarization=site["polarization_label"],
                            product=site["product"], processing=json.dumps(processing, sort_keys=True),
                            quality_dtype=str(exceptions.dtype), native_quality_fraction=float(quality.mean()),
                            reused_verified_power=reused)
        temporary.replace(out_path)
        return f"ok {granule['date']} {encoded.shape} valid={valid.sum() / geometry['roi_mask'].sum():.3f} reused_power={reused}"
    finally:
        handle.close()


def find_granules(site):
    results = cmr.search(site["collection"], site["roi"], *site["date_window"])
    matches = cmr.match_site(results, site) if site.get("name_pattern") else results
    matches = [item for item in matches if all(item.get(field) == site[key] for field, key in
               (("orbit", "relative_orbit"), ("direction", "direction"), ("frame", "frame")))
               and all(not site.get(key) or site[key] == item.get(key) for key in ("mode", "polarization_token", "baseline"))
               and discover.overlap_fraction(site["roi"], item.get("bbox")) >= 0.999]
    groups = {}
    for item in matches:
        groups.setdefault((item["mode"], item["polarization_token"], item["baseline"]), []).append(item)
    if not groups:
        return {}
    key, selected = max(groups.items(), key=lambda pair: (len({item["date"] for item in pair[1]}), pair[0]))
    site.update(dict(zip(("mode", "polarization_token", "baseline"), key)))
    by_date = {}
    for item in sorted(selected, key=lambda item: item["title"]):
        by_date.setdefault(item["date"], item)
    return by_date


def resolve_site(args):
    product = getattr(args, "product", None) or "nisar-gcov-provisional"
    if args.site:
        site = {**config.SITES[args.site], "id": args.site, "product": product, "collection": config.COLLECTIONS[product]}
        for name in ("read_px", "target_px"):
            if getattr(args, name, None) is not None:
                site[name] = getattr(args, name)
        return site
    if not (args.bbox and args.start and args.end):
        raise ValueError("provide --site, or --bbox with --start and --end")
    return discover.plan(tuple(float(value) for value in args.bbox.split(",")), args.start, args.end,
                         product=product, label=args.label, phenomenon=args.phenomenon,
                         read_px=getattr(args, "read_px", None), target_px=getattr(args, "target_px", None))


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
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--date", action="append", help="restrict extraction; repeat to select several dates")
    parser.add_argument("--force", action="store_true", help="replace only requested v3 dates; preserve old caches")
    args = parser.parse_args()
    site = resolve_site(args)
    site_dir = config.cache_dir(site)
    site_dir.mkdir(parents=True, exist_ok=True)
    by_date = find_granules(site)
    wanted = args.date or (site["dates"] or sorted(by_date))
    missing = [day for day in wanted if day not in by_date]
    if missing or len(wanted) == 0:
        raise ValueError(f"requested source dates unavailable: {missing}")
    (site_dir / "plan.json").write_text(json.dumps(site, indent=2), encoding="utf-8")
    grid = load_grid(site_dir)
    if grid is None:
        handle = open_remote(by_date[wanted[0]]["data_url"])
        try:
            x, y, epsg = read_grid(handle)
        finally:
            handle.close()
        save_grid(site_dir, x, y, epsg, compute_window(site, x, y, epsg))
        grid = load_grid(site_dir)
    print(f"Extracting {len(wanted)} dates into {site_dir.relative_to(config.REPO)}", flush=True)
    with futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as pool:
        pending = [pool.submit(extract_one, site, by_date[day], site_dir, grid, args.force) for day in wanted]
        for task in futures.as_completed(pending):
            print(task.result(), flush=True)


if __name__ == "__main__":
    main()
