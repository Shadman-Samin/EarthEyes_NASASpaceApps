"""Remote HDF5 access over HTTPS range requests with Earthdata bearer auth."""
import fsspec
import h5py

from edl import earthdata_token

BLOCK_SIZE = 8 * 1024 * 1024


def open_remote(url):
    fs = fsspec.filesystem(
        "https",
        block_size=BLOCK_SIZE,
        client_kwargs={
            "headers": {
                "Authorization": f"Bearer {earthdata_token()}",
                "Accept": "*/*",
            }
        },
    )
    return h5py.File(fs.open(url, "rb"), "r")


GRID = "/science/LSAR/GCOV/grids/frequencyA"
