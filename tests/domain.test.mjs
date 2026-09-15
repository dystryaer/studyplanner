import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTimeRules, createInitialPlannerState, parsePlannerState } from '../src/domain/plannerState.js';
import { getWeekKey } from '../src/utils/calendar.js';
import { getWeekNumber } from '../src/utils/date.js';
import { plannerReducer } from '../src/reducers/plannerReducer.js';
import { getTasksByContainer } from '../src/utils/plannerSelectors.js';

test('all week consumers agree at the ISO year boundary', () => {
  for (const [date, key, week] of [['2026-01-01', '2026-W01', 1], ['2021-01-01', '2020-W53', 53], ['2025-12-29', '2026-W01', 1]]) {
    const now = new Date(`${date}T12:00:00`);
    assert.equal(getWeekKey(now), key);
    assert.equal(getWeekNumber(now), week);
  }
});

test('parsing legacy data preserves completed tasks and old events without running cleanup', () => {
  const raw = { tasks: [{ id: 'done', bucket: 'week', weekKey: '2025-W01', status: 'done', title: 'Keep history' }], events: [{ id: 'old', title: 'Past event', date: '2020-01-01' }] };
  const parsed = parsePlannerState(raw);
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.tasks[0].status, 'done');
  assert.equal(parsed.tasks[0].weekKey, '2026-W01');
  assert.equal(parsed.events[0].date, '2020-01-01');
  assert.deepEqual(parsePlannerState(parsed), parsed);
  assert.equal(raw.tasks[0].weekKey, '2025-W01');
});

test('ambiguous legacy weeks remain recoverable instead of being guessed', () => {
  const data = parsePlannerState({ tasks: [{ id: 'a', title: 'Recover', bucket: 'week', weekKey: '2018-W01', status: 'done' }] });
  assert.equal(data.tasks[0].bucket, 'backlog');
  assert.equal(data.tasks[0].legacyWeekKey, '2018-W01');
  assert.equal(data.tasks[0].status, 'done');
});

test('week rollover moves unfinished work and retains completion history and events', () => {
  const state = { ...createInitialPlannerState(), tasks: [
    { id: 'unfinished', bucket: 'week', weekKey: '2025-W52', status: 'planned' },
    { id: 'completed', bucket: 'week', weekKey: '2025-W52', status: 'done' },
    { id: 'current', bucket: 'week', weekKey: '2026-W01', status: 'planned' },
  ], events: [{ id: 'old', date: '2020-01-01' }] };
  const result = applyTimeRules(state, new Date('2026-01-01T12:00:00'));
  assert.deepEqual(result.tasks.map(task => [task.id, task.bucket]), [['unfinished', 'backlog'], ['completed', 'week'], ['current', 'week']]);
  assert.equal(result.events.length, 1);
  assert.equal(applyTimeRules(result, new Date('2026-01-01T12:00:00')), result);
});

test('daily completion resets at 04:00 local time', () => {
  const state = applyTimeRules(createInitialPlannerState(), new Date('2026-06-01T05:00:00'));
  state.dailyTasks = [{ id: 'daily', status: 'done', bucket: 'daily' }];
  assert.equal(applyTimeRules(state, new Date('2026-06-02T03:59:00')).dailyTasks[0].status, 'done');
  assert.equal(applyTimeRules(state, new Date('2026-06-02T04:00:00')).dailyTasks[0].status, 'planned');
});

test('dragging into Done uses the same container ordering as the board', () => {
  const now = new Date('2026-01-01T12:00:00');
  let state = createInitialPlannerState();
  for (const id of ['a', 'b']) state = plannerReducer(state, { type: 'ADD_TASK', payload: { id, bucket: 'backlog', status: 'planned' } }, now);
  state = plannerReducer(state, { type: 'MOVE_TASK_BY_DND', payload: { taskId: 'a', toContainer: 'week-done', targetIndex: 0, weekKey: '2026-W01' } }, now);
  assert.deepEqual(getTasksByContainer(state.tasks, [], 'week-done', '2026-W01').map(task => task.id), ['a']);
  assert.deepEqual(getTasksByContainer(state.tasks, [], 'backlog', '2026-W01').map(task => task.id), ['b']);
});

test('corrupt record collections fail without silently deleting their contents', () => {
  assert.throws(() => parsePlannerState({ tasks: [{ id: 'a' }, null] }), /array of objects/);
  assert.throws(() => parsePlannerState({ events: [{ id: 'a', date: null }] }), /invalid date/);
});
