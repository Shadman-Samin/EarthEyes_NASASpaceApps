"""Inventory of NISAR GCOV layers needed for calibrated, uncertainty-aware change."""
import argparse

import numpy as np

import cmr
import config
from remote import GRID, open_remote

GROUPS = (
    f"{GRID}",
    "/science/LSAR/GCOV/metadata",
    "/science/LSAR/GCOV/metadata/calibrationInformation",
    "/science/LSAR/GCOV/metadata/processingInformation",
    "/science/LSAR/GCOV/metadata/processingInformation/algorithms",
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", default="kuakata-bangladesh")
    parser.add_argument("--date", default=None)
    parser.add_argument("--px", type=int, default=128)
    args = parser.parse_args()

    site = config.SITES[args.site]
    start, end = site["date_window"]
    results = cmr.search(config.COLLECTION_SHORT, site["roi"], start, end)
    matches = cmr.match_site(results, site)
    if args.date:
        matches = [item for item in matches if item["date"] == args.date]
    if not matches:
        raise SystemExit("no matching granules")
    granule = matches[0]
    print("granule:", granule["title"])

    handle = open_remote(granule["data_url"])
    try:
        for group in GROUPS:
            if group not in handle:
                continue
            print(f"\n[{group}]")
            for key in handle[group]:
                obj = handle[f"{group}/{key}"]
                shape = getattr(obj, "shape", "group")
                print(f"  {key} {shape}")

        print("\n[grids/frequencyA sample statistics]")
        x = handle[f"{GRID}/xCoordinates"][:]
        y = handle[f"{GRID}/yCoordinates"][:]
        ci, cj = x.size // 2, y.size // 2
        half = args.px // 2
        j0, j1 = cj - half, cj + half
        i0, i1 = ci - half, ci + half
        for key in ("HHHH", "HVHV", "mask", "numberOfLooks", "inputDataExceptionMask", "rtcGammaToSigmaFactor"):
            if f"{GRID}/{key}" not in handle:
                continue
            dset = handle[f"{GRID}/{key}"]
            data = np.asarray(dset[j0:j1, i0:i1])
            finite = data[np.isfinite(data)] if data.dtype.kind == "f" else data
            print(
                key,
                "dtype", str(dset.dtype),
                "min", float(np.nanmin(finite)),
                "median", float(np.nanmedian(finite)),
                "max", float(np.nanmax(finite)),
                "nan_frac", round(float(np.mean(~np.isfinite(data))) if data.dtype.kind == "f" else 0, 3),
            )
            if key in ("mask", "inputDataExceptionMask"):
                values, counts = np.unique(data, return_counts=True)
                print("  values:", dict(zip(values.tolist(), counts.tolist())))
        print("\nspacing_m:", float(handle[f"{GRID}/xCoordinateSpacing"][()]), float(handle[f"{GRID}/yCoordinateSpacing"][()]))
        print("grid:", x.shape, y.shape, "epsg:", int(handle[f"{GRID}/projection"].attrs["epsg_code"]))
    finally:
        handle.close()


if __name__ == "__main__":
    main()
