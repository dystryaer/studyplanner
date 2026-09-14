import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlannerSession, getLocalStorageKey, LEGACY_STORAGE_KEY } from '../src/data/plannerSession.js';
import { createInitialPlannerState, applyTimeRules } from '../src/domain/plannerState.js';

const now = new Date('2026-01-01T12:00:00');
const clean = () => applyTimeRules(createInitialPlannerState(), now);
const task = title => ({ type: 'ADD_TASK', payload: { id: title, title, bucket: 'backlog', status: 'planned', weekKey: null } });
function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function seed(store, data, { localSeq = 0, ackedSeq = 0, pending = null } = {}) {
  store.setItem(getLocalStorageKey('alice'), JSON.stringify({ version: 2, userId: 'alice', data, baseRevision: 1, localSeq, ackedSeq, pending }));
}
function session(t, store, remote) {
  const result = createPlannerSession({ userId: 'alice', storage: store, remote, clock: () => now, acquireLock: async () => () => {} });
  t.after(() => result.dispose());
  return result;
}
function server(data = clean()) {
  let record = { data, revision: 1, mutationId: null };
  return {
    read: async () => record,
    save: async (_owner, write) => {
      if (record.mutationId === write.mutationId) return { outcome: 'saved', revision: record.revision, mutationId: write.mutationId };
      if (write.expectedRevision !== record.revision) return { outcome: 'conflict', revision: record.revision, mutationId: record.mutationId };
      record = { data: write.data, revision: record.revision + 1, mutationId: write.mutationId };
      return { outcome: 'saved', revision: record.revision, mutationId: record.mutationId };
    },
  };
}
async function drain(s) { for (let i = 0; i < 10 && s.getSnapshot().status === 'saving'; i++) await s.flush(); }

test('a dirty local plan is never replaced by a different server revision', async t => {
  const store = storage();
  seed(store, { ...clean(), tasks: [task('Local edit').payload] }, { localSeq: 1 });
  const remote = server();
  const originalRead = remote.read;
  remote.read = async () => ({ ...await originalRead(), revision: 2 });
  const s = session(t, store, remote);
  await s.start();
  assert.equal(s.getSnapshot().status, 'conflict');
  assert.equal(s.getSnapshot().canEdit, false);
  assert.equal(s.getSnapshot().data.tasks[0].title, 'Local edit');
  assert.equal(s.resolveConflict('remote'), true);
  assert.deepEqual(s.getSnapshot().data.tasks, []);
  assert.match(s.exportLocal(), /Local edit/);
});

test('offline load keeps the account-owned cache editable', async t => {
  const store = storage(); seed(store, { ...clean(), tasks: [task('Available offline').payload] });
  const offline = Object.assign(new Error('Network unavailable'), { kind: 'offline' });
  const s = session(t, store, { read: async () => { throw offline; }, save: async () => { throw offline; } });
  await s.start();
  assert.equal(s.getSnapshot().status, 'offline');
  assert.equal(s.getSnapshot().canEdit, true);
  assert.equal(s.dispatch(task('Offline edit')), true);
  assert.equal(JSON.parse(store.getItem(getLocalStorageKey('alice'))).data.tasks[0].title, 'Offline edit');
});

test('writes are serialized and an old acknowledgment never erases a newer edit', async t => {
  const store = storage(); seed(store, clean());
  const remote = server(); const write = remote.save;
  let release; const calls = [];
  remote.save = async (owner, mutation) => { calls.push(mutation); if (calls.length === 1) await new Promise(resolve => { release = resolve; }); return write(owner, mutation); };
  const s = session(t, store, remote); await s.start();
  s.dispatch(task('First')); s.dispatch(task('Second'));
  assert.equal(calls.length, 1);
  release(); await drain(s);
  assert.equal(calls.length, 2);
  assert.deepEqual((await remote.read()).data.tasks.map(item => item.title), ['Second', 'First']);
  assert.equal(s.getSnapshot().status, 'ready');
  assert.deepEqual(s.getSnapshot().data.tasks.map(item => item.title), ['Second', 'First']);
});

test('a disposed session cannot write a late acknowledgment to storage', async t => {
  const store = storage(); seed(store, clean());
  const remote = server(); const write = remote.save; let release;
  remote.save = async (...args) => { await new Promise(resolve => { release = resolve; }); return write(...args); };
  const s = session(t, store, remote); await s.start(); s.dispatch(task('Pending'));
  const pending = s.flush(); const before = store.getItem(getLocalStorageKey('alice'));
  s.dispose(); release(); await pending;
  assert.equal(store.getItem(getLocalStorageKey('alice')), before);
});

