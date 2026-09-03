#!/usr/bin/env python3
"""The index at the top of TODO.md must describe the items further down.

TODO.md is ~3500 lines. Its *Still open* list and *Index* table are the only way
to see the backlog without reading all of it, which makes them a new thing that
can be wrong — and they are maintained by hand. *How to use this file* says that
adding an item or changing its status is two edits; nothing enforced the second
one, so a drifted index was followed confidently, exactly as `doc_claims.py`'s
docstring argues about a stale pointer.

It had already drifted three times over by the time this was written (TODO-50):
ten missing index rows, four missing *Still open* entries, and a *Next free ID*
line four IDs behind reality — which nearly minted a SECOND TODO-64, the one
mistake this file cannot absorb, since an ID is a permanent name.

Six checks, all mechanical:

  1. every `### TODO-NN` heading is unique
  2. the index table lists every ID exactly once, and no others
  3. each row's status and title match its heading verbatim
  4. each row's section letter is the `## X.` section the item actually sits in
  5. the *Still open* list is exactly the non-DONE set (and the *Done, but
     flagged* list exactly the qualified-DONE set), with matching text
  6. the counts in the *Still open* heading, and the *Next free ID* line, agree
     with the items

A SIBLING of `doc_claims.py`, not an extension of it: that script deliberately
does not path-check TODO.md, because the backlog names deleted files on purpose.
This is a different question about the same file.

Dependency-free — runs from repo-hygiene.yml before any toolchain is installed.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TODO = ROOT / "TODO.md"

SECTION = re.compile(r"^## ([A-Z])\. ")
HEADING = re.compile(r"^### TODO-(\d+) `([^`]*)` (.+?)\s*$")
# Open items are bolded in the table; `**` is decoration, not part of the status.
ROW = re.compile(r"^\| TODO-(\d+) \| \*{0,2}`([^`]*)`\*{0,2} \| ([A-Z]) \| (.+?) \|\s*$")
BULLET = re.compile(r"^- \*\*TODO-(\d+)\*\* `([^`]*)` — (.+?) \*\(([A-Z])\)\*\s*$")
STILL_OPEN_HEADING = re.compile(r"^## Still open — (\d+) of (\d+)\s*$")
NEXT_FREE = re.compile(
    r"^\*\*Next free ID: TODO-(\d+)\.\*\* \(Highest used is TODO-(\d+)\.\)\s*$"
)

failures: list[str] = []


def fail(message: str) -> None:
    failures.append(message)


def region(lines: list[str], start_prefix: str) -> list[str]:
    """The lines under a `## ` heading, up to the next one. Empty if absent."""
    out: list[str] = []
    inside = False
    for line in lines:
        if line.startswith("## "):
            if inside:
                break
            inside = line.startswith(start_prefix)
            continue
        if inside:
            out.append(line)
    return out


def is_open(status: str) -> bool:
    """`[ ]`, `[~]`, `[?]` and `[POSTPONED]` are open; every `[DONE…]` is not."""
    return not status.strip("[] ").startswith("DONE")


def is_flagged(status: str) -> bool:
    """`[DONE — needs your eyes]` — done, but the doer wanted it looked at."""
    inner = status.strip("[] ")
    return inner.startswith("DONE") and inner != "DONE"


def bold(status: str) -> str:
    return "**" if is_open(status) else ""


if not TODO.is_file():
    print("todo-index: FAILED\n\n  ✗ TODO.md does not exist")
    sys.exit(1)

lines = TODO.read_text(encoding="utf-8").splitlines()

# ---------------------------------------------------------------- the items

headings: dict[int, tuple[str, str, str]] = {}  # id -> (status, title, section)
section = ""
for number, line in enumerate(lines, start=1):
    match = SECTION.match(line)
    if match:
        section = match.group(1)
        continue
    match = HEADING.match(line)
    if not match:
        if line.startswith("### TODO-"):
            fail(f"line {number}: heading is not `### TODO-NN `[status]` title`:\n      {line}")
        continue
    item = int(match.group(1))
    if item in headings:
        fail(
            f"line {number}: TODO-{match.group(1)} has a second `###` heading — "
            f"an ID is a permanent name and must not be reused"
        )
        continue
    if not section:
        fail(f"line {number}: TODO-{match.group(1)} sits above the first `## X.` section heading")
    headings[item] = (match.group(2), match.group(3), section)

if not headings:
    print("todo-index: FAILED\n\n  ✗ TODO.md has no `### TODO-NN` headings — has its format changed?")
    sys.exit(1)

# ---------------------------------------------------------------- the index

rows: dict[int, tuple[str, str, str]] = {}
for line in region(lines, "## Index"):
    if not line.startswith("| TODO-"):
        continue
    match = ROW.match(line)
    if not match:
        fail(f"index row is not `| TODO-NN | `[status]` | X | title |`:\n      {line}")
        continue
    item = int(match.group(1))
    if item in rows:
        fail(f"TODO-{match.group(1)} has two index rows")
        continue
    rows[item] = (match.group(2), match.group(4), match.group(3))

for item in sorted(set(headings) - set(rows)):
    status, title, letter = headings[item]
    fail(
        f"TODO-{item:02d} has no index row. Add, in ID order:\n"
        f"      | TODO-{item:02d} | {bold(status)}`{status}`{bold(status)} | {letter} | {title} |"
    )
for item in sorted(set(rows) - set(headings)):
    fail(f"TODO-{item:02d} has an index row but no `### TODO-{item:02d}` heading anywhere in the file")

for item in sorted(set(headings) & set(rows)):
    status, title, letter = headings[item]
    row_status, row_title, row_letter = rows[item]
    if row_status != status:
        fail(f"TODO-{item:02d}: the index says `{row_status}`, the item says `{status}`")
    if row_title != title:
        fail(
            f"TODO-{item:02d}: the index title differs from the heading\n"
            f"      index: {row_title}\n"
            f"      item:  {title}"
        )
    if row_letter != letter:
        fail(
            f"TODO-{item:02d}: the index files it under {row_letter}, but it sits in section "
            f"{letter}. Move the item, or fix the letter."
        )

# ------------------------------------------------------------- still open

still_open_lines = region(lines, "## Still open")
split = next(
    (i for i, line in enumerate(still_open_lines) if line.startswith("**Done, but flagged")),
    len(still_open_lines),
)


def bullets(source: list[str], where: str) -> dict[int, tuple[str, str, str]]:
    found: dict[int, tuple[str, str, str]] = {}
    for line in source:
        if not line.startswith("- **TODO-"):
            continue
        match = BULLET.match(line)
        if not match:
            fail(f"'{where}' entry is not `- **TODO-NN** `[status]` — title *(X)*`:\n      {line}")
            continue
        found[int(match.group(1))] = (match.group(2), match.group(3), match.group(4))
    return found


listed_open = bullets(still_open_lines[:split], "Still open")
listed_flagged = bullets(still_open_lines[split:], "Done, but flagged")

expected_open = {i for i, (status, _, _) in headings.items() if is_open(status)}
expected_flagged = {i for i, (status, _, _) in headings.items() if is_flagged(status)}


def compare(listed: dict[int, tuple[str, str, str]], expected: set[int], where: str) -> None:
    for item in sorted(expected - set(listed)):
        status, title, letter = headings[item]
        fail(
            f"TODO-{item:02d} is missing from '{where}'. Add:\n"
            f"      - **TODO-{item:02d}** `{status}` — {title} *({letter})*"
        )
    for item in sorted(set(listed) - expected):
        status = headings[item][0] if item in headings else "?"
        fail(f"TODO-{item:02d} is listed under '{where}' but its status is `{status}`")
    for item in sorted(expected & set(listed)):
        status, title, letter = headings[item]
        if listed[item] != (status, title, letter):
            fail(
                f"TODO-{item:02d}: its '{where}' entry disagrees with the heading\n"
                f"      listed: `{listed[item][0]}` — {listed[item][1]} *({listed[item][2]})*\n"
                f"      item:   `{status}` — {title} *({letter})*"
            )


compare(listed_open, expected_open, "Still open")
compare(listed_flagged, expected_flagged, "Done, but flagged by whoever did it")

# ------------------------------------------------------------- the counters

heading_line = next((line for line in lines if line.startswith("## Still open")), None)
if heading_line is None:
    fail("there is no `## Still open — N of M` heading")
else:
    match = STILL_OPEN_HEADING.match(heading_line)
    if not match:
        fail(f"the 'Still open' heading is not `## Still open — N of M`:\n      {heading_line}")
    elif (int(match.group(1)), int(match.group(2))) != (len(expected_open), len(headings)):
        fail(
            f"the 'Still open' heading says {match.group(1)} of {match.group(2)}; "
            f"there are {len(expected_open)} open of {len(headings)} items"
        )

next_free_line = next((line for line in lines if line.startswith("**Next free ID:")), None)
highest = max(headings)
if next_free_line is None:
    fail("there is no `**Next free ID: TODO-NN.** (Highest used is TODO-MM.)` line")
else:
    match = NEXT_FREE.match(next_free_line)
    if not match:
        fail(f"the 'Next free ID' line is not in the expected shape:\n      {next_free_line}")
    elif (int(match.group(1)), int(match.group(2))) != (highest + 1, highest):
        fail(
            f"the 'Next free ID' line says TODO-{match.group(1)}, highest TODO-{match.group(2)}; "
            f"the highest ID actually used is TODO-{highest:02d}, so the next free one is "
            f"TODO-{highest + 1:02d}. Trusting a stale line here is how an ID gets reused."
        )

# ------------------------------------------------------------------ report

if failures:
    print("\ntodo-index: FAILED\n")
    for entry in failures:
        print(f"  ✗ {entry}")
    print(
        "\nTODO.md's summaries are hand-maintained: adding an item or changing its status is\n"
        "TWO edits — the item, and its row in the Index (plus the 'Still open' list if the\n"
        "status crossed that line). Fix the summary, never the item's ID: IDs are permanent\n"
        "names and are deliberately not contiguous within a section."
    )
    sys.exit(1)

print(
    f"todo-index: OK ({len(headings)} item(s), {len(expected_open)} open, "
    f"index and 'Still open' agree; next free ID is TODO-{highest + 1:02d})."
)
