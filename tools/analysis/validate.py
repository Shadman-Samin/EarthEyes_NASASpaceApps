"""Independent sensor agreement and source-release availability, never ground truth."""
import argparse
import json
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from urllib.parse import parse_qs, quote, urlparse

import numpy as np
import rasterio
import requests
from rasterio.enums import Resampling
from rasterio.transform import Affine
from rasterio.vrt import WarpedVRT

import cmr
import config
import discover
import stats
from extract import resolve_site

PC = "https://planetarycomputer.microsoft.com/api/stac/v1"
_container_tokens = {}


def signed(href):
    if urlparse(href).scheme != "https" or not (urlparse(href).hostname or "").endswith(".blob.core.windows.net"):
        raise ValueError("unsupported reference asset host")
    parsed = urlparse(href)
    key = (parsed.hostname, parsed.path.split("/")[1])
    cached = _container_tokens.get(key)
    if cached and cached[1] > datetime.now(timezone.utc) + timedelta(minutes=5):
        return parsed._replace(query=cached[0]).geturl()
    response = requests.get("https://planetarycomputer.microsoft.com/api/sas/v1/sign", params={"href": href}, timeout=25)
    if response.status_code in (401, 403):
        raise PermissionError("Planetary Computer account required for this collection")
    response.raise_for_status()
    result = response.json()["href"]
    if urlparse(result).hostname != urlparse(href).hostname or urlparse(result).scheme != "https":
        raise ValueError("unexpected reference signing host")
    query = parse_qs(urlparse(result).query)
    if query.get("sr") == ["c"] and query.get("se"):
        expires = datetime.fromisoformat(query["se"][0].replace("Z", "+00:00"))
        _container_tokens[key] = (urlparse(result).query, expires)
    return result


def search(collection, bbox, start, end, cloud=None):
    params = {"collections": collection, "bbox": ",".join(map(str, bbox)),
              "datetime": f"{start}T00:00:00Z/{end}T23:59:59Z", "limit": 100}
    if cloud is not None:
        params["query"] = json.dumps({"eo:cloud_cover": {"lt": cloud}})
    url, features = f"{PC}/search", []
    for _ in range(10):
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        features.extend(data.get("features", []))
        link = next((link for link in data.get("links", []) if link["rel"] == "next"), None)
        if link is None:
            return list({feature["id"]: feature for feature in features}.values())
        url, params = link["href"], None
        if not url.startswith(PC + "/search?"):
            raise ValueError("unexpected reference pagination URL")
    raise ValueError("reference search incomplete after 10 pages; narrow the dates")


def read_on_grid(href, affine, crs, shape, resampling=Resampling.bilinear):
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_CONNECTTIMEOUT="10",
                      GDAL_HTTP_TIMEOUT="25", GDAL_HTTP_MAX_RETRY="0"):
        with rasterio.open(signed(href)) as dataset:
            with WarpedVRT(dataset, crs=crs, transform=affine, width=shape[1], height=shape[0],
                           resampling=resampling, dtype="float32", nodata=np.nan) as window:
                return window.read(1)


def reflectance(dn, quantification, offset):
    if not np.isfinite(quantification) or quantification <= 0 or not np.isfinite(offset):
        raise ValueError("invalid Sentinel-2 radiometry")
    return np.where(np.isfinite(dn) & (dn > 0), (dn + offset) / quantification, np.nan)


def scores(reference, candidate, mask):
    tp = int((reference & candidate & mask).sum())
    fp = int((~reference & candidate & mask).sum())
    fn = int((reference & ~candidate & mask).sum())
    return {"iou": round(tp / (tp + fp + fn), 3) if tp + fp + fn else None,
            "precision": round(tp / (tp + fp), 3) if tp + fp else None,
            "recall": round(tp / (tp + fn), 3) if tp + fn else None,
            "coverage": round(float(mask.mean()), 3)}


