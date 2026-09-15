# Sync and recovery

Keep local edits during an outage, resolve competing versions, and allow only one writing tab per browser profile.

## Sub-features

- Save offline and retry after reconnecting.
- Resolve a device conflict with the server version while retaining a recovery copy.
- Transfer writing ownership after the first tab closes.
- Choose `Keep this device` or export a backup. These entry points need dedicated browser proofs.

## How to get to it (user POV)

- Inspect `Save status` after changing a task.
- Choose `Try again` after an outage or after closing the other writing tab.
- On conflict, choose `Use server version` or `Keep this device`; export a backup before resolving if needed.
- The backup button is `Export backup`, or `Export saved data` when saving reports an error. `Export older local data` appears only when the browser contains the legacy `studyplanner-app-v1` key. These download paths still need dedicated browser proofs.

## Driving it with Playwright

Preconditions:

- Run one existing suite at a time on its owned port 5174.
- For competing devices use separate browser contexts; for competing tabs use the same context.

- **Retry offline edits.** Run `npm run test:e2e -- --grep 'offline changes' --trace on --output $proof --reporter list`. HTTP routing aborts `**/rest/v1/**`; the saved task survives reload. Removing the route and clicking `Try again` produces `Saved` and persistence after another reload.
- **Use the server version.** Run `npm run test:e2e -- --grep 'another device' --trace on --output $proof --reporter list`. Two contexts create competing edits. `getByRole('button', { name: 'Use server version' })` resolves the conflict; the winning title is visible, the losing title is absent from the page but present in local recovery storage.
- **Transfer ownership.** Run `npm run test:e2e -- --grep 'only one tab' --trace on --output $proof --reporter list`. A second tab shows `another tab` in `Save status`. After the writer closes, `Try again` enables editing and saving.

## Gotchas

- Wait for the Offline text with a polling assertion. The suite allows 15 seconds and the maintenance helper allows 20 seconds; these are test timeouts, not application retry intervals.
- A second tab can show loading while waiting up to 500 ms for the write lock. Wait for `another tab` before trying its controls.
- Testing `Use server version` does not prove `Keep this device` or backup downloads.
- PGlite proves revision handling in this setup. Use `npm run test:local` against local Docker Supabase to test real concurrent server writes.
