# Tasks and drafts

Create a task, preserve unfinished text while switching forms, and reload a saved task.

## Sub-features

- Open and save a task.
- Switch between task and event forms without losing the draft.
- Retain the draft when browser storage rejects a save.
- Complete, reopen, move or delete a task from its card. These actions need additional browser coverage.

## How to get to it (user POV)

- Sign in and choose `New Task`.
- Choose `New Event`, then `New Task`, to return to an unfinished task.
- Use the icon buttons on a task card for completion, week/backlog placement and deletion.

## Driving it with Playwright

Preconditions:

- Run the helper with its empty database, or let the existing suite start its own demo.
- Use the local Alice fixture and a unique task title.

- **Create and reload.** Run `node .agents/skills/verify-study-planner/scripts/verify.mjs`. The helper fills `getByPlaceholder('study math Ch.2')`, saves through its parent form, reloads, and checks both the visible title and SQL row.
- **Switch drafts.** Run `npm run test:e2e -- --grep 'forms retain drafts' --trace on --output $proof --reporter list`. The `New Event` and `New Task` buttons preserve the entered task title; saving clears the input and reload preserves the card.
- **Retry a failed save.** Run `npm run test:e2e -- --grep 'a failed local write' --trace on --output $proof --reporter list`. The test observes the storage error, retained draft, `Try again` and successful save.
- **Drive card actions when changed.** Scope to `page.getByRole('article').filter({ hasText: title })`. Click its exact named button `Done`, `Reopen task`, `Into Backlog`, `This week` or `Delete task`. Assert the corresponding panel placement or absence after reload. These are a recipe for extending a scenario, not assertions made by the default helper.

## Gotchas

- Several mounted forms contain a `Save` button. Scope to the title input's parent form.
- Hidden forms preserve their drafts; use visibility assertions rather than assuming unmounting.
- The form also offers a category selector and optional due date in `src/components/TaskForm.jsx`. Explicit category selection and due-date persistence still need browser assertions.
- A successful local save can precede server persistence. Wait for `Saved` before reading the SQL row.
