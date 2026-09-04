#!/usr/bin/env python3
"""`ecotrack.*` properties that nothing reads.

Config outlives the feature it configured. When Google sign-in was removed, its
settings stayed behind in four files — application.properties, .env.example,
docker-compose.yml and deploy.yml — plus two GitHub repository secrets. Nothing
broke, which is exactly the problem: the next person to read `.env.example`
concludes Google sign-in is supported, and the secrets sit there as credentials
nothing uses.

Only `ecotrack.*` keys are checked. `spring.*`, `server.*` and friends are read
by the framework, not by our code, so absence from our sources means nothing.

A key counts as live if it appears anywhere in the backend Java sources —
`@Value("${...}")`, `@Scheduled(cron = "${...}")`, or an Environment lookup.
There are no `@ConfigurationProperties` classes in this codebase; if one is ever
added, prefix binding needs handling here.

Dependency-free — runs from repo-hygiene.yml before any toolchain is installed.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROPERTY_FILES = sorted((ROOT / "backend/src/main/resources").glob("application*.properties"))
JAVA_ROOT = ROOT / "backend/src/main/java"

# Where a stale key tends to have siblings. Reported alongside the dead key so
# the cleanup is one pass rather than four discoveries.
COMPANION_FILES = [
    ".env.example",
    "docker-compose.yml",
    "docker-compose.dev-hosted.yml",
    ".github/workflows/deploy.yml",
    ".github/workflows/deploy-mobile.yml",
    # Where an ecotrack.* key reaches PRODUCTION since TODO-71: main.tf sets the
    # container's env and the secret-backed ones, and the tfvars template is
    # where an operator would have copied a name from. Without these, a stale
    # key's siblings would be listed from the local stack only - which is now
    # the half that does not ship.
    "infra/main.tf",
    "infra/terraform.tfvars.example",
]

KEY = re.compile(r"^([a-z0-9.\-]*ecotrack\.[a-z0-9.\-]+)\s*=(.*)$")
ENV_VAR = re.compile(r"\$\{([A-Z0-9_]+)(?::[^}]*)?\}")


def java_sources() -> str:
    if not JAVA_ROOT.is_dir():
        return ""
    return "\n".join(
        p.read_text(encoding="utf-8", errors="replace") for p in JAVA_ROOT.rglob("*.java")
    )


JAVA = java_sources()

if "@ConfigurationProperties" in JAVA:
    print(
        "dead-config: SKIPPED — a @ConfigurationProperties class now binds whole prefixes, "
        "so key-by-key grepping would report false deaths. Teach this script prefix binding."
    )
    sys.exit(0)

declared: dict[str, tuple[str, str]] = {}  # key -> (value, file it came from)
for props in PROPERTY_FILES:
    rel = str(props.relative_to(ROOT))
    for line in props.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = KEY.match(line)
        if match:
            declared.setdefault(match.group(1), (match.group(2).strip(), rel))

dead: list[str] = []
for key, (value, source) in sorted(declared.items()):
    if key in JAVA:
        continue
    detail = [f"`{key}` (declared in {source}) is read by no Java source"]
    for env_var in ENV_VAR.findall(value):
        elsewhere = [
            rel
            for rel in COMPANION_FILES
            if (ROOT / rel).is_file() and env_var in (ROOT / rel).read_text(encoding="utf-8")
        ]
        if elsewhere:
            detail.append(f"      its env var {env_var} is also plumbed through: {', '.join(elsewhere)}")
    dead.append("\n".join(detail))

if dead:
    print("\ndead-config: FAILED\n")
    for entry in dead:
        print(f"  ✗ {entry}")
    print(
        "\nDelete the key and everything listed under it — including any GitHub repository\n"
        "secret it names. If the key is genuinely read some other way, add it to this\n"
        "script's allowlist with a note saying how."
    )
    sys.exit(1)

print(f"dead-config: OK ({len(declared)} ecotrack.* key(s) checked, all read).")
