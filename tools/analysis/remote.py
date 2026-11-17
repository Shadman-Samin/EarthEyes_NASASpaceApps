"""Remote HDF5 access over HTTPS range requests with Earthdata bearer auth."""
from urllib.parse import urlparse

import fsspec
import h5py
from aiohttp import ClientTimeout

from edl import earthdata_token

BLOCK_SIZE = 8 * 1024 * 1024


def open_remote(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "nisar.asf.earthdatacloud.nasa.gov" or parsed.username or parsed.password:
        raise ValueError("Earthdata credentials may only be sent to the NISAR ASF data host")
    fs = fsspec.filesystem(
        "https",
        block_size=BLOCK_SIZE,
        client_kwargs={
            "timeout": ClientTimeout(total=90),
            "headers": {
                "Authorization": f"Bearer {earthdata_token()}",
                "Accept": "*/*",
            }
        },
    )
    return h5py.File(fs.open(url, "rb"), "r")


GRID = "/science/LSAR/GCOV/grids/frequencyA"
