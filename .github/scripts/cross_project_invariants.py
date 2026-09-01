#!/usr/bin/env python3
"""Facts that must match across backend, web and mobile — and that nothing else checks.

The monorepo has three independently built projects and no shared schema. Some
values are therefore written out three times, as string literals, in three
languages. Nothing fails at build time when they drift:

  - a missing backend @JsonSubTypes entry throws at RUNTIME, on first
    deserialisation of that type
  - a missing web/mobile literal is SILENT — the type falls through switches
    and renders blank

The `order-type` skill lists the files to touch together. This script is the
part a human can forget and CI cannot. It runs from repo-hygiene.yml, which has
no `paths:` filter, so a PR that changes only one project is still checked
against the other two.

Deliberately dependency-free and regex-based: it must run before any project's
toolchain is installed.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Statuses the backend has that the web union deliberately does not. The web
# summarizer collapses anything that is neither COMPLETED nor IN_PROGRESS to
# NEW, so the OUTCOME is identical and adding it to the union would be noise.
# Documented in OrderFulfilmentPolicy and in shared/order-lifecycle-cases.json.
BACKEND_ONLY_TASK_STATUSES = {"CANCELLED"}

failures: list[str] = []
notes: list[str] = []


def read(rel: str) -> str | None:
    path = ROOT / rel
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8")


def check(label: str, expected, actual, source: str) -> None:
    if expected == actual:
        return
    missing = sorted(set(expected) - set(actual))
    extra = sorted(set(actual) - set(expected))
    detail = []
    if missing:
        detail.append(f"missing {missing}")
    if extra:
        detail.append(f"unexpected {extra}")
    if not detail:  # same members, different order
        detail.append(f"order differs: {list(actual)} vs {list(expected)}")
    if isinstance(expected, set) or isinstance(actual, set):
        detail = [d for d in detail if not d.startswith("order differs")]
        if not detail:
            return  # a set comparison does not care about ordering
    failures.append(f"{label} ({source}): {', '.join(detail)}")


# ---------------------------------------------------------------------------
# Order type discriminator — the value duplicated in all three projects
# ---------------------------------------------------------------------------

def order_types_backend() -> list[str] | None:
    src = read("backend/src/main/java/com/example/damiProd/domain/Order.java")
    if src is None:
        failures.append("Order.java not found — the discriminator's source of truth is missing")
        return None
    block = re.search(r"@JsonSubTypes\(\{(.*?)\}\)", src, re.S)
    if not block:
        failures.append("Order.java has no @JsonSubTypes block — Jackson cannot round-trip subtypes")
        return None
    return re.findall(r'name\s*=\s*"([^"]+)"', block.group(1))


def order_types_web() -> list[str] | None:
    src = read("web/src/types/domain.ts")
    if src is None:
        failures.append("web/src/types/domain.ts not found")
        return None
    match = re.search(r"export const ORDER_TYPES\s*=\s*\[(.*?)\]", src, re.S)
    if not match:
        failures.append("web/src/types/domain.ts has no ORDER_TYPES array")
        return None
    return re.findall(r"'([^']+)'", match.group(1))


def order_types_mobile() -> list[str] | None:
    """Mobile declares the union independently, one `orderType:` literal per arm."""
    src = read("mobile/types/OrderTypes.ts")
    if src is None:
        # TODO-22 removes mobile's Sales section; the shared type may go with
        # it. A deleted file is a valid end state, not a failure.
        notes.append("mobile/types/OrderTypes.ts absent — skipped (expected once TODO-22 lands)")
        return None
    return re.findall(r"orderType:\s*'([^']+)'", src)


# Mobile has no single ORDER_TYPES constant — it has local copies, none typed
# against the union, so nothing there fails at compile time. The `order-type`
# skill calls mobile "the project most likely to be left behind"; these are the
# copies it names. Each is optional: TODO-22 deletes the screens holding them.
MOBILE_LOCAL_COPIES = [
    ("mobile/modals/OrderFilterModal.tsx", r"value:\s*'([^']+)'"),
    ("mobile/app/Sales/OrderDetails.tsx", r'"(Amplasari|Ridicari|Igienizari)"'),
]

backend_types = order_types_backend()

if backend_types:
    if len(set(backend_types)) != len(backend_types):
        failures.append(f"Order.java @JsonSubTypes has duplicates: {backend_types}")

    web_types = order_types_web()
    if web_types is not None:
        check("order types", backend_types, web_types, "web/src/types/domain.ts")

    mobile_types = order_types_mobile()
    if mobile_types is not None:
        check("order types", backend_types, mobile_types, "mobile/types/OrderTypes.ts")

    for rel, pattern in MOBILE_LOCAL_COPIES:
        src = read(rel)
        if src is None:
            notes.append(f"{rel} absent — skipped (expected once TODO-22 lands)")
            continue
        found = re.findall(pattern, src)
        # Filter to values that look like order types, so an unrelated `value:`
        # in the same file does not produce a false failure.
        found = {v for v in found if v in set(backend_types) or v.endswith(("ari", "uri"))}
        if not found:
            notes.append(f"{rel}: no order-type literals found — pattern may need updating")
            continue
        # These are scattered usages, not a canonical declaration, so a type may
        # legitimately appear many times or in any order. Completeness is the
        # property that matters: a type the backend has and this file never
        # mentions is one the screen silently cannot handle.
        check("order types", set(backend_types), found, rel)


# ---------------------------------------------------------------------------
# Task status — backend enum vs the web union
# ---------------------------------------------------------------------------

def task_statuses_backend() -> list[str] | None:
    src = read("backend/src/main/java/com/example/damiProd/domain/TaskStatus.java")
    if src is None:
        failures.append("TaskStatus.java not found")
        return None
    body = src.split("{", 1)[-1].rsplit("}", 1)[0]
    body = re.sub(r"//.*", "", body)
    return [t.strip() for t in body.split(",") if t.strip()]


def task_statuses_web() -> list[str] | None:
    src = read("web/src/types/domain.ts")
    if src is None:
        return None
    match = re.search(r"export const TASK_STATUSES\s*=\s*\[(.*?)\]", src, re.S)
    if not match:
        failures.append("web/src/types/domain.ts has no TASK_STATUSES array")
        return None
    return re.findall(r"'([^']+)'", match.group(1))


backend_statuses = task_statuses_backend()
web_statuses = task_statuses_web()

if backend_statuses and web_statuses:
    difference = set(backend_statuses) - set(web_statuses)
    if difference != BACKEND_ONLY_TASK_STATUSES:
        unexpected = sorted(difference - BACKEND_ONLY_TASK_STATUSES)
        gone = sorted(BACKEND_ONLY_TASK_STATUSES - difference)
        if unexpected:
            failures.append(
                f"task status: backend has {unexpected} that web does not. Either add it to "
                f"TASK_STATUSES in web/src/types/domain.ts, or — if the web summarizer should "
                f"keep collapsing it to NEW — add it to BACKEND_ONLY_TASK_STATUSES here and say "
                f"why in OrderFulfilmentPolicy."
            )
        if gone:
            failures.append(
                f"task status: {gone} is listed as backend-only here but is no longer missing "
                f"from web. Drop it from BACKEND_ONLY_TASK_STATUSES."
            )
    stray = set(web_statuses) - set(backend_statuses)
    if stray:
        failures.append(
            f"task status: web has {sorted(stray)} the backend enum does not — the backend would "
            f"reject it on a status write"
        )


# ---------------------------------------------------------------------------

for note in notes:
    print(f"  note: {note}")

if failures:
    print("\ncross-project-invariants: FAILED\n")
    for failure in failures:
        print(f"  ✗ {failure}")
    print(
        "\nThese values are duplicated across projects with no shared schema, so nothing "
        "else catches this.\nSee .claude/skills/order-type/SKILL.md for every file that "
        "moves together."
    )
    sys.exit(1)

print(f"cross-project-invariants: OK ({len(notes)} skipped, 0 mismatches).")
