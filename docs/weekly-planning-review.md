# Flexible weekly planning

The week groups tasks by category beside a dated agenda. Tasks can remain week-only; a planned day and time are optional and independent of the due date. The month calendar remains available and uses the same appointment records as the agenda.

## Decisions

- Keep one task collection and one placement transition for backlog, week and day. Explicit completion targets change status; rescheduling preserves it.
- Remove automatic weekly unplanning. Review unfinished earlier weeks against the actual current week and carry tasks explicitly.
- Write snapshot version 3 and accept versions 1, 2 and 3. Older clients reject the new snapshot before they can run the removed cleanup behavior. Reload older open clients after the update.
- Show deadlines from all weeks and the backlog. Sort them by due date within categories; use Move to for placement in this view.
- Keep forms mounted during mobile navigation so unfinished text survives. The week opens first, and the bottom navigation reaches every section.
- Reset routines at 04:00, preserve pause, and exclude paused or skipped routines from today's progress count.

These choices follow Model the Domain, Experience First and Prove It Works: scheduling has one representation, weekly work remains flexible, and browser actions verify the resulting persisted plan.

## Review disposition

Four independent reviewers inspected the implementation: Fable 5.1, GPT-6 Astra, Grok 4.6 and Opus 5. A separate Fable pass reviewed comments and the audit trail. The parent reproduced findings and applied the corrections below.

| Finding | Resolution |
| --- | --- |
| Downward sorting and self-drop changed the wrong position | Resolve an insertion anchor from the actual target membership; prioritize cards over their containing drop zone; ignore self-drop. |
| Dropping in Done erased the planned slot | Completion and reorder preserve the slot. Buttons and drag use the same placement transition. |
| Backlog and week buttons silently reopened completed tasks | Rescheduling preserves completion. Open/Done targets explicitly change it. |
| Failed dialog saves trapped drafts | Show the existing save status and retry controls inside the dialog; retain fields until a successful save. |
| Parent updates disturbed modal focus | Keep the focus effect stable and read current controls when handling Tab. |
| Future-week browsing misclassified current work | Compare review tasks with today's week and show review in the current week. |
| Deadline filters missed backlog tasks | Use the global due selectors and label the scope. |
| Mobile actions clipped, drafts disappeared, desktop resize showed a blank view | Wrap controls, keep forms mounted and select a usable desktop view. |
| A full sidebar or narrow desktop header covered controls | Scroll the complete sidebar and wrap the header sections. |
| Routine pause and skip looked outstanding | Exclude them from today's count and display their state. |
| Day/week drop targets lacked feedback | Apply the drop highlight to every compatible target. |
| Legacy placement paths and unused selectors remained | Remove them and route callers through the destination action. |

The Grok dispatcher rejected the response wrapper. Its complete JSON report was recovered from the raw output and reviewed manually. Its two findings agreed with other reviewers and were fixed. No critical finding remains open. All workers terminated before integration.

## Reproduce verification

```sh
npm test
npm run test:e2e -- --trace on --reporter list
npm run build
```

The browser suite covers task and appointment moves, due-date independence, category filtering, previous-week review, routine persistence, mobile navigation, downward sorting, self-drop, timed completion, modal retry, and backlog deadlines. It also retains the account isolation, conflict, offline recovery and draft tests.

The project-local verification helper additionally checks all mapped forms, settings exits and sync recovery:

```sh
node .agents/skills/verify-study-planner/scripts/verify.mjs --all
```

Evidence from this implementation session is retained locally under `.pstack/work/weekly-redesign/`, including the design candidates, review reports, decision log, browser traces and screenshots. The helper writes its own report under `.pstack/verification/study-planner/`.

Browser verification uses Chromium and the disposable local SQL demo. Native Safari interactions and production Supabase Auth were not exercised. The production build reports a JavaScript chunk above Vite's 500 kB warning threshold.
