"""Pick one comparable NISAR track/frame series for any bounding box."""
import argparse
import hashlib
import json
import math
import re
from datetime import date

import cmr
import config


def overlap_fraction(inner, outer):
    """Fraction of `inner` (lon/lat bbox) covered by `outer`."""
    if not inner or not outer:
        return 0.0
    south = max(inner[1], outer[1])
    north = min(inner[3], outer[3])
    if north <= south:
        return 0.0
    a = [(inner[0], inner[2])] if inner[0] < inner[2] else [(inner[0], 180), (-180, inner[2])]
    b = [(outer[0], outer[2])] if outer[0] < outer[2] else [(outer[0], 180), (-180, outer[2])]
    width = sum(max(0, min(a1, b1) - max(a0, b0)) for a0, a1 in a for b0, b1 in b)
    return width * (north - south) / (sum(hi - lo for lo, hi in a) * (inner[3] - inner[1]))


def validate_request(bbox, start, end):
    if len(bbox) != 4 or not all(math.isfinite(value) for value in bbox):
        raise ValueError("bbox requires four finite coordinates")
    west, south, east, north = bbox
    if not (-180 <= west <= 180 and -180 <= east <= 180 and -90 <= south < north <= 90) or west == east or (west == 180 and east == -180):
        raise ValueError("bbox must have nonzero width and valid longitude/latitude bounds")
    if date.fromisoformat(start) > date.fromisoformat(end):
        raise ValueError("start must not be after end")


def slugify(label):
    return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:60]


def even_sample(dates, limit):
    if len(dates) <= limit:
        return dates
    step = (len(dates) - 1) / (limit - 1)
    return sorted({dates[round(index * step)] for index in range(limit)})


def plan(bbox, start, end, product="nisar-gcov-provisional", dates=None,
         label=None, phenomenon=None, read_px=None, target_px=None):
    validate_request(bbox, start, end)
    if product not in config.COLLECTIONS:
        raise ValueError("unsupported product")
    for size in (read_px, target_px):
        if size is not None and (not isinstance(size, int) or not 1 <= size <= 4096):
            raise ValueError("pixel limits must be integers between 1 and 4096")
    collection = config.COLLECTIONS[product]
    items = cmr.search(collection, bbox, start, end)
    if not items:
        raise ValueError(f"no granules for {bbox} {start}..{end}")

    groups = {}
    for item in items:
        if overlap_fraction(bbox, item["bbox"]) < 0.999 or (dates and item["date"] not in dates):
            continue
        key = tuple(item.get(field, "") for field in ("orbit", "direction", "frame", "mode", "polarization_token", "baseline"))
        if not all(key):
            continue
        groups.setdefault(key, []).append(item)

    candidates = []
    for key, group in groups.items():
        by_date = {}
        for item in sorted(group, key=lambda item: item["title"]):
            by_date.setdefault(item["date"], item)
        coverage = min(overlap_fraction(bbox, item["bbox"]) for item in by_date.values())
        candidates.append((len(by_date), coverage, key, by_date))

    if not candidates:
        raise ValueError("no comparable series covers the requested box")
    candidates.sort(key=lambda row: (row[0], row[1]), reverse=True)
    count, coverage, key, by_date = candidates[0]
    if count < config.DEFAULTS["min_dates"]:
        raise ValueError(f"series {key} has {count} date(s); need >= 2")

    available = sorted(by_date)
    wanted = [date for date in (dates or available) if date in by_date]
    wanted = even_sample(wanted, config.DEFAULTS["max_dates"])
    if len(wanted) < 2:
        raise ValueError("fewer than two usable dates after filtering")

    phenomenon = phenomenon or "surface-change"
    available_pols = {"SH": ("HH",), "DH": ("HH", "HV"), "SV": ("VV",), "DV": ("VV", "VH")}.get(key[4][:2])
    if not available_pols:
        raise ValueError(f"unsupported frequency-A polarization mode: {key[4]}")
    pol = available_pols[-1] if phenomenon == "coastal-water-change" else available_pols[0]
    label = label or f"{bbox[1]:.2f}, {bbox[0]:.2f}"
    identity = hashlib.sha256(json.dumps([bbox, start, end, product, key, wanted, phenomenon]).encode()).hexdigest()[:10]
    slug = f"{slugify(label) or 'region'}-{identity}"
    return {
        "id": slug,
        "label": label,
        "module": "coastal" if phenomenon == "coastal-water-change" else "surface",
        "phenomenon": phenomenon,
        "roi": tuple(bbox),
        "relative_orbit": key[0],
        "direction": key[1],
        "frame": key[2],
        "mode": key[3],
        "polarization_token": key[4],
        "baseline": key[5],
        "polarization": pol + pol,
        "polarization_label": pol,
        "dates": wanted,
        "available_dates": available,
        "date_window": (start, end),
        "product": product,
        "collection": collection,
        "series_coverage": round(coverage, 4),
        "read_px": read_px or config.DEFAULTS["read_px"],
        "target_px": target_px or config.DEFAULTS["target_px"],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bbox", required=True, help="west,south,east,north")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--product", default="nisar-gcov-provisional", choices=sorted(config.COLLECTIONS))
    parser.add_argument("--label", default=None)
    parser.add_argument("--phenomenon", default=None)
    args = parser.parse_args()
    bbox = tuple(float(value) for value in args.bbox.split(","))
    site = plan(bbox, args.start, args.end, args.product, label=args.label, phenomenon=args.phenomenon)
    print(json.dumps(site, indent=2))


if __name__ == "__main__":
    main()
