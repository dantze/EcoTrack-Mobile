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


def strip_comments(src: str) -> str:
    """TypeScript source with // and /* */ removed. Crude — it does not know
    about strings containing "//" — which is the safe direction here: it can
    only hide a match, never invent one, and prose is what it must ignore."""
    return re.sub(r"//[^\n]*|/\*.*?\*/", "", src, flags=re.S)


def quoted(literal: str) -> str:
    """Matches `literal` as a quoted TS string, in any of the three quotes."""
    return "['\"`]" + re.escape(literal) + "['\"`]"


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


# Order types used to be declared a THIRD time, in mobile: its own union type
# plus two untyped local copies in the Sales screens. TODO-33 deleted the Sales
# and Technical sections — office work belongs to the web app now — so the
# duplication is down to backend + web.
#
# What replaces the old comparison is its inverse. The point of deleting those
# screens was that an order type stopped being a three-place edit, and a
# well-meaning new mobile screen would silently undo that: nothing in mobile is
# typed against the union, so a copy that falls behind renders blank rather
# than failing to compile. So instead of checking mobile's copy agrees, this
# checks there is no copy.
#
# Comments are stripped before matching, on purpose: a comment saying mobile no
# longer knows about order types is the thing this check wants to stay true.
MOBILE_ORDER_TYPE_EXEMPT = ("mobile/node_modules/",)

backend_types = order_types_backend()

if backend_types:
    if len(set(backend_types)) != len(backend_types):
        failures.append(f"Order.java @JsonSubTypes has duplicates: {backend_types}")

    web_types = order_types_web()
    if web_types is not None:
        check("order types", backend_types, web_types, "web/src/types/domain.ts")

    # Mobile must not name an order type at all (TODO-33).
    offenders: list[str] = []
    for path in sorted((ROOT / "mobile").glob("**/*.ts*")):
        rel = path.relative_to(ROOT).as_posix()
        if any(rel.startswith(prefix) for prefix in MOBILE_ORDER_TYPE_EXEMPT):
            continue
        code = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
        named = sorted(t for t in backend_types if re.search(quoted(t), code))
        if named:
            offenders.append(f"{rel}: {named}")
    if offenders:
        failures.append(
            "mobile names order types again — "
            + "; ".join(offenders)
            + ". TODO-33 removed Sales and Technical from mobile so that an order type is "
            "declared in two places and not three. Nothing in mobile is typed against the "
            "union, so a copy that falls behind renders blank instead of failing to compile. "
            "Put the screen in web/, or delete this check and record the decision."
        )


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
# The driver app's API surface
# ---------------------------------------------------------------------------
#
# SecurityConfig's role matrix carries this sentence:
#
#     PATCH /api/tasks/*/status and POST /api/tasks/*/photos accept
#     DRIVER/SALES/TECH/ADMIN (those two are the only writes the driver app
#     makes — a new mobile write needs a new row, above the catch-alls)
#
# Until TODO-33 that was a comment describing an intention, and mobile made
# fourteen other calls besides. With Sales and Technical deleted it is true,
# and this is what keeps it true: mobile's whole API surface is listed here,
# so a new call fails CI with the sentence it just falsified.
#
# The check is over PATHS, not verbs, because a mobile call's method is not
# always next to its path — `EnrollmentService` builds the whole RequestInit
# in a `jsonBody()` helper. A path allowlist is the stronger property anyway:
# it pins the reads too, and no verb can be used against a path that is not
# here.
#
# **When a driver screen legitimately needs a new endpoint**: add it below,
# and if it is a write, add the matching row to SecurityConfig's matrix ABOVE
# the catch-alls and update that sentence. That is the point of failing here.
MOBILE_API_PATHS = {
    # reads
    "/auth/me",
    "/employees/drivers",
    "/enrollment/status",
    "/orders/{}",
    "/routes/employee/{}",
    "/tasks/{}",
    "/tasks/{}/photos",
    "/tasks/employee/{}/date/{}",
    "/tasks/mine/date/{}",
    # writes — the two the sentence above is about…
    "/tasks/{}/status",
    # (POST /tasks/{}/photos shares its path with the read, listed above)
    # …plus the session plumbing, which is not "the driver app" doing
    # anything: getting a session, keeping it alive, and giving it back.
    "/auth/logout",
    "/auth/refresh",
    "/enrollment/claim",
    "/enrollment/request",
}

# Paths that look like API paths and are not: expo-router destinations.
# Every other route in this app starts with an uppercase segment (/Driver/…,
# /RoleSelection), which the lowercase-first-segment rule below already skips.
MOBILE_LOCAL_ROUTES = {"/", "/enrollment", "/office"}

# A quoted path whose first segment is lowercase: '/tasks/mine', or the
# template literal `/orders/${id}` with its placeholder still in it.
API_PATH_RE = re.compile(r"""['"`](/[a-z][^'"`\s]*)['"`]""")


def mobile_api_paths() -> set[str] | None:
    mobile = ROOT / "mobile"
    if not mobile.is_dir():
        notes.append("mobile/ absent — API surface check skipped")
        return None
    found: set[str] = set()
    for path in sorted(mobile.glob("**/*.ts*")):
        rel = path.relative_to(ROOT).as_posix()
        if "node_modules/" in rel or "__tests__/" in rel:
            continue
        # Skip dot-directories: tooling output, gitignored, not hand-written.
        #
        # This scans the FILESYSTEM, not the git index, so it sees whatever a
        # developer's tree happens to contain — and `mobile/.expo/types/router.d.ts`
        # is expo-router's generated typed-routes union, which spells every screen
        # as a template literal (`` `/enrollment${...}` ``). Two of those survived
        # normalisation and read as undeclared API calls.
        #
        # It could only ever fail LOCALLY: repo-hygiene.yml runs on a fresh
        # checkout with no npm install, so `.expo/` does not exist there. That is
        # the worst shape for a guard - green in CI, red on the machine of whoever
        # tries to check their work before pushing - and it went unnoticed because
        # nothing on that machine could run this script at all (TODO-86).
        if any(part.startswith(".") for part in rel.split("/")[:-1]):
            continue
        code = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
        for raw in API_PATH_RE.findall(code):
            # A template placeholder is one path parameter, whatever its name,
            # and a query string is not part of the path — the boot gate builds
            # "/office?roles=…" and that is a local route, not an endpoint.
            normalised = re.sub(r"\$\{[^}]*\}", "{}", raw).split("?", 1)[0]
            if normalised in MOBILE_LOCAL_ROUTES:
                continue
            found.add(normalised)
    return found


actual_paths = mobile_api_paths()
if actual_paths is not None:
    added = sorted(actual_paths - MOBILE_API_PATHS)
    gone = sorted(MOBILE_API_PATHS - actual_paths)
    if added:
        failures.append(
            f"mobile calls API paths that are not in its declared surface: {added}. "
            "The driver app is meant to make two writes and a handful of reads "
            "(TODO-33). If this is a real driver need, add it to MOBILE_API_PATHS "
            "here — and if it is a write, add its row to SecurityConfig's matrix "
            "above the catch-alls and fix the sentence there that says those two "
            "are the only ones."
        )
    if gone:
        notes.append(
            f"mobile no longer calls {gone} — drop them from MOBILE_API_PATHS here"
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
