"""Offline regression checks; no credentials or provider calls required."""
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
import h5py
from scipy import ndimage
from scipy.special import polygamma

import analyze
import cmr
import config
import discover
import extract
import projection
import remote
import stats


class DiscoveryTests(unittest.TestCase):
    def granule(self, day, bbox=(-1, -1, 1, 1), orbit="069", mode="DHDH"):
        return {"date": day, "orbit": orbit, "direction": "A", "frame": "013",
                "bbox": bbox, "polarization_token": mode, "mode": "4005",
                "baseline": "P05023", "title": f"{orbit}-{mode}-{day}", "size_bytes": 1}

    def test_selects_fully_covering_series_not_larger_partial_series(self):
        items = [self.granule(f"2026-06-{day:02d}") for day in (1, 13, 25)]
        items += [self.granule(f"2026-06-{day:02d}", (0, 0, 0.05, 0.05), "100") for day in (1, 5, 13, 25)]
        with patch.object(cmr, "search", return_value=items):
            site = discover.plan((0, 0, 0.1, 0.1), "2026-06-01", "2026-06-30")
        self.assertEqual(site["relative_orbit"], "069")
        self.assertEqual(site["series_coverage"], 1)

    def test_does_not_mix_modes_to_manufacture_two_dates(self):
        items = [self.granule("2026-06-01"), self.granule("2026-06-13", mode="SHNA")]
        with patch.object(cmr, "search", return_value=items):
            with self.assertRaises(ValueError):
                discover.plan((0, 0, 0.1, 0.1), "2026-06-01", "2026-06-30")

    def test_invalid_request_rejected_before_network(self):
        with patch.object(cmr, "search") as search:
            for bbox in ((0, 0, 0, 1), (0, -91, 1, 1), (0, 0, float("nan"), 1), (180, 0, -180, 1)):
                with self.assertRaises(ValueError):
                    discover.plan(bbox, "2026-06-01", "2026-06-30")
            with self.assertRaises(ValueError):
                discover.plan((0, 0, 1, 1), "2026-07-01", "2026-06-01")
            search.assert_not_called()

    def test_antimeridian_overlap(self):
        self.assertAlmostEqual(discover.overlap_fraction((179.9, 0, -179.9, 1), (179, -1, -179, 2)), 1)

    def test_identity_includes_dates_and_product(self):
        site = {"id": "a", "label": "A", "roi": [0, 0, 1, 1], "dates": ["2026-06-01"]}
        self.assertNotEqual(analyze.config_hash(site), analyze.config_hash({**site, "dates": ["2026-06-13"]}))

    def test_vertical_mode_does_not_request_a_nonexistent_hh_band(self):
        items = [self.granule(day, mode="DVDV") for day in ("2026-06-01", "2026-06-13")]
        with patch.object(cmr, "search", return_value=items):
            site = discover.plan((0, 0, 0.1, 0.1), "2026-06-01", "2026-06-30")
        self.assertEqual(site["polarization"], "VVVV")

    def test_extraction_keeps_discoverys_covering_duplicate(self):
        items = [self.granule(day) for day in ("2026-06-01", "2026-06-13")]
        partial = {**self.granule("2026-06-01", (0, 0, 0.001, 0.001)), "title": "z-partial"}
        with patch.object(cmr, "search", return_value=items + [partial]):
            site = discover.plan((0, 0, 0.1, 0.1), "2026-06-01", "2026-06-30")
            selected = extract.find_granules(site)
        self.assertEqual(selected["2026-06-01"]["title"], items[0]["title"])


