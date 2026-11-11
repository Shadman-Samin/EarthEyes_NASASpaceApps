"""CMR granule search for NISAR GCOV products."""
import re
from datetime import datetime

import requests

CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"


def search(collection_short, bbox, start, end, page_size=100):
    west, south, east, north = bbox
    params = {
        "short_name": collection_short,
        "bounding_box": f"{west},{south},{east},{north}",
        "temporal": f"{start}T00:00:00Z,{end}T23:59:59Z",
        "page_size": page_size,
        "sort_key": "-start_date",
    }
    response = requests.get(CMR, params=params, timeout=60)
    response.raise_for_status()
    return [_granule(item, collection_short) for item in response.json().get("items", [])]


def _granule(item, collection_short):
    umm = item["umm"]
    title = umm["GranuleUR"]
    start = umm["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"]
    urls = umm.get("RelatedUrls", [])
    data_url = next(
        (
            url["URL"]
            for url in urls
            if url.get("Type") == "GET DATA" and url["URL"].endswith(".h5")
        ),
        f"https://nisar.asf.earthdatacloud.nasa.gov/NISAR/{collection_short}/{title}/{title}.h5",
    )
    browse = next(
        (
            url["URL"]
            for url in urls
            if url.get("Type") == "GET RELATED VISUALIZATION"
            and url["URL"].endswith("_NATIVE_A_HHHH.png")
        ),
        None,
    )
    size = next(
        (
            entry.get("SizeInBytes")
            for entry in umm.get("DataGranule", {}).get(
                "ArchiveAndDistributionInformation", []
            )
            if entry.get("Name", "").endswith(".h5")
        ),
        None,
    )
    return {
        "title": title,
        "acquired_at": start,
        "date": datetime.fromisoformat(start.replace("Z", "+00:00")).date().isoformat(),
        "data_url": data_url,
        "browse_url": browse,
        "size_bytes": size,
        "orbit": _field(title, 5),
        "frame": _field(title, 7),
        "direction": _field(title, 6),
    }


def _field(title, index):
    parts = title.split("_")
    return parts[index] if len(parts) > index else ""


def match_site(items, site):
    pattern = re.compile(site["name_pattern"])
    return [item for item in items if pattern.search(item["title"])]
