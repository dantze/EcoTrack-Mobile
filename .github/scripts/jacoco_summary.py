#!/usr/bin/env python3
"""Summarise JaCoCo's CSV report into the GitHub job summary.

REPORT ONLY — there is no threshold and this never fails the build. See the
comment above the `jacoco` block in backend/build.gradle for why: a gate set at
today's coverage would either be meaningless or would start failing unrelated
PRs. The point is that the number is visible on every run so the trend is
obvious.

    python3 .github/scripts/jacoco_summary.py backend/build/reports/jacoco/test/jacocoTestReport.csv
"""

from __future__ import annotations

import csv
import os
import sys
from collections import defaultdict
from pathlib import Path

# Packages listed first in the per-package table, because they are where the
# business rules actually live.
INTERESTING = ("service", "scheduler", "domain", "repository", "config")


def pct(covered: int, missed: int) -> float:
    total = covered + missed
    return 100.0 * covered / total if total else 0.0


def bar(value: float, width: int = 20) -> str:
    filled = round(value / 100 * width)
    return "█" * filled + "░" * (width - filled)


def main() -> int:
    path = Path(
        sys.argv[1]
        if len(sys.argv) > 1
        else "backend/build/reports/jacoco/test/jacocoTestReport.csv"
    )
    if not path.is_file():
        print(f"::warning::no JaCoCo CSV at {path}")
        return 0

    packages: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    totals: dict[str, int] = defaultdict(int)

    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            package = row["PACKAGE"].replace("com.example.damiProd.", "") or "(root)"
            for key in ("INSTRUCTION_MISSED", "INSTRUCTION_COVERED",
                        "BRANCH_MISSED", "BRANCH_COVERED",
                        "LINE_MISSED", "LINE_COVERED"):
                value = int(row[key] or 0)
                packages[package][key] += value
                totals[key] += value

    line_pct = pct(totals["LINE_COVERED"], totals["LINE_MISSED"])
    branch_pct = pct(totals["BRANCH_COVERED"], totals["BRANCH_MISSED"])
    instr_pct = pct(totals["INSTRUCTION_COVERED"], totals["INSTRUCTION_MISSED"])

    out = [
        "## Backend coverage (JaCoCo)",
        "",
        "_Report only — no threshold gates this build._",
        "",
        f"`{bar(line_pct)}` **{line_pct:.1f}%** lines "
        f"({totals['LINE_COVERED']}/{totals['LINE_COVERED'] + totals['LINE_MISSED']}) · "
        f"**{branch_pct:.1f}%** branches · **{instr_pct:.1f}%** instructions",
        "",
        "<details><summary>By package</summary>",
        "",
        "| Package | Lines | Branches |",
        "| --- | ---: | ---: |",
    ]

    def sort_key(name: str) -> tuple[int, str]:
        for index, prefix in enumerate(INTERESTING):
            if name == prefix or name.startswith(prefix):
                return (index, name)
        return (len(INTERESTING), name)

    for name in sorted(packages, key=sort_key):
        stats = packages[name]
        out.append(
            f"| `{name}` | {pct(stats['LINE_COVERED'], stats['LINE_MISSED']):.1f}% "
            f"| {pct(stats['BRANCH_COVERED'], stats['BRANCH_MISSED']):.1f}% |"
        )
    out += ["", "</details>", ""]

    summary = "\n".join(out)
    target = os.environ.get("GITHUB_STEP_SUMMARY")
    if target:
        with open(target, "a", encoding="utf-8") as handle:
            handle.write(summary + "\n")
    print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
