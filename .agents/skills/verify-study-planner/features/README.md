# Study Planner feature map

Use [the verification skill](../SKILL.md) for launch, isolation, evidence and cleanup. Run its doctor before a proof. The map describes entry points and observable results; it does not claim that every listed path has automated coverage.

| Feature | Entry points | Existing automated coverage |
| --- | --- | --- |
| [Tasks and drafts](tasks.md) | New Task, New Event form switch, task card actions | Default helper proves creation and reload; suite covers draft retention and storage failure |
| [Account access](accounts.md) | Sign in, Logout, startup Sign out, reload | Account separation, expired token, logout with storage failure; startup Sign out in `--all` |
| [Sync and recovery](sync.md) | Save status, Try again, conflict choices, another tab | Offline retry, server-version conflict resolution, tab takeover |
| [Daily tasks and settings](settings.md) | New Daily Task, Settings, Save changes, Cancel, Close settings, Escape, backdrop | Category rename and dark theme after reload; all four unsaved exits in `--all` |

This initial map covers four feature groups. Calendar event creation, date navigation, drag and drop, backup downloads, category addition/deletion and automatic day/week rollover still need dedicated browser proofs. Domain tests cover some rollover behavior; they do not substitute for those browser paths. Google login and registration require the full Supabase setup.

Run `node .agents/skills/verify-study-planner/scripts/verify.mjs --all` to cover all four groups serially on one health-checked instance. This does not replace the suite's conflict, tab-lock, expired-token or storage-failure scenarios.

For filtered suite commands below, first define `$proof` as shown in the skill. Add `--trace on --output $proof --reporter list` to preserve successful traces. Use a fresh directory for each invocation.
