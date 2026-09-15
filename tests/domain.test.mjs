import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTaskDestination,
  applyTimeRules,
  createInitialPlannerState,
  createPlannedSlot,
  parsePlannerState,
  parseTaskDestination,
  PLANNER_STATE_VERSION,
} from '../src/domain/plannerState.js';
import { canAccept, eventDragId, getDropBeforeId } from '../src/domain/dragRules.js';
import { getWeekKey } from '../src/utils/calendar.js';
import { getWeekNumber } from '../src/utils/date.js';
import { plannerReducer } from '../src/reducers/plannerReducer.js';
import { placeTaskAction } from '../src/reducers/plannerActions.js';
import {
  getAgendaDays,
  getReviewTasks,
  getTasksByContainer,
  getWeekCategoryGroups,
} from '../src/utils/plannerSelectors.js';

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
  assert.equal(parsed.version, PLANNER_STATE_VERSION);
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.tasks[0].status, 'done');
  assert.equal(parsed.tasks[0].weekKey, '2026-W01');
  assert.equal(parsed.tasks[0].plannedSlot, null);
  assert.equal(parsed.events[0].date, '2020-01-01');
  assert.equal('weeklyCleanupWeekKey' in parsed, false);
  assert.deepEqual(parsePlannerState(parsed), parsed);
  assert.equal(raw.tasks[0].weekKey, '2025-W01');
});

test('version 2 snapshots keep records, drop weekly cleanup, and become version 3', () => {
  const parsed = parsePlannerState({
    version: 2,
    weeklyCleanupWeekKey: '2026-W01',
    tasks: [{ id: 'open', title: 'Stay on last week', bucket: 'week', weekKey: '2025-W52', status: 'planned', due: '2026-01-10' }],
    dailyTasks: [{ id: 'habit', title: 'Anki', status: 'done' }],
    events: [{ id: 'meet', title: 'Clinic', date: '2026-01-02', startTime: '09:00', endTime: '10:00' }],
  });
  assert.equal(parsed.version, 3);
  assert.equal(parsed.tasks[0].weekKey, '2025-W52');
  assert.equal(parsed.tasks[0].due, '2026-01-10');
  assert.equal(parsed.tasks[0].plannedSlot, null);
  assert.equal(parsed.dailyTasks[0].paused, false);
  assert.equal(parsed.dailyTasks[0].status, 'done');
  assert.equal(parsed.events[0].title, 'Clinic');
  assert.equal('weeklyCleanupWeekKey' in parsed, false);
});

test('version 3 keeps planned slots, skipped routines and paused flags', () => {
  const parsed = parsePlannerState({
    version: 3,
    tasks: [{
      id: 'slot',
      title: 'Read',
      bucket: 'week',
      weekKey: '2026-W01',
      status: 'planned',
      due: '2026-01-08',
      plannedSlot: { date: '2026-01-01', startTime: '14:00', endTime: '15:00' },
    }],
    dailyTasks: [{ id: 'skip', title: 'Run', status: 'skipped', paused: true }],
  });
  assert.deepEqual(parsed.tasks[0].plannedSlot, { date: '2026-01-01', startTime: '14:00', endTime: '15:00' });
  assert.equal(parsed.tasks[0].due, '2026-01-08');
  assert.equal(parsed.dailyTasks[0].status, 'skipped');
  assert.equal(parsed.dailyTasks[0].paused, true);
  assert.deepEqual(parsePlannerState(parsed), parsed);
});

test('unsupported versions fail closed', () => {
  assert.throws(() => parsePlannerState({ version: 4, tasks: [] }), /Unsupported planner state version 4/);
});

test('a planned slot on a backlog task is rejected', () => {
  assert.throws(
    () => parsePlannerState({
      version: 3,
      tasks: [{ id: 'bad', bucket: 'backlog', plannedSlot: { date: '2026-01-01' } }],
    }),
    /planned slot requires a week task/,
  );
});

test('a slot date outside the task week is rejected', () => {
  assert.throws(
    () => parsePlannerState({
      version: 3,
      tasks: [{ id: 'bad', bucket: 'week', weekKey: '2026-W01', plannedSlot: { date: '2026-01-08' } }],
    }),
    /fall in the task week/,
  );
});

