"""Render a cached date to a percentile-stretched PNG for a quick visual check."""
import argparse

import numpy as np
from PIL import Image

import config


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--date", required=True)
    args = parser.parse_args()

    site_dir = config.CACHE / args.site
    data = np.load(site_dir / f"{args.date}.npz")
    db = data["db"].astype(np.float32) / 100.0
    valid = db > -30000
    lo, hi = np.percentile(db[valid], [2, 98])
    stretched = np.clip((db - lo) / max(hi - lo, 1e-6), 0, 1)
    image = Image.fromarray((stretched * 255).astype(np.uint8), mode="L")
    out = site_dir / f"preview_{args.date}.png"
    image.save(out)
    print(out, image.size, "stretch_dB:", round(float(lo), 1), round(float(hi), 1))
    print("corners:", data["corners"].round(5).tolist())


if __name__ == "__main__":
    main()
