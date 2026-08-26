#!/usr/bin/env python3
"""Fails the build when the web app's initial download grows past its budget.

Bundle size is the one performance number that only ever moves in the wrong
direction, and it does so one innocent import at a time. `vite build` prints
the sizes but nothing reads them, so a 300 kB entry chunk becomes a 900 kB one
across a dozen PRs that each looked fine.

Only the EAGER chunks count — the entry plus the shared vendor chunks it
imports. Lazily-loaded route chunks (see src/routes/router.tsx) are deliberately
excluded: maplibre alone is ~250 kB gzipped and is fetched only by whoever
opens /harta. Budgeting it would either fail permanently or force the limit so
high it stops meaning anything.

Gzip, because that is what actually crosses the wire.

    python3 .github/scripts/bundle_budget.py web/dist
"""

from __future__ import annotations

import gzip
import os
import re
import sys
from pathlib import Path

# Chunks fetched on first paint. Everything else is behind a dynamic import.
EAGER_CHUNK_PATTERNS = (
    re.compile(r"^index-[\w-]+\.js$"),
    re.compile(r"^react-[\w-]+\.js$"),
    re.compile(r"^query-[\w-]+\.js$"),
)

# Roughly 25% headroom over the current ~125 kB. Tight enough to catch an
# accidental eager import of something large, loose enough that ordinary
# feature work does not trip it. Raise it deliberately, in a commit that says
# what grew and why — never to make a red build green.
BUDGET_GZIP_KB = 160.0


def gzip_kb(path: Path) -> float:
    return len(gzip.compress(path.read_bytes(), 9)) / 1024


def main() -> int:
    dist = Path(sys.argv[1] if len(sys.argv) > 1 else "web/dist")
    assets = dist / "assets"
    if not assets.is_dir():
        print(f"::error::No build output at {assets}. Run `npm run build` first.")
        return 1

    eager: list[tuple[str, float]] = []
    lazy_total = 0.0
    for file in sorted(assets.glob("*.js")):
        size = gzip_kb(file)
        if any(pattern.match(file.name) for pattern in EAGER_CHUNK_PATTERNS):
            eager.append((file.name, size))
        else:
            lazy_total += size

    if not eager:
        print("::error::No eager chunks matched. Did the chunk naming change in vite.config.ts?")
        return 1

    total = sum(size for _, size in eager)
    lines = [
        "## Web bundle",
        "",
        f"**Initial download: {total:.1f} kB gzip** (budget {BUDGET_GZIP_KB:.0f} kB)",
        "",
        "| Eager chunk | gzip |",
        "|---|---|",
    ]
    lines += [f"| `{name}` | {size:.1f} kB |" for name, size in eager]
    lines.append(f"| **total** | **{total:.1f} kB** |")
    lines.append("")
    lines.append(f"Lazy route chunks (not counted): {lazy_total:.1f} kB gzip")

    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")
    print("\n".join(lines))

    if total > BUDGET_GZIP_KB:
        over = total - BUDGET_GZIP_KB
        print(
            f"::error::Initial bundle is {total:.1f} kB gzip, {over:.1f} kB over the "
            f"{BUDGET_GZIP_KB:.0f} kB budget. Either lazy-load what grew "
            "(src/routes/router.tsx shows the pattern) or raise BUDGET_GZIP_KB "
            "deliberately in .github/scripts/bundle_budget.py."
        )
        return 1

    print(f"\nbundle-budget: OK ({total:.1f} kB / {BUDGET_GZIP_KB:.0f} kB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
