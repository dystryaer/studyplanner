# Daily tasks and settings

Create a repeating task, rename its category and retain the selected theme after reload.

## Sub-features

- Create a daily task.
- Rename a task category without changing its identity.
- Save the dark theme.
- Discard unsaved settings with Cancel, Close settings, Escape or the backdrop.

## How to get to it (user POV)

- Choose `New Daily Task` from the planner controls.
- Choose `Settings` from the toolbar.
- Save with `Save changes`, or leave through `Cancel` or `Close settings`.
- Press Escape or click the backdrop outside the dialog to discard changes.

## Driving it with Playwright

Preconditions:

- Sign in as Alice in a disposable context with the default categories.
- Define a fresh `$proof` directory using the skill's command.

- **Create, rename and reload.** Run `npm run test:e2e -- --grep 'daily tasks keep category' --trace on --output $proof --reporter list`. The test clicks `New Daily Task`, fills placeholder `Anki Cards`, and saves through that form. In Settings it fills the first `Category name`, chooses `Dark`, and clicks `Save changes`. After reload the daily task's article shows the renamed category and `html` has `data-theme="dark"`.
- **Check separate category identities.** The same scenario asserts the last `Category name` still reads `Other` before saving. Task and event categories can share a display name.
- **Exercise every unsaved exit.** Run `node .agents/skills/verify-study-planner/scripts/verify.mjs --all`. It opens Settings, edits the first category and uses each exit separately: exact button `Cancel`, exact button `Close settings`, `page.keyboard.press('Escape')`, and `page.locator('.modal-backdrop').click({ position: { x: 4, y: 4 } })`. After each exit, reopening Settings shows the saved category name. The backdrop click targets its outer corner, outside the dialog.

## Gotchas

- Category position is stable only with the default fixture. For custom fixtures identify the intended category explicitly.
- This scenario proves the dark theme. Light needs its own assertion when changed. There is no System button; before a theme is saved, the app follows `prefers-color-scheme`.
- Daily completion and the local 04:00 reset are separate behavior from daily task creation.