class ExtractionTests(unittest.TestCase):
    def test_earthdata_token_is_not_requested_for_untrusted_hosts(self):
        with patch.object(remote, "earthdata_token", side_effect=AssertionError("credential access is forbidden")):
            with self.assertRaises(ValueError):
                remote.open_remote("https://untrusted.example/source.h5")

    def test_southern_utm_uses_false_northing(self):
        x, y = projection.Projector(32756).forward(153, -27)
        self.assertAlmostEqual(x, 500000, places=2)
        self.assertAlmostEqual(y, 7013564.7574, places=2)

    def test_geometry_uses_pixel_edges_and_equal_area_cells(self):
        geometry = extract.grid_geometry({"roi": [-180, -89, 180, 89]},
                                         np.array([5., 15., 25., 35.]),
                                         np.array([35., 25., 15., 5.]), 32646, (0, 4, 0, 4, 2))
        np.testing.assert_array_equal(geometry["transform"], [20, 0, 0, 0, -20, 40])
        self.assertEqual(geometry["roi_mask"].shape, (2, 2))
        self.assertTrue(np.all((geometry["pixel_area_m2"] > 390) & (geometry["pixel_area_m2"] < 410)))

    def test_grid_signature_checks_y_spacing_and_all_coordinates(self):
        x, y = np.array([1., 2., 3.]), np.array([3., 2., 1.])
        self.assertNotEqual(extract.grid_signature(x, y, 32646), extract.grid_signature(x, y * 2 - 3, 32646))
        self.assertNotEqual(extract.grid_signature(x, y, 32646), extract.grid_signature(np.array([1., 2., 3.1]), y, 32646))

    def test_reads_each_granules_grid_instead_of_reusing_reference(self):
        x, y = np.arange(4.), np.arange(4.)[::-1]
        reference = (x, y, 32646, extract.grid_signature(x, y, 32646))
        handle = SimpleNamespace(close=lambda: None)
        with TemporaryDirectory() as folder, patch.object(extract, "open_remote", return_value=handle), \
                patch.object(extract, "read_grid", return_value=(x + 1, y, 32646)) as read:
            with self.assertRaisesRegex(ValueError, "grid"):
                extract.extract_one({"id": "test"}, {"date": "2026-06-01", "data_url": "unused"}, Path(folder), reference)
            read.assert_called_once_with(handle)

    def test_refuses_silent_window_crop(self):
        with self.assertRaises(ValueError):
            extract.centered_window(0, 1024, 512)

    def test_roi_larger_than_source_grid_is_not_silently_clipped(self):
        with self.assertRaisesRegex(ValueError, "grid"):
            extract.compute_window({"roi": [0, 0, 1, 1], "read_px": 100, "target_px": 100},
                                   np.array([5., 15., 25.]), np.array([25., 15., 5.]), 3857)

    def test_invalid_mask_fill_is_not_valid_data(self):
        power = np.ones((2, 3))
        mask = np.array([[0, 1, 2], [3, 255, 1]], dtype=np.uint8)
        error = np.array([[0, 0, 0], [0, 0, 2]], dtype=np.uint8)
        result = extract.valid_samples(power, mask, error)
        np.testing.assert_array_equal(result, [[False, True, True], [True, False, False]])

    def test_exception_mask_preserves_uint16_polarization_validity(self):
        exceptions = np.array([512, 256, 514, 65535], dtype=np.uint16)
        result = extract.valid_samples(np.ones(4), np.ones(4), exceptions, polarization="HV")
        np.testing.assert_array_equal(result, [True, False, False, False])

    def test_block_reduction_rejects_any_flagged_sample(self):
        power = np.ones((2, 2))
        valid = np.array([[True, True], [True, False]])
        self.assertTrue(np.isnan(extract.block_reduce(power, valid, 2)).all())

    def test_unverified_cache_cannot_be_published(self):
        with TemporaryDirectory() as folder:
            np.savez(Path(folder) / "2026-06-01.npz", db=np.zeros((2, 2)))
            with self.assertRaisesRegex(ValueError, "verified"):
                stats.load_date(Path(folder), "2026-06-01")

    def test_migration_rereads_power_when_old_blocks_contain_invalid_samples(self):
        x, y = np.array([5., 15., 25., 35.]), np.array([35., 25., 15., 5.])
        projector = projection.Projector(3857)
        west, south = projector.inverse(0.2, 0.2)
        east, north = projector.inverse(39.8, 39.8)
        site = {"id": "test", "roi": [west, south, east, north], "product": "nisar-gcov-provisional",
                "polarization": "HVHV", "polarization_label": "HV", "read_px": 4, "target_px": 2}
        granule = {"date": "2026-06-01", "acquired_at": "2026-06-01T00:00:00Z", "title": "same-source", "data_url": "unused"}
        with TemporaryDirectory() as folder, patch.object(config, "CACHE", Path(folder)):
            legacy = config.CACHE / "test"
            output = config.cache_dir(site)
            output.mkdir(parents=True)
            extract.save_grid(legacy, x, y, 3857)
            corners = [projector.inverse(float(x[i]), float(y[j])) for i, j in ((0, 0), (3, 0), (3, 3), (0, 3))]
            np.savez(legacy / "2026-06-01.npz", db=np.zeros((2, 2), np.int16), granule="same-source", polarization="HV",
                     factor=2, read_shape=[4, 4], corners=corners, valid8=np.array([[191, 255], [255, 255]], np.uint8))
            handle = h5py.File("memory", "w", driver="core", backing_store=False)
            for key, values in (("xCoordinates", x), ("yCoordinates", y), ("mask", np.ones((4, 4), np.uint8)),
                                ("inputDataExceptionMask", np.zeros((4, 4), np.uint8)), ("numberOfLooks", np.full((4, 4), 5.))):
                handle.create_dataset(extract.GRID + "/" + key, data=values)
            handle.create_dataset(extract.GRID + "/projection", data=0).attrs["epsg_code"] = 3857
            power = np.ones((4, 4), np.float32)
            power[0, 0] = np.nan
            handle.create_dataset(extract.GRID + "/HVHV", data=power)
            for key, value in {"radiometricTerrainCorrectionApplied": "True", "rtc/outputBackscatterNormalizationConvention": "gamma0",
                               "rtc/outputBackscatterExpressionConvention": "Linear power"}.items():
                handle.create_dataset(extract.PARAMETERS + key, data=np.bytes_(value))
            with patch.object(extract, "open_remote", return_value=handle):
                extract.extract_one(site, granule, output, (x, y, 3857, extract.grid_signature(x, y, 3857)))
            with np.load(output / "2026-06-01.npz") as data:
                self.assertFalse(bool(data["reused_verified_power"]))
                self.assertFalse(data["valid"][0, 0])
                self.assertEqual(int(data["valid"].sum()), 3)