test('end time without start time is rejected', () => {
  assert.throws(() => createPlannedSlot({ date: '2026-01-01', startTime: '', endTime: '11:00' }), /end time requires a start time/i);
});

test('ambiguous legacy weeks remain recoverable instead of being guessed', () => {
  const data = parsePlannerState({ tasks: [{ id: 'a', title: 'Recover', bucket: 'week', weekKey: '2018-W01', status: 'done' }] });
  assert.equal(data.tasks[0].bucket, 'backlog');
  assert.equal(data.tasks[0].legacyWeekKey, '2018-W01');
  assert.equal(data.tasks[0].status, 'done');
  assert.equal(data.tasks[0].plannedSlot, null);
});

test('open tasks from earlier weeks stay until an explicit review action', () => {
  const state = {
    ...createInitialPlannerState(),
    tasks: [
      { id: 'unfinished', bucket: 'week', weekKey: '2025-W52', status: 'planned', categoryId: 'other', plannedSlot: null },
      { id: 'completed', bucket: 'week', weekKey: '2025-W52', status: 'done', categoryId: 'other', plannedSlot: null },
      { id: 'older', bucket: 'week', weekKey: '2025-W40', status: 'planned', categoryId: 'other', plannedSlot: null },
      { id: 'current', bucket: 'week', weekKey: '2026-W01', status: 'planned', categoryId: 'other', plannedSlot: null },
    ],
    events: [{ id: 'old', date: '2020-01-01' }],
  };
  const now = new Date('2026-01-01T12:00:00');
  const result = applyTimeRules(state, now);
  assert.deepEqual(result.tasks.map((task) => [task.id, task.bucket, task.weekKey]), [
    ['unfinished', 'week', '2025-W52'],
    ['completed', 'week', '2025-W52'],
    ['older', 'week', '2025-W40'],
    ['current', 'week', '2026-W01'],
  ]);
  assert.equal(result.events.length, 1);
  assert.equal(applyTimeRules(result, now), result);
  assert.deepEqual(getReviewTasks(result.tasks, '2026-W01').map((task) => task.id), ['older', 'unfinished']);

  let next = plannerReducer(result, placeTaskAction('unfinished', { kind: 'week', weekKey: '2026-W01' }), now);
  assert.equal(next.tasks.find((task) => task.id === 'unfinished').weekKey, '2026-W01');
  next = plannerReducer(next, placeTaskAction('older', { kind: 'backlog' }), now);
  assert.equal(next.tasks.find((task) => task.id === 'older').bucket, 'backlog');
  assert.equal(next.tasks.find((task) => task.id === 'completed').weekKey, '2025-W52');
  assert.deepEqual(getReviewTasks(next.tasks, '2026-W01').map((task) => task.id), []);
});

test('daily completion and skip reset at 04:00 local time while pause survives', () => {
  const state = applyTimeRules(createInitialPlannerState(), new Date('2026-06-01T05:00:00'));
  state.dailyTasks = [
    { id: 'done', status: 'done', bucket: 'daily', paused: false },
    { id: 'skip', status: 'skipped', bucket: 'daily', paused: false },
    { id: 'paused', status: 'done', bucket: 'daily', paused: true },
  ];
  const before = applyTimeRules(state, new Date('2026-06-02T03:59:00'));
  assert.equal(before.dailyTasks[0].status, 'done');
  assert.equal(before.dailyTasks[1].status, 'skipped');
  const after = applyTimeRules(state, new Date('2026-06-02T04:00:00'));
  assert.deepEqual(after.dailyTasks.map((task) => [task.id, task.status, task.paused]), [
    ['done', 'planned', false],
    ['skip', 'planned', false],
    ['paused', 'planned', true],
  ]);
});

test('dragging into Done uses the same container ordering as the board', () => {
  const now = new Date('2026-01-01T12:00:00');
  let state = createInitialPlannerState();
  for (const id of ['a', 'b']) state = plannerReducer(state, { type: 'ADD_TASK', payload: { id, bucket: 'backlog', status: 'planned' } }, now);
  state = plannerReducer(state, placeTaskAction('a', { kind: 'week', weekKey: '2026-W01' }, null, 'done'), now);
  assert.deepEqual(getTasksByContainer(state.tasks, [], 'week-done', '2026-W01').map((task) => task.id), ['a']);
  assert.deepEqual(getTasksByContainer(state.tasks, [], 'backlog', '2026-W01').map((task) => task.id), ['b']);
});

