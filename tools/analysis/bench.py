"""Benchmark fsspec block settings for windowed reads."""
import sys
import time

import fsspec
import h5py

from edl import earthdata_token
from remote import GRID


def open_with(url, block_size, cache_type):
    fs = fsspec.filesystem(
        "https",
        block_size=block_size,
        cache_type=cache_type,
        client_kwargs={
            "headers": {
                "Authorization": f"Bearer {earthdata_token()}",
                "Accept": "*/*",
            }
        },
    )
    return h5py.File(fs.open(url, "rb"), "r")


def main():
    url = sys.argv[1]
    block_size = int(sys.argv[2]) if len(sys.argv) > 2 else 1024 * 1024
    cache_type = sys.argv[3] if len(sys.argv) > 3 else "bytes"
    started = time.time()
    handle = open_with(url, block_size, cache_type)
    try:
        print("open_s:", round(time.time() - started, 1))
        t = time.time()
        x = handle[f"{GRID}/xCoordinates"][:]
        y = handle[f"{GRID}/yCoordinates"][:]
        print("coords_s:", round(time.time() - t, 1), "n:", x.size, y.size)
        epsg = int(handle[f"{GRID}/projection"].attrs.get("epsg_code", 0))
        print("epsg:", epsg)
        t = time.time()
        chunk = handle[f"{GRID}/HHHH"][26000:26512, 8000:8512]
        print("chunk_s:", round(time.time() - t, 1), "shape:", chunk.shape)
    finally:
        handle.close()
    print("total_s:", round(time.time() - started, 1))


if __name__ == "__main__":
    main()
