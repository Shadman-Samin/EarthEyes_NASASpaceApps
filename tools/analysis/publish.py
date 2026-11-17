"""Generate local public/API indexes from complete, checked exploratory bundles."""
import argparse
import json
import re

import config


def build_index(manifests):
    for manifest in manifests:
        days = [row["date"] for row in manifest["dates"]]
        validation = manifest.get("validation", {})
        if validation.get("status") != "attempted" or not validation.get("checked_at"):
            raise ValueError("reference checks must be attempted before publication")
        if (manifest.get("schema_version") != "3.0.0" or manifest.get("status") != "exploratory_derived"
                or len(days) < 2 or len(set(days)) != len(days)
                or manifest["provenance"]["geometry_checked_dates"] != len(days)):
            raise ValueError("only complete, geometry-checked exploratory bundles may be published")
        checks = validation.get("references", [])
        if {check["source"] for check in checks} != {"sentinel-2-l2a", "sentinel-1-rtc"}:
            raise ValueError("both independent reference availability checks are required")
        for check in checks:
            if (check["attempted_dates"] != len(days) or [row["date"] for row in check["dates"]] != days
                    or check["compared_dates"] != sum(row["status"] == "compared" for row in check["dates"])):
                raise ValueError("reference date accounting is incomplete")
        for url in (manifest["raster"][key] for key in ("delta_url", "water_change_url")) if manifest.get("raster") else []:
            if url is not None and (not re.fullmatch(r"/analysis/[a-z0-9-]+/rasters/[a-z0-9-]+\.webp", url)
                                    or not (config.PUBLIC / url.removeprefix("/analysis/")).is_file()):
                raise ValueError("published display raster is missing or unsafe")
    index = {"schema_version": "3.0.0", "entries": sorted(manifests, key=lambda item: item["id"])}
    json.dumps(index, allow_nan=False)
    return index


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", action="append", required=True)
    args = parser.parse_args()
    if any(not re.fullmatch(r"[a-z0-9-]+", site) for site in args.site):
        raise ValueError("site must be a safe analysis identifier")
    manifests = [json.loads((config.PUBLIC / site / "manifest.json").read_text(encoding="utf-8")) for site in args.site]
    text = json.dumps(build_index(manifests), indent=2, allow_nan=False) + "\n"
    (config.PUBLIC / "index.json").write_text(text, encoding="utf-8")
    (config.REPO / "backend" / "api" / "src" / "analysis-index.json").write_text(text, encoding="utf-8")
    print(f"Prepared {len(manifests)} local bundles for the public/API indexes. Nothing was deployed.")


if __name__ == "__main__":
    main()