test('a lost response is recovered by mutation ID after restarting', async t => {
  const store = storage(); seed(store, clean()); const remote = server(); const write = remote.save;
  remote.save = async (...args) => { await write(...args); throw Object.assign(new Error('Lost response'), { kind: 'offline' }); };
  const first = session(t, store, remote); await first.start(); first.dispatch(task('Once')); await first.flush(); first.dispose();
  const second = session(t, store, remote); await second.start();
  assert.equal(second.getSnapshot().status, 'ready');
  assert.equal((await remote.read()).revision, 2);
  assert.equal(second.getSnapshot().data.tasks[0].title, 'Once');
});

test('unowned legacy data is only exported and never adopted', async t => {
  const store = storage(); store.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ tasks: [task('Someone else').payload] }));
  const s = session(t, store, server()); await s.start();
  assert.deepEqual(s.getSnapshot().data.tasks, []);
  assert.equal(s.getSnapshot().legacyAvailable, true);
  assert.match(s.exportLegacy(), /Someone else/);
});

test('a rejected local write leaves both the data and server unchanged', async t => {
  const store = storage(); seed(store, clean()); const remote = server();
  const s = session(t, store, remote); await s.start();
  store.setItem = () => { throw new Error('Quota exceeded'); };
  assert.equal(s.dispatch(task('Unsaved')), false);
  assert.deepEqual(s.getSnapshot().data.tasks, []);
  assert.equal(s.getSnapshot().status, 'error');
  assert.deepEqual((await remote.read()).data.tasks, []);
});

test('owned cached data opens before a slow server read completes', async t => {
  const store = storage(); seed(store, { ...clean(), tasks: [task('Cached').payload] });
  const remote = server(); const read = remote.read; let release;
  remote.read = async () => { await new Promise(resolve => { release = resolve; }); return read(); };
  const s = session(t, store, remote); const starting = s.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(s.getSnapshot().canEdit, true);
  assert.equal(s.getSnapshot().data.tasks[0].title, 'Cached');
  assert.equal(s.dispatch(task('Edited during load')), true);
  release(); await starting; await drain(s);
  assert.equal((await read()).data.tasks[0].title, 'Edited during load');
});

test('a retained local plan is uploaded again after resetting the development database', async t => {
  const store = storage(); seed(store, { ...clean(), tasks: [task('Retained locally').payload] });
  const writes = [];
  const s = session(t, store, { read: async () => null, save: async (_owner, write) => {
    writes.push(write);
    return { outcome: 'saved', revision: 1, mutationId: write.mutationId };
  } });
  await s.start(); await drain(s);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].expectedRevision, null);
  assert.equal(writes[0].data.tasks[0].title, 'Retained locally');
  assert.equal(s.getSnapshot().status, 'ready');
});

test('retry shares the pending read so a late stale read cannot erase an acknowledged edit', async t => {
  const store = storage(); seed(store, clean());
  const remote = server(); const read = remote.read; let release; let reads = 0;
  const gate = new Promise(resolve => { release = resolve; });
  remote.read = async () => { reads++; const captured = await read(); await gate; return captured; };
  const s = session(t, store, remote); const starting = s.start();
  await new Promise(resolve => setImmediate(resolve));
  const retrying = s.retry();
  release(); await Promise.all([starting, retrying]);
  assert.equal(reads, 1);
  s.dispatch(task('Acknowledged edit')); await drain(s);
  assert.equal(s.getSnapshot().data.tasks[0].title, 'Acknowledged edit');
  assert.equal(JSON.parse(store.getItem(getLocalStorageKey('alice'))).baseRevision, 2);
});

test('a completion click after 04:00 applies the reset before the user action', async t => {
  let clock = new Date('2026-06-02T03:59:59');
  const data = applyTimeRules(createInitialPlannerState(), clock);
  data.dailyTasks = [{ id: 'daily', title: 'Daily task', bucket: 'daily', status: 'planned' }];
  const store = storage(); seed(store, data);
  const s = createPlannerSession({ userId: 'alice', storage: store, remote: server(data), clock: () => clock, acquireLock: async () => () => {} });
  t.after(() => s.dispose()); await s.start();
  clock = new Date('2026-06-02T04:00:01');
  assert.equal(s.dispatch({ type: 'TOGGLE_DAILY_TASK_DONE', payload: { id: 'daily' } }), true);
  await drain(s);
  assert.equal(s.getSnapshot().data.dailyTasks[0].status, 'done');
});