test('placing a task on a day keeps due independent and clears the slot in week-only and backlog moves', () => {
  const now = new Date('2026-01-01T12:00:00');
  let state = createInitialPlannerState();
  state = plannerReducer(state, {
    type: 'ADD_TASK',
    payload: { id: 'read', title: 'Read', bucket: 'week', weekKey: '2026-W01', status: 'planned', due: '2026-01-09', categoryId: 'other' },
  }, now);
  state = plannerReducer(state, placeTaskAction('read', { kind: 'day', date: '2026-01-02', startTime: '09:00', endTime: '10:00' }), now);
  const scheduled = state.tasks.find((task) => task.id === 'read');
  assert.equal(scheduled.due, '2026-01-09');
  assert.deepEqual(scheduled.plannedSlot, { date: '2026-01-02', startTime: '09:00', endTime: '10:00' });
  assert.equal(scheduled.weekKey, '2026-W01');

  state = plannerReducer(state, placeTaskAction('read', { kind: 'day', date: '2026-01-03' }), now);
  const movedDay = state.tasks.find((task) => task.id === 'read');
  assert.equal(movedDay.due, '2026-01-09');
  assert.deepEqual(movedDay.plannedSlot, { date: '2026-01-03', startTime: '09:00', endTime: '10:00' });

  state = plannerReducer(state, placeTaskAction('read', { kind: 'week', weekKey: '2026-W02' }), now);
  const weekOnly = state.tasks.find((task) => task.id === 'read');
  assert.equal(weekOnly.weekKey, '2026-W02');
  assert.equal(weekOnly.plannedSlot, null);
  assert.equal(weekOnly.due, '2026-01-09');

  state = plannerReducer(state, placeTaskAction('read', { kind: 'backlog' }), now);
  const backlog = state.tasks.find((task) => task.id === 'read');
  assert.equal(backlog.bucket, 'backlog');
  assert.equal(backlog.plannedSlot, null);
  assert.equal(backlog.due, '2026-01-09');
});

test('beforeId reorders only inside the same category, status and week', () => {
  const now = new Date('2026-01-01T12:00:00');
  const categories = [
    { id: 'math', kind: 'task', label: 'Math', baseColor: '#ffda96' },
    { id: 'bio', kind: 'task', label: 'Bio', baseColor: '#c8abff' },
  ];
  let state = createInitialPlannerState();
  for (const payload of [
    { id: 'm1', title: 'm1', bucket: 'week', weekKey: '2026-W01', status: 'planned', categoryId: 'math', order: 0 },
    { id: 'm2', title: 'm2', bucket: 'week', weekKey: '2026-W01', status: 'planned', categoryId: 'math', order: 1 },
    { id: 'b1', title: 'b1', bucket: 'week', weekKey: '2026-W01', status: 'planned', categoryId: 'bio', order: 0 },
  ]) {
    state = plannerReducer(state, { type: 'ADD_TASK', payload }, now);
  }
  state = plannerReducer(state, placeTaskAction('m1', { kind: 'week', weekKey: '2026-W01' }, 'm2'), now);
  const math = getWeekCategoryGroups(state.tasks, categories, '2026-W01')[0].planned.map((task) => task.id);
  assert.deepEqual(math, ['m1', 'm2']);
  state = plannerReducer(state, placeTaskAction('m2', { kind: 'week', weekKey: '2026-W01' }, 'm1'), now);
  assert.deepEqual(getWeekCategoryGroups(state.tasks, categories, '2026-W01')[0].planned.map((task) => task.id), ['m2', 'm1']);
  state = plannerReducer(state, placeTaskAction('m2', { kind: 'week', weekKey: '2026-W01' }, 'b1'), now);
  const mathAfterIgnored = getWeekCategoryGroups(state.tasks, categories, '2026-W01')[0].planned.map((task) => task.id);
  assert.deepEqual(mathAfterIgnored, ['m2', 'm1']);
  assert.deepEqual(getWeekCategoryGroups(state.tasks, categories, '2026-W01')[1].planned.map((task) => task.id), ['b1']);
});