def compare_sensor(site, manifest, collection, max_days=6, max_cloud=70):
    days = [item["date"] for item in manifest["dates"]]
    start = (date.fromisoformat(min(days)) - timedelta(days=max_days)).isoformat()
    end = (date.fromisoformat(max(days)) + timedelta(days=max_days)).isoformat()
    records = []
    sensor_cache = {}
    optical = collection == "sentinel-2-l2a"
    try:
        features = search(collection, site["roi"], start, end, max_cloud if optical else None)
    except (requests.RequestException, ValueError, KeyError) as error:
        features = []
        records = [{"date": day, "status": "unavailable", "reason": type(error).__name__} for day in days]
    loaded = {day: stats.load_date(config.cache_dir(site), day) for day in days} if features else {}
    common = np.logical_and.reduce([entry[1] for entry in loaded.values()]) if loaded else None
    access_denied = False
    for day in days if not records else []:
        target = date.fromisoformat(day)
        candidates = [feature for feature in features
                      if abs((date.fromisoformat(feature["properties"]["datetime"][:10]) - target).days) <= max_days
                      and discover.overlap_fraction(site["roi"], feature.get("bbox")) >= 0.5]
        candidates.sort(key=lambda feature: (abs((date.fromisoformat(feature["properties"]["datetime"][:10]) - target).days),
                                            feature["properties"].get("eo:cloud_cover", 0), feature["id"]))
        record = {"date": day, "status": "access_unavailable" if access_denied else "no_scene"}
        for feature in candidates[:3] if not access_denied else []:
            scene = feature["properties"]["datetime"][:10]
            record = {"date": day, "scene_date": scene, "scene_id": feature["id"],
                      "offset_days": (date.fromisoformat(scene) - target).days,
                      "source_url": f"{PC}/collections/{collection}/items/{quote(feature['id'], safe='')}", "status": "unavailable"}
            entry = loaded[day]
            affine, crs, shape = Affine(*entry[3]["transform"]), f"EPSG:{entry[3]['epsg']}", entry[0].shape
            try:
                if feature["id"] not in sensor_cache:
                    assets = feature["assets"]
                    if optical:
                        response = requests.get(signed(assets["product-metadata"]["href"]), timeout=25)
                        response.raise_for_status()
                        root = ET.fromstring(response.content)
                        quantities = [element for element in root.iter() if element.tag.split("}")[-1] == "BOA_QUANTIFICATION_VALUE"]
                        offsets = {int(element.attrib["band_id"]): float(element.text) for element in root.iter()
                                   if element.tag.split("}")[-1] == "BOA_ADD_OFFSET"}
                        quantification = float(quantities[0].text)
                        green = reflectance(read_on_grid(assets["B03"]["href"], affine, crs, shape), quantification, offsets[2])
                        nir = reflectance(read_on_grid(assets["B08"]["href"], affine, crs, shape), quantification, offsets[7])
                        scl = read_on_grid(assets["SCL"]["href"], affine, crs, shape, Resampling.nearest)
                        valid = np.isin(scl, [4, 5, 6]) & np.isfinite(green) & np.isfinite(nir) & (green >= 0) & (nir >= 0) & (green + nir > 0)
                        ndwi = np.divide(green - nir, green + nir, out=np.full(shape, np.nan), where=valid)
                        water = ndwi > 0
                    else:
                        # PC documents calibrated intensity, not dB; never guess units from sample magnitude.
                        power = read_on_grid(assets["vv"]["href"], affine, crs, shape)
                        valid = np.isfinite(power) & (power > 0) & common
                        db = np.full(shape, np.nan, np.float32)
                        db[valid] = 10 * np.log10(power[valid])
                        water, _ = stats.water_mask(db, valid)
                    sensor_cache[feature["id"]] = water, valid
                water, valid = sensor_cache[feature["id"]]
                mask = valid & common
                coverage = float(mask.sum() / common.sum())
                if coverage < 0.2:
                    record.update(status="insufficient_clear_overlap", coverage=round(coverage, 3))
                    continue
                nisar, _ = stats.water_mask(entry[0], common)
                record.update(scores(water, nisar, mask), status="compared", coverage=round(coverage, 3))
                break
            except PermissionError:
                record.update(status="access_unavailable", reason="Planetary Computer account required; no credentials supplied")
                access_denied = True
                break
            except (requests.RequestException, rasterio.errors.RasterioError, ValueError, KeyError, IndexError, ET.ParseError) as error:
                # Do not serialize exception messages: raster/HTTP errors can contain SAS credentials.
                reason = f"HTTP{error.response.status_code}" if isinstance(error, requests.HTTPError) and error.response is not None else type(error).__name__
                record.update(status="unavailable", reason=reason)
        records.append(record)
        print(f"{collection} {day}: {record['status']}", flush=True)
    compared = [record for record in records if record["status"] == "compared"]
    ious = [record["iou"] for record in compared if record["iou"] is not None]
    return {"source": collection, "status": "compared" if compared else "unavailable",
            "attempted_dates": len(days), "compared_dates": len(compared), "unique_scenes": len({record["scene_id"] for record in compared}),
            "mean_iou": round(float(np.mean(ious)), 3) if ious else None, "dates": records,
            "method": "S2 metadata-scaled B03/B08 NDWI > 0; SCL classes 4/5/6 only" if optical else "S1 calibrated linear intensity converted to dB; Otsu dark-water candidates; VV only",
            "limits": [f"Nearest eligible scene within {max_days} calendar days; first of up to three candidates with at least 20% clear common-footprint coverage. Optical scene cloud cover must be below {max_cloud}%.",
                       "Precision/recall treat the independent sensor classification as reference and NISAR as candidate, not ground truth.",
                       "Cloud-selected subsets, tidal timing and different sensor responses limit agreement; no direct C-band/L-band dB comparison."]}


