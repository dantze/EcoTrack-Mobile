#!/usr/bin/env python3
"""Documentation that makes checkable claims must still be true.

CLAUDE.md is the reference for how this repo works, and the skills in
.claude/skills are instructions an agent follows literally. Both go stale
silently: nothing compiles them, and a wrong pointer is worse than no pointer
because it is followed confidently.

This has already bitten twice, which is why the script exists:

  - CLAUDE.md documented `ecotrack.security.enforce` as defaulting to `false`
    long after it was changed to `true`, in the section that calls itself "the
    single most important thing to understand before touching auth".
  - OrderFulfilmentPolicy's javadoc pointed at `web/src/features/map/data.ts`
    after the function moved to `web/src/lib/orderLifecycle.ts` — stale within
    the same afternoon it was written.

Two checks:
  1. every repo path named in the docs, and in source comments, resolves
  2. pinned numeric/string claims match the property files they describe

TODO.md is deliberately NOT path-checked: it is a historical log that refers to
deleted files on purpose ("`DriversPage.tsx` is gone").

Dependency-free — runs from repo-hygiene.yml before any toolchain is installed.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKIP_DIRS = {".git", "node_modules", "build", "dist", ".gradle", "__pycache__"}
SOURCE_SUFFIXES = (".java", ".ts", ".tsx", ".py", ".yml", ".yaml", ".json", ".properties", ".md")

failures: list[str] = []


def repo_files() -> set[str]:
    found = set()
    for path in ROOT.rglob("*"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.is_file():
            found.add(str(path.relative_to(ROOT)))
    return found


ALL_FILES = repo_files()
ALL_DIRS = {str(Path(f).parent) for f in ALL_FILES}


ALIASES = {
    "web": "web/src",      # `@/` -> src/   in web
    "mobile": "mobile",    # `@/` -> project root in mobile
}


def _suffix_match(candidate: str) -> bool:
    needle = "/" + candidate
    return candidate in ALL_FILES or any(f.endswith(needle) for f in ALL_FILES)


def resolves(token: str, from_file: str | None = None) -> bool:
    """Does this path reference point at something that exists?

    Handles the three ways this repo writes paths, all of which a naive
    existence check gets wrong:

      - `@/lib/orderLifecycle.ts` — the alias, which means `web/src/` in web
        and the project root in mobile (CLAUDE.md, Conventions)
      - `./enrollment.ts` — relative to the file whose comment names it
      - `backend/.../service/Foo.java` — a deliberately elided middle

    Docs also legitimately abbreviate, writing `service/TaskAccessPolicy.java`
    for the full package path, so a tail match is the honest rule. It still
    fails when the file is renamed or deleted, which is the case that matters.
    """
    token = token.strip().rstrip("/")
    token = re.sub(r"/\*\*?$", "", token)
    if not token:
        return True

    # `backend/.../service/Foo.java` — keep only the unambiguous tail.
    if "/.../" in token:
        token = token.split("/.../")[-1]

    if token.startswith("@/"):
        rest = token[2:]
        roots = list(ALIASES.values())
        if from_file:
            project = from_file.split("/")[0]
            if project in ALIASES:
                roots = [ALIASES[project]]
        return any(f"{root}/{rest}" in ALL_FILES for root in roots)

    # Only "./" and "../" are relative. A leading dot alone is a hidden
    # directory (`.github/workflows/ci-web.yml`), which is an ordinary path.
    if (token.startswith("./") or token.startswith("../")) and from_file:
        base = Path(from_file).parent
        try:
            resolved = (ROOT / base / token).resolve().relative_to(ROOT)
        except (ValueError, OSError):
            return False
        return str(resolved) in ALL_FILES

    return _suffix_match(token)


# ---------------------------------------------------------------------------
# 1. Paths named in prose
# ---------------------------------------------------------------------------

# Only inside backticks — these docs consistently quote paths that way — and
# only tokens ending in a real source suffix. A backticked `components/domain`
# or `DomainTests/OrderJsonSubTypesTest` is a directory or a class reference,
# not a filename, and guessing at those produces noise rather than signal.
BACKTICKED = re.compile(r"`([^`\n]+)`")
PATHLIKE = re.compile(r"^[@\w./*-]+$")

doc_files = ["CLAUDE.md"] + sorted(
    str(p.relative_to(ROOT)) for p in (ROOT / ".claude" / "skills").rglob("*.md")
)

for rel in doc_files:
    path = ROOT / rel
    if not path.is_file():
        continue
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        for token in BACKTICKED.findall(line):
            token = token.strip()
            if not PATHLIKE.match(token):
                continue
            if not re.sub(r"/\*\*?$", "", token.rstrip("/")).endswith(SOURCE_SUFFIXES):
                continue
            if not resolves(token, rel):
                failures.append(f"{rel}:{line_no}: names `{token}`, which does not exist")


# ---------------------------------------------------------------------------
# 2. Paths named in source comments — the stale-javadoc case
# ---------------------------------------------------------------------------

COMMENT_PATH = re.compile(r"[@\w./-]*[\w.-]+\.(?:java|ts|tsx|json|properties)\b")

for rel in sorted(ALL_FILES):
    if not rel.endswith((".java", ".ts", ".tsx")) or "/node_modules/" in rel:
        continue
    text = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
    for line_no, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if not stripped.startswith(("*", "//", "/*")):
            continue
        for token in COMMENT_PATH.findall(line):
            if "/" not in token:
                continue  # a bare `Foo.java` is a class reference, not a path
            if not resolves(token, rel):
                failures.append(
                    f"{rel}:{line_no}: comment points at `{token}`, which does not exist"
                )


# ---------------------------------------------------------------------------
# 3. Pinned claims — a documented value must match the property it describes
# ---------------------------------------------------------------------------

PROPS = ROOT / "backend/src/main/resources/application.properties"
CLAUDE_MD = ROOT / "CLAUDE.md"

# Prose wraps across lines, so a claim like "30-minute\naccess" must be matched
# against a whitespace-normalised copy or every pin is a false failure.
CLAUDE_TEXT = CLAUDE_MD.read_text(encoding="utf-8") if CLAUDE_MD.is_file() else ""
CLAUDE_FLAT = re.sub(r"\s+", " ", CLAUDE_TEXT)
# Emphasis lands anywhere in a claim ("**365-day**", "**defaults to `true`**"),
# so pin against a copy with the markers removed rather than trying to spell
# every placement in each regex.
CLAUDE_PLAIN = CLAUDE_FLAT.replace("*", "").replace("`", "")


def property_value(key: str) -> str | None:
    if not PROPS.is_file():
        return None
    for line in PROPS.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return None


# (property key, how the value must appear in CLAUDE.md, human hint)
PINNED = [
    (
        "ecotrack.security.enforce",
        lambda v: v in CLAUDE_PLAIN,
        "the enforcement-flag table must quote the real default, verbatim",
    ),
    (
        "ecotrack.security.access-token-ttl-minutes",
        lambda v: re.search(rf"\b{re.escape(v)}-minute access", CLAUDE_PLAIN),
        "the Tokens paragraph states the access-token TTL",
    ),
    (
        "ecotrack.security.refresh-token-ttl-days",
        lambda v: re.search(rf"\b{re.escape(v)}-day rotating refresh", CLAUDE_PLAIN),
        "the Tokens paragraph states the refresh-token TTL",
    ),
]

if CLAUDE_MD.is_file():
    for key, matcher, hint in PINNED:
        value = property_value(key)
        if value is None:
            failures.append(f"application.properties no longer defines `{key}`, which CLAUDE.md documents")
            continue
        if not matcher(value):
            failures.append(
                f"CLAUDE.md disagrees with application.properties on `{key}` "
                f"(actual value `{value}`) — {hint}"
            )


# ---------------------------------------------------------------------------
# 4. Pinned cross-references — a pointer must name a file that still HOLDS it
# ---------------------------------------------------------------------------

# Check 2 only proves the referenced file exists. That is not enough, and the
# case that motivated this script proves it: OrderFulfilmentPolicy's javadoc
# pointed at `web/src/features/map/data.ts`, which still exists — the FUNCTION
# had moved out of it to `web/src/lib/orderLifecycle.ts`. A path check passes
# happily while the pointer sends the next reader to the wrong file.
#
# So for the references that actually matter, pin the symbol too: the named
# file must exist AND define what the pointer claims is there.
#
# (file whose comments do the pointing, path it must name, symbols that path must define)
CROSS_REFERENCES = [
    (
        "backend/src/main/java/com/example/damiProd/service/OrderFulfilmentPolicy.java",
        "web/src/lib/orderLifecycle.ts",
        ["isFulfilled", "deriveLifecycle"],
    ),
    (
        "web/src/lib/orderLifecycle.ts",
        "shared/order-lifecycle-cases.json",
        [],
    ),
]

for source_rel, target_rel, symbols in CROSS_REFERENCES:
    source = ROOT / source_rel
    target = ROOT / target_rel
    if not source.is_file():
        failures.append(f"{source_rel} is gone — it is half of a pinned mirror pair")
        continue
    source_text = source.read_text(encoding="utf-8", errors="replace")
    if target_rel not in source_text:
        failures.append(
            f"{source_rel} no longer points at `{target_rel}`. These two are a deliberate "
            f"mirror pair; if one moved, update the pointer (and shared/README.md)."
        )
        continue
    if not target.is_file():
        failures.append(f"{source_rel} points at `{target_rel}`, which does not exist")
        continue
    target_text = target.read_text(encoding="utf-8", errors="replace")
    for symbol in symbols:
        if symbol not in target_text:
            failures.append(
                f"{source_rel} points at `{target_rel}` for `{symbol}`, but that file does not "
                f"define it — the pointer is stale even though the path still resolves"
            )


# ---------------------------------------------------------------------------

if failures:
    print("\ndoc-claims: FAILED\n")
    for failure in failures:
        print(f"  ✗ {failure}")
    print("\nDocs are followed literally by both humans and agents. Fix the doc, or the code.")
    sys.exit(1)

print(
    f"doc-claims: OK ({len(doc_files)} doc file(s), {len(PINNED)} pinned claim(s), "
    f"{len(CROSS_REFERENCES)} cross-reference(s), 0 problems)."
)