test('updating a task due date does not rewrite its planned slot', () => {
  const now = new Date('2026-01-01T12:00:00');
  let state = createInitialPlannerState();
  state = plannerReducer(state, {
    type: 'ADD_TASK',
    payload: { id: 'edit', title: 'Edit me', bucket: 'week', weekKey: '2026-W01', status: 'planned', due: '2026-01-04', categoryId: 'other' },
  }, now);
  state = plannerReducer(state, placeTaskAction('edit', { kind: 'day', date: '2026-01-01', startTime: '08:00' }), now);
  state = plannerReducer(state, { type: 'UPDATE_TASK', payload: { id: 'edit', due: '2026-01-20', title: 'Edited' } }, now);
  const task = state.tasks.find((item) => item.id === 'edit');
  assert.equal(task.title, 'Edited');
  assert.equal(task.due, '2026-01-20');
  assert.deepEqual(task.plannedSlot, { date: '2026-01-01', startTime: '08:00', endTime: '' });
});

test('appointments share one update transition for edit and date move', () => {
  const now = new Date('2026-01-01T12:00:00');
  let state = createInitialPlannerState();
  state = plannerReducer(state, {
    type: 'ADD_EVENT',
    payload: { id: 'appt', title: 'Dentist', date: '2026-01-02', startTime: '10:00', endTime: '11:00', categoryId: 'doctor' },
  }, now);
  state = plannerReducer(state, { type: 'UPDATE_EVENT', payload: { id: 'appt', patch: { date: '2026-01-05', title: 'Dentist follow-up' } } }, now);
  assert.deepEqual(state.events[0], {
    id: 'appt',
    title: 'Dentist follow-up',
    date: '2026-01-05',
    startTime: '10:00',
    endTime: '11:00',
    categoryId: 'doctor',
  });
  const weekRange = { start: new Date('2026-01-01T00:00:00'), end: new Date('2026-01-07T23:59:59') };
  const friday = getAgendaDays(state.events, [], weekRange).find((day) => day.dateKey === '2026-01-05');
  assert.equal(friday.events[0].title, 'Dentist follow-up');
});

test('routine pause and skip are explicit and do not invent occurrence history', () => {
  const now = new Date('2026-01-01T12:00:00');
  let state = createInitialPlannerState();
  state = plannerReducer(state, { type: 'ADD_DAILY_TASK', payload: { id: 'habit', title: 'Anki', status: 'planned' } }, now);
  state = plannerReducer(state, { type: 'SET_DAILY_TASK_STATUS', payload: { id: 'habit', status: 'skipped' } }, now);
  state = plannerReducer(state, { type: 'SET_DAILY_TASK_PAUSED', payload: { id: 'habit', paused: true } }, now);
  const habit = state.dailyTasks.find((task) => task.id === 'habit');
  assert.equal(habit.status, 'skipped');
  assert.equal(habit.paused, true);
  assert.equal('skippedAt' in habit, false);
});

test('due mode hides completed and unrelated tasks from category groups', () => {
  const now = new Date('2026-01-05T12:00:00');
  const categories = [{ id: 'other', kind: 'task', label: 'Other', baseColor: '#ffda96' }];
  const tasks = [
    { id: 'late', title: 'Late', bucket: 'week', weekKey: '2026-W02', status: 'planned', categoryId: 'other', due: '2026-01-01', order: 0 },
    { id: 'soon', title: 'Soon', bucket: 'week', weekKey: '2026-W02', status: 'planned', categoryId: 'other', due: '2026-01-06', order: 1 },
    { id: 'done', title: 'Done', bucket: 'week', weekKey: '2026-W02', status: 'done', categoryId: 'other', due: '2026-01-01', order: 2 },
  ];
  assert.deepEqual(getWeekCategoryGroups(tasks, categories, '2026-W02', { dueMode: 'overdue' }, now)[0].planned.map((task) => task.id), ['late']);
  assert.deepEqual(getWeekCategoryGroups(tasks, categories, '2026-W02', { dueMode: 'upcoming' }, now)[0].planned.map((task) => task.id), ['soon']);
});

