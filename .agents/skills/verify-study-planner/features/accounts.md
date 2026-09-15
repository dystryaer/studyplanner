# Account access

Sign in to an account, keep its local plan separate, and explicitly leave it with Logout.

## Sub-features

- Sign in with a local fixture account.
- Switch from Alice to Bob without showing Alice's tasks.
- Reopen an owned local plan with an expired token while offline.
- Keep the app signed out after Logout, including when local storage fails.
- Sign out from the planner-start screen while another tab holds the write lock.

## How to get to it (user POV)

- Open the app and fill `Email` and `Password`, then choose `Sign in`.
- Choose `Logout` from the planner toolbar.
- If the planner has not opened yet, use `Sign out` on the startup screen. A second tab waiting for the current writer shows this screen.
- Reload the page to resume an owned session or confirm logout.

## Driving it with Playwright

Preconditions:

- Use the fresh Playwright context and demo accounts from `scripts/dev-database.mjs`.
- The demo password comes from `scripts/demo-api.mjs`; do not use real credentials.

- **Switch accounts.** Run `npm run test:e2e -- --grep 'forms retain drafts' --trace on --output $proof --reporter list`. The test fills `getByRole('textbox', { name: 'Email' })` and `getByLabel('Password', { exact: true })`, saves an Alice task, logs out and signs in as Bob. Bob must not see Alice's task.
- **Sign out before the planner opens.** Run `node .agents/skills/verify-study-planner/scripts/verify.mjs --all`. It opens a second page in the same browser context, waits for `Save status` to contain `another tab`, clicks exact button `Sign out`, and reloads. The `Sign in` button remains visible. This covers the startup control in `src/App.jsx`, separately from toolbar Logout.
- **Resume offline.** Run `npm run test:e2e -- --grep 'an expired token' --trace on --output $proof --reporter list`. The saved plan remains visible despite a failed refresh request; clicking `Logout` and reloading shows `Sign in` and hides the task.
- **Survive storage failure on logout.** Run `npm run test:e2e -- --grep 'logout cannot reopen' --trace on --output $proof --reporter list`. Even a retained SDK session must not reopen the planner after explicit logout.

## Gotchas

- Reload and explicit login are separate entry paths and both matter for account ownership.
- Authentication here is a local fixture implementation. OAuth and registration are outside this proof.
- Fault injection modifies only disposable browser storage and network requests.
