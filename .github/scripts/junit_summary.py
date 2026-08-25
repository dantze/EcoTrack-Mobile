#!/usr/bin/env python3
"""Turn Gradle's JUnit XML into a GitHub job summary + check annotations.

Deliberately a checked-in script rather than a marketplace action: it needs no
`actions: write` permission, nothing to pin or re-verify on every Dependabot
bump, and it can be run locally exactly as CI runs it:

    python3 .github/scripts/junit_summary.py backend/build/test-results/test

Writes a Markdown table to $GITHUB_STEP_SUMMARY when that variable is set
(otherwise stdout), and emits one `::error` workflow command per failing test so
the failure shows up as an annotation on the run.

Exit code is 0 even when tests failed — the Gradle step is what fails the job.
This script only reports, so a parsing hiccup can never turn a green build red.
"""

from __future__ import annotations

import os
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

MAX_ANNOTATIONS = 40  # GitHub silently drops annotations past ~50 per step
MAX_MESSAGE_CHARS = 400


@dataclass
class Suite:
    name: str
    tests: int = 0
    failures: int = 0
    errors: int = 0
    skipped: int = 0
    time: float = 0.0
    failed_cases: list[tuple[str, str]] = field(default_factory=list)

    @property
    def bad(self) -> int:
        return self.failures + self.errors


def parse(directory: Path) -> list[Suite]:
    suites: list[Suite] = []
    for path in sorted(directory.glob("TEST-*.xml")):
        try:
            root = ET.parse(path).getroot()
        except ET.ParseError as exc:  # a truncated file must not break the job
            print(f"::warning::could not parse {path}: {exc}", file=sys.stderr)
            continue

        suite = Suite(
            name=root.get("name", path.stem),
            tests=int(root.get("tests", 0)),
            failures=int(root.get("failures", 0)),
            errors=int(root.get("errors", 0)),
            skipped=int(root.get("skipped", 0)),
            time=float(root.get("time", 0) or 0),
        )
        for case in root.iter("testcase"):
            for problem in list(case.findall("failure")) + list(case.findall("error")):
                message = (problem.get("message") or problem.text or "").strip()
                first_line = message.splitlines()[0] if message else problem.get("type", "failed")
                suite.failed_cases.append(
                    (f"{case.get('classname', suite.name)}.{case.get('name', '?')}",
                     first_line[:MAX_MESSAGE_CHARS])
                )
        suites.append(suite)
    return suites


def render(suites: list[Suite]) -> str:
    total = sum(s.tests for s in suites)
    bad = sum(s.bad for s in suites)
    skipped = sum(s.skipped for s in suites)
    seconds = sum(s.time for s in suites)

    if not suites:
        return "## Backend tests\n\n_No JUnit XML found._\n"

    icon = "❌" if bad else "✅"
    out = [
        "## Backend tests",
        "",
        f"{icon} **{total - bad - skipped} passed**, **{bad} failed**, "
        f"**{skipped} skipped** across {len(suites)} classes in {seconds:.1f}s",
        "",
    ]

    failing = [s for s in suites if s.bad]
    if failing:
        out += ["### Failures", "", "| Test | Message |", "| --- | --- |"]
        for suite in failing:
            for name, message in suite.failed_cases:
                out.append(f"| `{name}` | {md_cell(message)} |")
        out.append("")

    out += [
        "<details><summary>All test classes</summary>",
        "",
        "| Class | Tests | Failed | Skipped | Time |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for suite in sorted(suites, key=lambda s: (-s.bad, s.name)):
        short = suite.name.replace("com.example.damiProd.", "")
        out.append(f"| `{short}` | {suite.tests} | {suite.bad} | {suite.skipped} | {suite.time:.2f}s |")
    out += ["", "</details>", ""]
    return "\n".join(out)


def md_cell(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ").replace("\r", " ")


def annotate(suites: list[Suite]) -> None:
    emitted = 0
    for suite in suites:
        for name, message in suite.failed_cases:
            if emitted >= MAX_ANNOTATIONS:
                return
            flat = message.replace("\r", "").replace("\n", "%0A").replace("::", ":")
            print(f"::error title={name}::{flat}")
            emitted += 1


def main() -> int:
    directory = Path(sys.argv[1] if len(sys.argv) > 1 else "backend/build/test-results/test")
    if not directory.is_dir():
        print(f"::warning::no test results directory at {directory}")
        return 0

    suites = parse(directory)
    summary = render(suites)

    target = os.environ.get("GITHUB_STEP_SUMMARY")
    if target:
        with open(target, "a", encoding="utf-8") as handle:
            handle.write(summary + "\n")
    print(summary)

    annotate(suites)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