test('drag destination rules keep routines, events and tasks on compatible targets', () => {
  assert.equal(canAccept('task', 'day'), true);
  assert.equal(canAccept('task', 'routine-list'), false);
  assert.equal(canAccept('event', 'day'), true);
  assert.equal(canAccept('event', 'backlog'), false);
  assert.equal(canAccept('routine', 'routine-list'), true);
  assert.equal(canAccept('routine', 'day'), false);
  assert.equal(eventDragId('abc', 'agenda'), 'event:abc:agenda');
});

test('day destinations require a valid date and preserve omitted times at apply time', () => {
  assert.throws(() => parseTaskDestination({ kind: 'day', date: 'nope' }), /invalid date/);
  const dest = parseTaskDestination({ kind: 'day', date: '2026-01-02' });
  const moved = applyTaskDestination({
    id: 't',
    bucket: 'week',
    weekKey: '2026-W01',
    plannedSlot: { date: '2026-01-01', startTime: '13:00', endTime: '14:00' },
    due: '2026-02-01',
  }, dest);
  assert.equal(moved.due, '2026-02-01');
  assert.deepEqual(moved.plannedSlot, { date: '2026-01-02', startTime: '13:00', endTime: '14:00' });
});

test('corrupt record collections fail without silently deleting their contents', () => {
  assert.throws(() => parsePlannerState({ tasks: [{ id: 'a' }, null] }), /array of objects/);
  assert.throws(() => parsePlannerState({ events: [{ id: 'a', date: null }] }), /invalid date/);
});


test('downward drag uses the following anchor and status changes preserve planned time and due date', () => {
  const now = new Date('2026-01-01T12:00:00');
  let state = createInitialPlannerState();
  state.tasks = ['a', 'b', 'c'].map((id, order) => ({ id, order, bucket: 'week', weekKey: '2026-W01', categoryId: 'other', status: 'planned', due: '2026-02-01', plannedSlot: { date: '2026-01-02', startTime: '09:00', endTime: '10:00' } }));
  assert.equal(getDropBeforeId(state.tasks, 'a', 'b'), 'c');
  state = plannerReducer(state, placeTaskAction('a', { kind: 'day', date: '2026-01-02' }, getDropBeforeId(state.tasks, 'a', 'b')), now);
  assert.deepEqual(getTasksByContainer(state.tasks, [], 'week', '2026-W01').map(t => t.id), ['b', 'a', 'c']);
  state = plannerReducer(state, placeTaskAction('a', { kind: 'day', date: '2026-01-02' }, null, 'done'), now);
  assert.deepEqual(state.tasks.find(t => t.id === 'a').plannedSlot, { date: '2026-01-02', startTime: '09:00', endTime: '10:00' });
  state = plannerReducer(state, placeTaskAction('a', { kind: 'backlog' }), now);
  const task = state.tasks.find(t => t.id === 'a');
  assert.equal(task.status, 'done');
  assert.equal(task.due, '2026-02-01');
});

test('deadline groups include backlog and other weeks in due order', () => {
  const tasks = [
    { id: 'backlog', bucket: 'backlog', status: 'planned', categoryId: 'other', due: '2026-01-04' },
    { id: 'old', bucket: 'week', weekKey: '2025-W52', status: 'planned', categoryId: 'other', due: '2026-01-01' },
    { id: 'done', bucket: 'backlog', status: 'done', categoryId: 'other', due: '2026-01-01' },
  ];
  const groups = getWeekCategoryGroups(tasks, [{ id: 'other', label: 'Other' }], '2026-W02', { dueMode: 'overdue' }, new Date('2026-01-05T12:00:00'));
  assert.deepEqual(groups[0].planned.map(t => t.id), ['old', 'backlog']);
});

test('move rejects nonexistent dates and ISO weeks', () => {
  for (const date of ['2026-02-30', '2026-13-01']) assert.throws(() => parseTaskDestination({ kind: 'day', date }), /invalid date/);
  for (const weekKey of ['2026-W00', '2026-W99', '2025-W53']) assert.throws(() => parseTaskDestination({ kind: 'week', weekKey }), /invalid week/);
  assert.deepEqual(parseTaskDestination({ kind: 'week', weekKey: '2026-W53' }), { kind: 'week', weekKey: '2026-W53' });
});
