#!/usr/bin/env python3
"""Fails the build when the web app's initial download grows past its budget.

Bundle size is the one performance number that only ever moves in the wrong
direction, and it does so one innocent import at a time. `vite build` prints
the sizes but nothing reads them, so a 300 kB entry chunk becomes a 900 kB one
across a dozen PRs that each looked fine.

Only the EAGER chunks count — the entry plus everything it reaches through
STATIC imports. Lazily-loaded route chunks (see src/routes/router.tsx) are
deliberately excluded: maplibre alone is ~250 kB gzipped and is fetched only by
whoever opens /harta. Budgeting it would either fail permanently or force the
limit so high it stops meaning anything.

**The eager set is derived, not guessed from file names** (TODO-47). It used to
be a list of name patterns anchored on `index-*`, which assumed only the app
entry is ever named that. Rollup breaks the assumption: a chunk reached only
through a dynamic import is named after ITS entry module, so any dependency
whose entry file is called `index` emits a second `index-<hash>.js` — and the
budget then charged the initial download for weight no first-paint ever fetches.
So instead:

  1. `dist/index.html` names the real entry — the `<script type="module">`.
  2. Walk that file's static `import` / `export … from` specifiers, and theirs,
     transitively. `import(...)` is a code-split boundary and is NOT followed.
  3. Any `<link rel="modulepreload">` in the same HTML is eager by definition
     (the browser fetches it on first paint), so it joins the set too.

Everything else under `assets/` is reported as lazy and not budgeted.

Ambiguity resolves toward FAILING: the specifier regex deliberately over-matches
(a false positive over-counts, which can only fail a build that should pass; a
missed static import would under-count, which would pass one that should fail),
and a missing or entry-less `index.html` is an error rather than an empty set.

Gzip, because that is what actually crosses the wire. JS only — the stylesheet
is small and has never been the thing that drifts.

    python3 .github/scripts/bundle_budget.py web/dist
"""

from __future__ import annotations

import gzip
import os
import re
import sys
from pathlib import Path

# The entry script and any module the browser is told to preload. Both are
# emitted by Vite into dist/index.html; `type="module"` and `rel="modulepreload"`
# are what make them first-paint fetches.
ENTRY_SCRIPT_RE = re.compile(
    r"""<script\b[^>]*\btype\s*=\s*["']module["'][^>]*>""", re.IGNORECASE
)
MODULEPRELOAD_RE = re.compile(
    r"""<link\b[^>]*\brel\s*=\s*["']modulepreload["'][^>]*>""", re.IGNORECASE
)
SRC_RE = re.compile(r"""\bsrc\s*=\s*["']([^"']+)["']""", re.IGNORECASE)
HREF_RE = re.compile(r"""\bhref\s*=\s*["']([^"']+)["']""", re.IGNORECASE)

# A STATIC import specifier in Rollup's output:
#     import"./a.js"            import{x}from"./a.js"
#     import*as n from"./a.js"  export{x}from"./a.js"   export*from"./a.js"
# `import("./a.js")` does NOT match — a `(` cannot appear between `import` and
# the quote, and the clause before `from` may not contain one either. That is
# the whole point: a dynamic import is a code-split boundary, not eager weight.
STATIC_IMPORT_RE = re.compile(
    r"""\b(?:import|export)\s*(?:[\w$*{},\s]*?\bfrom\s*)?["']([^"']+)["']"""
)

# Roughly 25% headroom over the current ~125 kB. Tight enough to catch an
# accidental eager import of something large, loose enough that ordinary
# feature work does not trip it. Raise it deliberately, in a commit that says
# what grew and why — never to make a red build green.
BUDGET_GZIP_KB = 160.0


def gzip_kb(path: Path) -> float:
    return len(gzip.compress(path.read_bytes(), 9)) / 1024


def resolve_html_ref(dist: Path, ref: str) -> Path | None:
    """A src/href from index.html to a file inside dist, or None if external."""
    if "://" in ref or ref.startswith("//") or ref.startswith("data:"):
        return None
    ref = ref.split("?", 1)[0].split("#", 1)[0]
    # Vite's default base is absolute ("/assets/…"); a relative base gives
    # "./assets/…" or "assets/…". Both are rooted at dist, where index.html is.
    return (dist / ref.lstrip("/")).resolve()


def entry_modules(dist: Path) -> tuple[list[Path], list[str]]:
    """Eager roots named by dist/index.html, plus anything it named externally."""
    html = (dist / "index.html").read_text(encoding="utf-8")
    roots: list[Path] = []
    external: list[str] = []

    refs = [
        (SRC_RE.search(tag), tag) for tag in ENTRY_SCRIPT_RE.findall(html)
    ] + [(HREF_RE.search(tag), tag) for tag in MODULEPRELOAD_RE.findall(html)]

    for match, _tag in refs:
        if not match:
            continue
        ref = match.group(1)
        path = resolve_html_ref(dist, ref)
        if path is None:
            external.append(ref)
        elif path.suffix == ".js" and path not in roots:
            roots.append(path)
    return roots, external


def walk_static_graph(roots: list[Path]) -> tuple[set[Path], list[str]]:
    """Transitive closure over STATIC imports only. Dynamic imports stop here."""
    seen: set[Path] = set()
    unresolved: list[str] = []
    queue = list(roots)

    while queue:
        current = queue.pop()
        if current in seen:
            continue
        if not current.is_file():
            unresolved.append(str(current))
            continue
        seen.add(current)

        source = current.read_text(encoding="utf-8", errors="replace")
        for spec in STATIC_IMPORT_RE.findall(source):
            if not spec.startswith("."):
                # A bare or absolute specifier is not a chunk Rollup emitted
                # next to this one; nothing to weigh.
                continue
            target = (current.parent / spec).resolve()
            if target.suffix == ".js" and target not in seen:
                queue.append(target)
    return seen, unresolved


def main() -> int:
    dist = Path(sys.argv[1] if len(sys.argv) > 1 else "web/dist").resolve()
    assets = dist / "assets"
    if not assets.is_dir():
        print(f"::error::No build output at {assets}. Run `npm run build` first.")
        return 1

    index_html = dist / "index.html"
    if not index_html.is_file():
        print(
            f"::error::No {index_html}. The eager set is read from the entry "
            "script it names, so the budget cannot be computed without it."
        )
        return 1

    roots, external = entry_modules(dist)
    if not roots:
        print(
            f"::error::No `<script type=\"module\">` entry found in {index_html}. "
            "Did the build output change shape?"
        )
        return 1

    eager_paths, unresolved = walk_static_graph(roots)
    for ref in external:
        print(f"::warning::{index_html.name} preloads an off-origin module: {ref}")
    for ref in unresolved:
        print(f"::warning::Static import resolves to a missing file: {ref}")

    eager = sorted(
        ((path.name, gzip_kb(path)) for path in eager_paths), key=lambda row: row[0]
    )
    eager_names = {name for name, _ in eager}
    lazy_total = sum(
        gzip_kb(file)
        for file in sorted(assets.glob("*.js"))
        if file.name not in eager_names
    )

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