def maturity(site, manifest):
    series = manifest["provenance"]["series"]
    expected = (series["relative_orbit"], series["direction"], series["frame"], series["mode"], series["polarization_token"])
    dates = {item["date"] for item in manifest["dates"]}
    records = []
    for product, collection in config.COLLECTIONS.items():
        if product == site["product"]:
            continue
        try:
            items = cmr.search(collection, site["roi"], *site["date_window"])
            matching = [item for item in items if tuple(item[key] for key in ("orbit", "direction", "frame", "mode", "polarization_token")) == expected
                        and item["date"] in dates and discover.overlap_fraction(site["roi"], item["bbox"]) >= 0.999]
            records.append({"product": product, "collection": collection, "matching_dates": len({item["date"] for item in matching}),
                            "status": "metadata_only" if matching else "no_matching_dates", "compared_dates": 0})
        except (requests.RequestException, ValueError, KeyError):
            records.append({"product": product, "collection": collection, "matching_dates": 0, "status": "unavailable", "compared_dates": 0})
    return {"status": "availability_checked", "collections": records,
            "limitation": "Beta is not necessarily newer than provisional. Matching metadata is not a radiometric comparison or a calibration error bar."}


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
    parser.add_argument("--max-days", type=int, default=6)
    args = parser.parse_args()
    if not 0 <= args.max_days <= 12:
        raise ValueError("max-days must be between 0 and 12")
    site = resolve_site(args)
    path = config.PUBLIC / site["id"] / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest["product"] != site["product"] or manifest["bbox"] != list(site["roi"]) or manifest["schema_version"] != "3.0.0":
        raise ValueError("manifest does not match the reference request")
    references = [compare_sensor(site, manifest, source, args.max_days) for source in ("sentinel-2-l2a", "sentinel-1-rtc")]
    manifest["validation"] = {"status": "attempted", "checked_at": datetime.now(timezone.utc).isoformat(),
                              "references": references, "maturity": maturity(site, manifest)}
    path.write_text(json.dumps(manifest, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps({"references": [{key: source[key] for key in ("source", "status", "compared_dates", "mean_iou")} for source in references],
                      "maturity": manifest["validation"]["maturity"]}, indent=2))


if __name__ == "__main__":
    main()