class StatisticsTests(unittest.TestCase):
    def test_single_date_log_gamma_variance_not_double_counted(self):
        expected = 10 / np.log(10) * np.sqrt(polygamma(1, 5.))
        self.assertAlmostEqual(float(stats.sigma_db(5)), expected)
        self.assertTrue(np.isnan(stats.sigma_db(0)))

    def test_composite_masks_invalid_finite_pixels_and_does_not_invent_looks(self):
        entries = [(np.full((2, 2), value), np.full((2, 2), valid), np.full((2, 2), 5.))
                   for value, valid in ((-20., True), (100., False), (-22., True))]
        db, valid, looks = stats.composite(entries)
        np.testing.assert_allclose(db, -21)
        np.testing.assert_allclose(looks, 5)
        self.assertTrue(valid.all())

    def test_change_threshold_is_local_to_valid_look_counts(self):
        a = np.zeros((1, 3))
        valid = np.ones((1, 3), dtype=bool)
        looks = np.array([[100., 1., 0.]])
        _, changed, _, _ = stats.change(a, valid, looks, a + 3, valid, looks, 2.5)
        np.testing.assert_array_equal(changed, [[True, False, False]])

    def test_cluster_totals_not_truncated_to_top_twelve(self):
        mask = np.zeros((4, 70), dtype=bool)
        for x in range(0, 70, 5):
            mask[:2, x:x + 2] = True
        found = stats.clusters(mask, 20, min_area_m2=400)
        self.assertEqual(len(found), 14)
        self.assertAlmostEqual(sum(cluster["pixels"] for cluster in found) * 400 / 1e6, 0.0224)

    def test_retained_cluster_ids_still_point_to_the_source_pixels(self):
        mask = np.zeros((10, 10), bool)
        mask[0, 0] = True
        mask[5:9, 5:9] = True
        found = stats.clusters(mask, 20)
        labels, _ = ndimage.label(mask, structure=np.ones((3, 3)))
        retained = np.isin(labels, [item["id"] for item in found])
        self.assertFalse(retained[0, 0])
        self.assertEqual(int(retained.sum()), 16)

    def test_area_uses_equal_area_weights_and_retained_mask(self):
        mask = np.array([[True, True, False], [False, False, True]])
        area = np.array([[100., 200., 0.], [0., 0., 400.]])
        self.assertAlmostEqual(stats.mask_area_km2(mask, 20, pixel_area_m2=area), 0.0007)
        filtered = stats.cluster_mask(mask, 20, min_area_m2=800, pixel_area_m2=area)
        self.assertFalse(filtered.any())

    def test_unknown_pixels_cannot_be_filled_as_water(self):
        db = np.full((15, 15), -25.)
        valid = np.ones(db.shape, bool)
        valid[7, 7] = False
        mask, _ = stats.water_mask(db, valid, -20)
        self.assertFalse(mask[7, 7])
        with self.assertRaises(ValueError):
            stats.water_extent((db, np.zeros(db.shape, bool)), 20)

    def test_empty_threshold_cannot_fabricate_water(self):
        with self.assertRaises(ValueError):
            stats.otsu_threshold(np.array([]))

    def test_sensitivity_bounds_keep_enough_precision_for_small_areas(self):
        db = np.zeros((24, 24))
        db[6:16, 6:16] = -25
        extent = stats.water_extent((db, np.ones(db.shape, bool)), 20, pixel_area_m2=np.full(db.shape, 394.))
        self.assertLessEqual(extent["low_km2"], extent["area_km2"])
        self.assertGreaterEqual(extent["high_km2"], extent["area_km2"])


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        root = Path(self.folder.name)
        for name in ("CACHE", "PUBLIC"):
            patcher = patch.object(config, name, root / name.lower())
            patcher.start()
            self.addCleanup(patcher.stop)
        self.site = {**config.SITES["kuakata-bangladesh"], "id": "test", "label": "Test",
                     "product": "nisar-gcov-provisional", "collection": config.COLLECTION_SHORT,
                     "dates": ["2026-06-18", "2026-06-30"], "date_window": ["2026-06-01", "2026-06-30"]}

    def write_date(self, day, db, valid=None, signature="grid"):
        path = config.cache_dir(self.site)
        path.mkdir(parents=True, exist_ok=True)
        valid = np.ones(db.shape, bool) if valid is None else valid
        np.savez(path / f"{day}.npz", db=(db * 100).astype(np.int16), valid=valid,
                 looks=np.full(db.shape, 5.), roi_mask=np.ones(db.shape, bool), pixel_area_m2=np.full(db.shape, 400.),
                 cache_version=3, grid_verified=True, request_hash=day, signature=signature,
                 acquired_at=f"{day}T23:21:00Z", granule=f"NISAR_L2_PR_GCOV_024_069_A_013_4005_DHDH_A_{day.replace('-', '')}T232100_end_P05023_N_F_J_001",
                 source_url="https://nisar.asf.earthdatacloud.nasa.gov/source.h5", polarization="HV",
                 product="nisar-gcov-provisional", quality_dtype="uint8", processing=json.dumps({"noiseCorrectionApplied": "False"}),
                 epsg=32646, spacing_m=20., native_quality_fraction=float(valid.mean()), roi=self.site["roi"],
                 transform=[20, 0, 200000, 0, -20, 2420000],
                 corners=[[90.09, 21.86], [90.10, 21.86], [90.10, 21.85], [90.09, 21.85]],
                 lookup=np.zeros((2, 2, 2)))

    def test_geometry_mismatch_cannot_pass_on_shape_alone(self):
        db = np.full((24, 24), -20.)
        self.write_date(self.site["dates"][0], db)
        self.write_date(self.site["dates"][1], db, signature="shifted-grid")
        with self.assertRaisesRegex(ValueError, "grid"):
            analyze.analyze_site(self.site)

    def test_water_and_time_series_use_the_same_common_footprint(self):
        db = np.full((24, 24), -25.)
        db[:, 17:] = -8
        valid = np.ones(db.shape, bool)
        valid[:, :9] = False
        self.write_date(self.site["dates"][0], db)
        self.write_date(self.site["dates"][1], db, valid)
        result = analyze.analyze_site(self.site)
        water = next(claim for claim in result["claims"] if claim["id"] == "water_extent_change")
        self.assertEqual(water["value"], 0)
        self.assertAlmostEqual(result["change"]["common_valid_fraction"], 0.625)
        self.assertEqual(len(result["time_series"]), 2)
        self.assertEqual(result["time_series"][0]["water_km2"], result["time_series"][1]["water_km2"])
        self.assertIn("sensitivity", water)

    def test_opposite_sign_fragments_cannot_combine_to_pass_the_area_filter(self):
        a, b = np.zeros((24, 24)), np.zeros((24, 24))
        b[5:12, 5] = 20
        b[5:12, 6] = -20
        for day, db in zip(self.site["dates"], (a, b)):
            self.write_date(day, db)
        result = analyze.analyze_site(self.site)
        claim = next(claim for claim in result["claims"] if claim["id"] == "retained_brightness_change_area")
        self.assertEqual(claim["value"], 0)

    def test_incomplete_requested_dates_fail_closed(self):
        self.write_date(self.site["dates"][0], np.zeros((24, 24)))
        with self.assertRaisesRegex(ValueError, "incomplete"):
            analyze.analyze_site(self.site)

    def test_index_refuses_unattempted_reference_checks(self):
        import publish
        for day in self.site["dates"]:
            self.write_date(day, np.full((24, 24), -20.))
        manifest = analyze.analyze_site(self.site)
        with self.assertRaisesRegex(ValueError, "reference"):
            publish.build_index([manifest])

    def test_identical_reanalysis_preserves_reference_evidence_but_new_identity_does_not(self):
        for day in self.site["dates"]:
            self.write_date(day, np.full((24, 24), -20.))
        first = analyze.analyze_site(self.site)
        first["validation"] = {"status": "attempted", "checked_at": "2026-11-01T00:00:00Z", "references": [], "maturity": None}
        path = config.PUBLIC / self.site["id"] / "manifest.json"
        path.write_text(json.dumps(first), encoding="utf-8")
        self.assertEqual(analyze.analyze_site(self.site)["validation"]["status"], "attempted")
        self.assertEqual(analyze.analyze_site({**self.site, "label": "New identity"})["validation"]["status"], "unchecked")


if __name__ == "__main__":
    unittest.main()
