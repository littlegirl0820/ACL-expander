#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path
from shutil import copy2, copytree, rmtree


ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def main() -> None:
    if DIST.exists():
        rmtree(DIST)

    DIST.mkdir()
    copy2(ROOT / "index.html", DIST / "index.html")
    copy2(ROOT / "styles.css", DIST / "styles.css")
    copytree(ROOT / "src", DIST / "src")
    (DIST / ".nojekyll").write_text("", encoding="utf-8")


if __name__ == "__main__":
    main()
