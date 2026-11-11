# NISAR change-analysis pipeline

This folder downloads real NISAR L2 GCOV granules, computes calibrated change bundles,
and writes them to `public/analysis/<place>/` for the frontend.

## Requirements

- Python 3.10+
- `numpy`, `scipy`, `h5py`, `fsspec`, `requests`, `Pillow`
- An Earthdata bearer token in `.env.analysis` (`EARTHDATA_TOKEN=...`), never committed

## Run

```sh
python extract.py --site kuakata-bangladesh
python extract.py --site jakobshavn-glacier
python analyze.py --site kuakata-bangladesh
python analyze.py --site jakobshavn-glacier
```

## Notes

- Only the needed HDF5 windows are read over HTTPS.
- Bundles are Int16 rasters plus JSON manifests and are served as static assets.
- All values are provisional NISAR calibration and are labelled as such in the app.
