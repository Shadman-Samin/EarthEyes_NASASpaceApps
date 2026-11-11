"""One-granule proof: auth, grid metadata, coordinate window, calibrated dB values."""
import argparse
import time

import numpy as np

import cmr
import config
import projection
from remote import GRID, open_remote


def window_indices(values, low, high):
    (idx,) = np.where((values >= low) & (values <= high))
    if idx.size == 0:
        return None
    return int(idx.min()), int(idx.max()) + 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", default="kuakata-bangladesh")
    parser.add_argument("--date", default=None)
    parser.add_argument("--frame", default=None)
    parser.add_argument("--px", type=int, default=512)
    args = parser.parse_args()

    site = config.SITES[args.site]
    start, end = site["date_window"]
    results = cmr.search(config.COLLECTION_SHORT, site["roi"], start, end)
    matches = cmr.match_site(results, site)
    if args.date:
        matches = [item for item in matches if item["date"] == args.date]
    if args.frame:
        matches = [item for item in matches if item["frame"] == args.frame]
    if not matches:
        raise SystemExit("no matching granules")

    for granule in matches[:2]:
        print("granule:", granule["title"])
        print("size_gb:", round((granule["size_bytes"] or 0) / 1e9, 2))
        started = time.time()
        handle = open_remote(granule["data_url"])
        try:
            x = handle[f"{GRID}/xCoordinates"][:]
            y = handle[f"{GRID}/yCoordinates"][:]
            epsg = int(handle[f"{GRID}/projection"].attrs.get("epsg_code", 0))
            spacing_x = float(handle[f"{GRID}/xCoordinateSpacing"][()])
            spacing_y = float(handle[f"{GRID}/yCoordinateSpacing"][()])
            dset = handle[f"{GRID}/HHHH"]
            print(
                "grid:",
                x.shape,
                y.shape,
                "epsg:",
                epsg,
                "spacing:",
                spacing_x,
                spacing_y,
                "chunks:",
                dset.chunks,
                "compression:",
                dset.compression,
            )
            print("meta_s:", round(time.time() - started, 1))

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
                print("roi not covered by this frame")
                continue
            print("roi_indices:", ixs, iys, "span_px:", ixs[1] - ixs[0], iys[1] - iys[0])

            half = args.px // 2
            ci = (ixs[0] + ixs[1]) // 2
            cj = (iys[0] + iys[1]) // 2
            i0, i1 = max(ixs[0], ci - half), min(ixs[1], ci + half)
            j0, j1 = max(iys[0], cj - half), min(iys[1], cj + half)
            read_started = time.time()
            power = dset[j0:j1, i0:i1].astype(np.float32)
            read_s = time.time() - read_started
            pixels = power.size
            print(
                "read_s:",
                round(read_s, 1),
                "shape:",
                power.shape,
                "px/s:",
                round(pixels / max(read_s, 0.001)),
            )
            valid = np.isfinite(power) & (power > 0)
            print("valid_fraction:", round(float(valid.mean()), 3))
            if valid.any():
                db = 10 * np.log10(np.maximum(power[valid], 1e-8))
                print(
                    "HH dB p2/p50/p98:",
                    [round(float(np.percentile(db, p)), 1) for p in (2, 50, 98)],
                )

            corners = [
                projector.inverse(float(x[i0]), float(y[j0])),
                projector.inverse(float(x[i1 - 1]), float(y[j0])),
                projector.inverse(float(x[i1 - 1]), float(y[j1 - 1])),
                projector.inverse(float(x[i0]), float(y[j1 - 1])),
            ]
            print(
                "window_corners_lonlat:",
                [[round(a, 5), round(b, 5)] for a, b in corners],
            )
        finally:
            handle.close()
        print("elapsed_s:", round(time.time() - started, 1))
        print()


if __name__ == "__main__":
    main()
