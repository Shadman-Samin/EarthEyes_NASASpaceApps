"""Extract calibrated dB windows from NISAR GCOV granules into a local cache."""
import argparse
import concurrent.futures as futures
import json
import time
from pathlib import Path

import numpy as np

import cmr
import config
import projection
from remote import GRID, open_remote

INVALID = -32768
DB_SCALE = 100.0
LOOKUP_SIZE = 33


def window_indices(values, low, high):
    (idx,) = np.where((values >= low) & (values <= high))
    if idx.size == 0:
        return None
    return int(idx.min()), int(idx.max()) + 1


def centered_window(low, high, size):
    span = high - low
    if span <= size:
        return low, high
    start = low + (span - size) // 2
    return start, start + size


def read_grid(handle):
    x = np.asarray(handle[f"{GRID}/xCoordinates"][:], dtype=np.float64)
    y = np.asarray(handle[f"{GRID}/yCoordinates"][:], dtype=np.float64)
    epsg = int(handle[f"{GRID}/projection"].attrs.get("epsg_code", 0))
    return x, y, epsg


def save_grid(site_dir, x, y, epsg):
    np.savez(site_dir / "grid.npz", x=x, y=y, epsg=epsg)


def load_grid(site_dir):
    path = site_dir / "grid.npz"
    if not path.exists():
        return None
    data = np.load(path)
    return data["x"], data["y"], int(data["epsg"])


