---
name: verify
description: Use before committing, pushing, or opening a PR in this monorepo, and whenever asked to "check", "verify", "run the tests", "run CI", or "make sure this passes". Maps the changed files to exactly the checks CI will run — backend Gradle, web lint/typecheck/test/build/bundle-budget, mobile lint/typecheck/test, and the repo-hygiene script that runs on EVERY pull request. Use it instead of guessing which project's commands to run or running all three.
---

# Verify a change the way CI will

CI is four workflows. Three are path-filtered per project; the fourth runs on
every PR regardless. Running everything wastes minutes (`./gradlew build` is the
long pole); running the wrong subset produces a red PR.

## Step 1 — what changed

```bash
git diff --name-only origin/main...
```

## Step 2 — map paths to checks

Run every row whose paths your diff touches. **These are the CI `paths:`
filters verbatim** — if a row matches, that workflow will run on your PR.

| Changed | Workflow | Run |
|---|---|---|
| `backend/**`, `.github/workflows/ci-backend.yml`, `.github/scripts/junit_summary.py`, `.github/scripts/jacoco_summary.py` | `ci-backend.yml` | backend block below |
| `web/**`, `.github/workflows/ci-web.yml`, `.github/scripts/bundle_budget.py` | `ci-web.yml` | web block below |
| `mobile/**`, `.github/workflows/ci-mobile.yml` | `ci-mobile.yml` | mobile block below |
| **anything at all** | `repo-hygiene.yml` | hygiene block below — always |

Always run from the project subdirectory, never the repo root.

### backend

```bash
cd backend && ./gradlew build --no-daemon
```

`build` compiles and runs the whole suite — that is the entire CI job. While
iterating, narrow it:

```bash
./gradlew test --tests "*TokenServiceTest"
./gradlew test --tests "*OrderServiceTest.createOrder_shouldThrowWhenClientNotFound"
```

but run the full `build` once before pushing.

### web

```bash
cd web
npm ci            # only if package.json / package-lock.json changed
npm run lint
npm run typecheck
npm run test:run  # NOT `npm run test` — that starts vitest in watch mode and hangs
npm run build
```

Then, from the repo root, the bundle budget gate:

```bash
python3 .github/scripts/bundle_budget.py web/dist
```

It needs a completed `npm run build` first — run it against a stale `dist/` and
the number is a lie.

### mobile

```bash
cd mobile
npm ci            # only if package.json / package-lock.json changed
npm run lint
npm run typecheck
npm run test:run
```

There is no build step in mobile CI.

### hygiene — every change, no exceptions

```bash
python3 -m pip install --quiet pyyaml
git diff --name-only origin/main... | python3 .github/scripts/repo_hygiene.py
```

This exists precisely to cover changes that fall outside all three `paths:`
filters and would otherwise get no CI at all. **Its exit code is the point** —
unlike the summary scripts, it fails the job. It checks for secret filenames,
secret contents, unpinned actions, and files with no workflow watching them.

If it reports a path with no CI coverage, the fix is to add a workflow or add an
entry to `.github/repo-hygiene-allow.txt` **with a reason** — not to silence it.

## Step 3 — report honestly

If something fails, say so and paste the output. A skipped check is a skipped
check; do not describe a partial run as passing.

## Don't

- **Don't remove a `paths:` filter to make a workflow run.** The filtering is
  load-bearing — it is the reason three independently deployed projects can
  share one repo. Both `ci-backend.yml` and the hygiene script say so in
  comments. Work that must run on every PR belongs in `repo-hygiene.yml`.
- **Don't run `npm run test`** when you mean `test:run`. Watch mode never exits.
- **Don't skip the hygiene script** because your change looks project-local.
  It runs on every PR; if it fails, your PR is red no matter how green the rest is.
