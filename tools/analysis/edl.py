"""Local token loading. The token lives in a gitignored .env.* file."""
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def load_env_file(path):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def earthdata_token():
    load_env_file(REPO_ROOT / ".env.analysis")
    token = os.environ.get("EARTHDATA_TOKEN", "").strip()
    if not token:
        raise SystemExit("EARTHDATA_TOKEN is not set (expected in .env.analysis)")
    return token