def block_mean(power, valid, factor):
    height = power.shape[0] // factor * factor
    width = power.shape[1] // factor * factor
    power = power[:height, :width]
    valid = valid[:height, :width]
    power = np.where(valid, power, 0.0)
    counts = valid.reshape(height // factor, factor, width // factor, factor).sum(axis=(1, 3))
    total = power.reshape(height // factor, factor, width // factor, factor).sum(axis=(1, 3))
    out = np.full(total.shape, np.nan, dtype=np.float32)
    ok = counts > (factor * factor) / 2
    out[ok] = total[ok] / counts[ok]
    return out


def lookup_grid(x, y, i0, i1, j0, j1, projector):
    xs = np.linspace(x[i0], x[i1 - 1], LOOKUP_SIZE)
    ys = np.linspace(y[j0], y[j1 - 1], LOOKUP_SIZE)
    lookup = np.empty((LOOKUP_SIZE, LOOKUP_SIZE, 2), dtype=np.float32)
    for row, yv in enumerate(ys):
        for col, xv in enumerate(xs):
            lon, lat = projector.inverse(float(xv), float(yv))
            lookup[row, col] = (lon, lat)
    return lookup


def extract_one(site_id, site, granule, site_dir, grid):
    out_path = site_dir / f"{granule['date']}.npz"
    if out_path.exists():
        return f"skip {granule['date']}"
    started = time.time()
    handle = open_remote(granule["data_url"])
    try:
        if grid is None:
            x, y, epsg = read_grid(handle)
            save_grid(site_dir, x, y, epsg)
        else:
            x, y, epsg = grid
        projector = projection.Projector(epsg)
        west, south, east, north = site["roi"]
        pts = [
            projector.forward(west, south),
            projector.forward(east, south),
            projector.forward(west, north),
            projector.forward(east, north),
        ]
        x_min, x_max = min(p[0] for p in pts), max(p[0] for p in pts)
        y_min, y_max = min(p[1] for p in pts), max(p[1] for p in pts)
        ixs = window_indices(x, x_min, x_max)
        iys = window_indices(y, y_min, y_max)
        if ixs is None or iys is None:
            return f"miss {granule['date']} (roi outside frame)"
        i0, i1 = centered_window(ixs[0], ixs[1], site["read_px"])
        j0, j1 = centered_window(iys[0], iys[1], site["read_px"])

        dset = handle[f"{GRID}/{site['polarization']}"]
        power = np.asarray(dset[j0:j1, i0:i1], dtype=np.float32)
        valid = np.isfinite(power) & (power > 0)
        factor = max(1, int(round((i1 - i0) / site["target_px"])))
        mean_power = block_mean(power, valid, factor)
        valid_out = np.isfinite(mean_power)
        db = 10 * np.log10(np.maximum(mean_power, 1e-8))
        encoded = np.full(db.shape, INVALID, dtype=np.int16)
        encoded[valid_out] = np.clip(np.round(db[valid_out] * DB_SCALE), -32767, 32767).astype(np.int16)

        corners = [
            projector.inverse(float(x[i0]), float(y[j0])),
            projector.inverse(float(x[i1 - 1]), float(y[j0])),
            projector.inverse(float(x[i1 - 1]), float(y[j1 - 1])),
            projector.inverse(float(x[i0]), float(y[j1 - 1])),
        ]
        top = sorted(corners, key=lambda corner: -corner[1])[:2]
        bottom = sorted(corners, key=lambda corner: -corner[1])[2:]
        top = sorted(top, key=lambda corner: corner[0])
        bottom = sorted(bottom, key=lambda corner: corner[0])
        corners = [top[0], top[1], bottom[1], bottom[0]]
        lookup = lookup_grid(x, y, i0, i1, j0, j1, projector)

        valid_db = db[valid_out]
        np.savez_compressed(
            out_path,
            db=encoded,
            corners=np.array(corners, dtype=np.float64),
            lookup=lookup,
            epsg=np.int32(epsg),
            spacing_m=np.float32(abs(float(x[1] - x[0])) * factor),
            read_shape=np.array(power.shape, dtype=np.int32),
            factor=np.int32(factor),
            valid_fraction=np.float32(float(valid_out.mean())),
            mean_db=np.float32(float(valid_db.mean())),
            p2_db=np.float32(float(np.percentile(valid_db, 2))),
            p98_db=np.float32(float(np.percentile(valid_db, 98))),
            acquired_at=np.array(granule["acquired_at"]),
            granule=np.array(granule["title"]),
            source_url=np.array(granule["data_url"]),
            polarization=np.array(site["polarization_label"]),
        )
        return (
            f"ok {granule['date']} {power.shape} -> {encoded.shape} "
            f"valid={float(valid_out.mean()):.2f} mean={float(valid_db.mean()):.1f}dB "
            f"({round(time.time() - started, 1)}s)"
        )
    finally:
        handle.close()


def find_granules(site):
    start, end = site["date_window"]
    results = cmr.search(config.COLLECTION_SHORT, site["roi"], start, end)
    matches = cmr.match_site(results, site)
    by_date = {}
    for item in matches:
        by_date.setdefault(item["date"], []).append(item)
    return by_date


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--date", default=None)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    site = config.SITES[args.site]
    site_dir = config.CACHE / args.site
    site_dir.mkdir(parents=True, exist_ok=True)
    if args.force:
        for path in site_dir.glob("*.npz"):
            if path.name != "grid.npz":
                path.unlink()

    by_date = find_granules(site)
    print("available:", ", ".join(sorted(by_date)))
    wanted = site["dates"] or sorted(by_date)
    if args.date:
        wanted = [args.date]
    missing = [date for date in wanted if date not in by_date]
    if missing:
        print("missing:", ", ".join(missing))

    grid = load_grid(site_dir)
    if grid is None and wanted:
        first = by_date[wanted[0]][0]
        handle = open_remote(first["data_url"])
        try:
            x, y, epsg = read_grid(handle)
        finally:
            handle.close()
        save_grid(site_dir, x, y, epsg)
        grid = (x, y, epsg)
        print("grid:", x.shape, y.shape, "epsg:", epsg)

    jobs = [(site, by_date[date][0]) for date in wanted if date in by_date]
    with futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        rows = list(pool.map(lambda job: extract_one(args.site, job[0], job[1], site_dir, grid), jobs))
    for row in rows:
        print(row)

    summary = {
        date: {
            "valid_fraction": float(np.load(site_dir / f"{date}.npz")["valid_fraction"]),
            "mean_db": float(np.load(site_dir / f"{date}.npz")["mean_db"]),
            "p2_db": float(np.load(site_dir / f"{date}.npz")["p2_db"]),
            "p98_db": float(np.load(site_dir / f"{date}.npz")["p98_db"]),
        }
        for date in wanted
        if (site_dir / f"{date}.npz").exists()
    }
    (site_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
