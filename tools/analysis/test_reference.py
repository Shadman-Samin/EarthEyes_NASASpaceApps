"""Reference checks exercise missing coverage and independent class agreement."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

import validate


class ReferenceTests(unittest.TestCase):
    def test_container_signature_is_reused_for_sibling_assets(self):
        first = "https://fixture.blob.core.windows.net/data/a.tif"
        second = "https://fixture.blob.core.windows.net/data/b.tif"
        def response(_url, params, timeout):
            return SimpleNamespace(status_code=200, raise_for_status=lambda: None,
                                   json=lambda: {"href": params["href"] + "?sr=c&se=2099-01-01T00%3A00%3A00Z&sig=test"})
        with patch.object(validate.requests, "get", side_effect=response) as get:
            validate.signed(first)
            result = validate.signed(second)
        self.assertTrue(result.startswith(second + "?"))
        self.assertEqual(get.call_count, 1)

    def test_class_agreement_excludes_unknown_and_reports_direction(self):
        reference = np.array([True, False, True, True])
        nisar = np.array([True, True, False, False])
        result = validate.scores(reference, nisar, np.array([True, True, False, False]))
        self.assertEqual(result["precision"], 0.5)
        self.assertEqual(result["recall"], 1)
        self.assertEqual(result["iou"], 0.5)

    def test_sentinel2_reflectance_uses_offsets_and_preserves_nodata(self):
        result = validate.reflectance(np.array([0., 1000., 11000.]), 10000, -1000)
        self.assertTrue(np.isnan(result[0]))
        np.testing.assert_allclose(result[1:], [0, 1])

    def test_absent_reference_scenes_never_count_as_comparisons(self):
        site = {"roi": [90, 21, 91, 22]}
        manifest = {"dates": [{"date": "2026-06-18"}, {"date": "2026-06-30"}]}
        with patch.object(validate, "search", return_value=[]):
            result = validate.compare_sensor(site, manifest, "sentinel-2-l2a")
        self.assertEqual(result["compared_dates"], 0)
        self.assertEqual(result["attempted_dates"], 2)
        self.assertTrue(all(row["status"] == "no_scene" for row in result["dates"]))


if __name__ == "__main__":
    unittest.main()
