---
name: verify-study-planner
description: Verify Study Planner's browser UI, account isolation, local persistence and sync recovery. Use after changes to planner forms, settings, authentication or synchronization, and when collecting reproducible browser evidence.
---

# Verify Study Planner

The primary interface is the React browser app. Use Playwright and the repository's local demo API. The demo runs the real SQL migration in PGlite with fixed test authentication. It does not verify Supabase Auth, Google login, registration or concurrent PostgreSQL processes. Full Supabase verification requires Docker and `npm run test:local`; see the root README.

## Launch

Run commands from the repository root with Node.js 24. On a fresh checkout, run `npm ci` and `npx playwright install chromium` once.

```powershell
node .agents/skills/verify-study-planner/scripts/verify.mjs
```

This command owns the entire launch, doctor, drive, evidence and cleanup cycle. It starts Vite and the demo API on separate OS-assigned loopback ports, uses an empty in-memory database and creates a fresh Chromium context. `Doctor passed` means the app is ready. The command exits after its task persistence proof. Exit code 0 and `PASS; cleanup complete` indicate success.

The helper sets the local demo URL and public key inside its own process. It does not write `.env.local`, use `.local-dev/pgdata`, connect to a cloud project or attach to an existing browser. Independent helper runs can coexist with the user's demo on port 5173.

## Doctor

```powershell
node .agents/skills/verify-study-planner/scripts/verify.mjs --doctor
```

This starts a disposable instance, checks it without changing planner data, captures a trace, and closes it. The same checks run before every normal proof. They verify the owned Vite server is listening, HTTP returns 200, anonymous API authentication returns 401, the migrated planner table is empty and the Sign in button is visible. `doctor.json` records the PID, URLs and results. This checks a newly owned instance, not an existing user's session. The subsequent drive verifies authenticated access through the login form.

## Drive

For maintenance, exercise all four mapped feature groups in one owned instance:

```powershell
node .agents/skills/verify-study-planner/scripts/verify.mjs --all
```

This runs the initial doctor and task persistence proof, then serially checks draft switching, daily tasks, category and theme persistence, all four settings exits, offline retry and account separation. The browser context and servers stay alive until the last assertion. The report lists completed feature groups. An unexpected failure aborts the run, preserves evidence and closes the instance; fix the cause and rerun to obtain a fresh doctor and known initial state. Do not continue driving a failed instance. The intentional HTTP outage is removed before the account checks.

Start with [the feature map](features/README.md). The helper proves task creation and persistence using the actual login and task forms. It fills `Email`, `Password`, clicks `Sign in`, opens `New Task`, fills placeholder `study math Ch.2`, clicks that form's `Save`, waits for region `Save status` to say `Saved`, and reloads.

For the existing broader regression scenarios:

```powershell
$proof = Join-Path '.pstack/verification/study-planner' ([guid]::NewGuid().ToString())
npm run test:e2e -- --trace on --output $proof --reporter list
```

Feature files provide `--grep` filters to append. This suite owns a separate in-memory demo on fixed port 5174 and refuses to reuse an existing server. Run only one suite at a time; do not stop another process to free its port. Its cross-device test also uses 5174 explicitly. Each test uses isolated browser storage, but suite tests share the temporary database, so keep their fixture titles distinct.

When extending a proof, use the selectors in the map and existing `tests/browser/planner.spec.js`. Add UI actions inside the helper's try block before its SQL observation, or add a focused scenario to the existing suite. Do not mutate React state to simulate a user action. Cover each mapped entry point affected by the change; the default helper covers only task creation and reload.

## Evidence

Each helper run prints its unique directory under `.pstack/verification/study-planner/`. A successful normal run retains:

- `doctor.json` with readiness and isolation checks.
- `before-save.png`, `after-reload.png` and `after-reload.aria.txt` with the entered draft and persisted UI result.
- `trace.zip` with browser actions and resulting pages.
- `database.json` with the real account-owned SQL row observed after the UI save.
- `report.json` with assertions, action descriptions, outcome and cleanup results.

The `--all` run also retains screenshots for each mapped feature, `sync-database.json` showing unchanged server data during the outage and persistence after retry, and `accounts-database.json` showing Bob's isolated plan. Its trace records every UI action, including discarded settings edits.

Open a trace with `npx playwright show-trace` followed by its printed path to `trace.zip`. Preserve both the action and the visible result. A final screenshot or a Saved label alone does not prove persistence. The helper asserts that the expected account owns exactly one matching task after reload. Failed runs retain `failure.png` when a page is available and the error in `report.json`.

Use only the disposable test accounts. Traces include local test authentication traffic. Do not collect traces from the user's profile or dump their local storage. Network failures in the existing suite are injected at the HTTP boundary; storage failures are injected at the browser storage boundary. PGlite executes the actual migration, but passing here is not proof of real Supabase service integration.

## Cleanup

The helper's `finally` block closes its trace, browser, Vite server, API and in-memory database on success and failure. It records cleanup errors, exits unsuccessfully if closure fails, and checks that `report.json` still exists after teardown. Evidence directories remain intact. The existing Playwright runner owns and closes its own web server and browser contexts.

Let commands finish normally to preserve traces. Never use process-name termination or stop the user's persistent demo. If a run is forcibly terminated, inspect the PID from its `doctor.json` and confirm it still belongs to that invocation before ending only that process. Do not remove `.pstack/verification` during cleanup.

## Helpers

`scripts/verify.mjs` is the executable Node helper. Use no argument for task persistence, `--doctor` for readiness only, or `--all` for the maintenance pass. It calls the skill-owned `scripts/mapped-features.mjs` in all-feature mode. These scripts import the existing demo API and database role helper, with no production application changes. Run `npm test` for domain, session and SQL regression checks and `npm run build` when the change affects the build.

Use `/maintain-verification-skill` when the UI or test commands change.
