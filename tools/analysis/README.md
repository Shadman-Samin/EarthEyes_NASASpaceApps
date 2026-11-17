# NISAR Calibrated-Source Analysis

Offline numerical processing, not a live job service. Source calibration, reference
agreement and validation of an EarthEyes result are distinct. Every current bundle
is `exploratory_derived`.

## Run From The Repository Root

Requires Python 3.10+, NumPy, SciPy, h5py, `fsspec[http]`, requests, Pillow and rasterio
(tested with rasterio 1.4.4). An Earthdata bearer token belongs in the gitignored
`.env.analysis` as `EARTHDATA_TOKEN`. Never publish tokens, signed asset URLs or caches.

```sh
python tools/analysis/extract.py --site kuakata-bangladesh --workers 2
python tools/analysis/analyze.py --site kuakata-bangladesh
python tools/analysis/validate.py --site kuakata-bangladesh
python tools/analysis/publish.py --site kuakata-bangladesh
python -m unittest discover -s tools/analysis -p "test_*.py"
```

For a custom region, replace `--site` on extract/analyze/validate with the same
`--bbox west,south,east,north --start YYYY-MM-DD --end YYYY-MM-DD --label Name` arguments.
Add `--phenomenon coastal-water-change` for water-candidate metrics. Discovery prints
the stable generated site ID; use that ID with `publish.py --site`. Optional `--product`
selects provisional, beta or standard GCOV. Publication must be repeated after changes;
it regenerates both `public/analysis/index.json` and the backend's bundled index.

Discovery requires one covering orbit/frame/mode/polarization/baseline series and at
least two dates. It samples at most 12 dates deterministically. The default bounded
read is 1536 native pixels per dimension, reduced to about 768 output pixels; larger
regions must be subdivided or explicitly given bounded `--read-px`/`--target-px` limits.
Unsupported acquisition modes or missing coverage fail explicitly. Common horizontal
and vertical single/dual-pol modes are supported; there is no promise of a result for
every location. Polar or dateline numerical results may have no Web Mercator overlay.

Extraction writes `cache/<site>/v3/<product>/` and preserves old caches. `--date` can
be repeated to resume selected dates. `--force` replaces only requested v3 dates,
not an entire old cache. Cached power is reused only after verifying its exact
source, full coordinate arrays, window, polarization, and all native quality samples.

## Numerical Contract

- Read calibrated gamma0 linear power and source correction flags. Never infer
  incidence angle from the RTC area factor or apply a second RTC/noise correction.
- Require fully valid subswath and input exception masks for every native sample in
  a reduction block. Handle uint8 anomaly masks and uint16 polarization-validity masks.
- Match every source grid and request. Use a fixed common valid footprint for every
  epoch and time-series point. Unknown coverage cannot become apparent water loss.
- Average power before converting to dB. Store measurements at 0.01 dB quantization.
- Compute horizontal cell areas in a local WGS84 ellipsoidal equal-area projection.
- Use first/last disjoint median epochs of up to three dates. The source look count
  feeds an explicitly conditional log-Gamma screen; no independent-look gain from
  spatial averaging or medians is assumed. This is not a calibrated significance test.
- Keep same-sign connected components of at least 5,000 m2. Sum all retained areas;
  cap only the displayed component list. The area filter is not a detection limit.
- Report k=2..3 screen sensitivity and independent +/-1 dB Otsu threshold sensitivity.
  Neither range is a statistical confidence interval. Zero retained area is not proof
  of no change. Dark-water candidates can include non-water surfaces.
- Reproject only the compact display images to Web Mercator using nearest-neighbor
  resampling. Measurements never use the WebP or browse imagery.

## Independent Checks

`validate.py` searches a padded +/-6-day reference interval with bounded pagination.
It uses Sentinel-2 metadata quantification/offsets and SCL classes 4/5/6 for NDWI, or
Sentinel-1 calibrated linear VV intensity for Otsu water candidates. Comparisons use
the same numerical grid and at least 20% eligible common-footprint coverage. It does
not compare L-band/C-band dB or infer a cause. SAS container signatures stay in memory.
Partial/absent/cloudy dates and inaccessible assets stay explicit, with sanitized errors.

The Kuakata bundle has ten verified NISAR dates, ten Sentinel-1 class comparisons
and three Sentinel-2 comparisons. Early optical dates lack eligible coverage under
the date/footprint/cloud filters. Beta/standard searches returned no matching dates,
so there is no radiometric release comparison or calibration error bar. Rainfall
attribution and ground-truth validation are not supplied.

The public/API index currently contains only Kuakata. The old Jakobshavn cache and
artifact are not approved v3 results. Further portfolio sites require their own full
extraction and checks; unavailable app selections remain browse-only.
