"""Site configuration for the NISAR change-analysis pipeline."""
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
REPO = TOOLS.parent.parent
CACHE = TOOLS / "cache"
PUBLIC = REPO / "public" / "analysis"

COLLECTION = "NISAR_L2_GCOV_PROVISIONAL_V1"
COLLECTION_SHORT = "NISAR_L2_GCOV_PROVISIONAL_V1"

SITES = {
    "kuakata-bangladesh": {
        "label": "Kuakata, Bangladesh",
        "module": "coastal",
        "phenomenon": "coastal-water-change",
        "roi": (90.0575, 21.7524, 90.2025, 21.8876),
        "relative_orbit": "069",
        "frame": "013",
        "direction": "A",
        "name_pattern": r"_069_A_013_4005_DHDH_A_",
        "polarization": "HVHV",
        "polarization_label": "HV",
        "dates": [
            "2026-06-18",
            "2026-06-30",
            "2026-07-12",
            "2026-07-24",
            "2026-08-17",
            "2026-08-29",
            "2026-09-10",
            "2026-09-22",
            "2026-10-04",
            "2026-10-16",
        ],
        "date_window": ("2026-06-01", "2026-10-31"),
        "read_px": 1536,
        "target_px": 768,
    },
    "jakobshavn-glacier": {
        "label": "Jakobshavn Isbrae, Greenland",
        "module": "ice",
        "phenomenon": "ice-surface-change",
        "roi": (-50.35, 69.08, -49.85, 69.26),
        "relative_orbit": "131",
        "frame": "037",
        "direction": "A",
        "name_pattern": r"_131_A_037_7700_SHNA_A_",
        "polarization": "HHHH",
        "polarization_label": "HH",
        "dates": [
            "2026-08-10",
            "2026-08-22",
            "2026-09-03",
            "2026-09-15",
            "2026-09-27",
            "2026-10-09",
            "2026-10-21",
        ],
        "date_window": ("2026-08-01", "2026-10-31"),
        "read_px": 1024,
        "target_px": 512,
    },
}
