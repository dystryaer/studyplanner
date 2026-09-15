import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createRemotePlannerApi } from '../src/api/remotePlannerApi.js';
import { createInitialPlannerState } from '../src/domain/plannerState.js';

const status = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8' });
if (status.status !== 0) throw new Error('Start local Supabase with npm run dev:local first.');
const config = JSON.parse(status.stdout);
if (!['127.0.0.1', 'localhost'].includes(new URL(config.API_URL).hostname)) throw new Error('These tests only run against local Supabase.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const accounts = [];
try {
  for (let i = 0; i < 2; i++) {
    const email = `planner-test-${randomUUID()}@planner.test`;
    const password = randomUUID();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    accounts.push({ id: created.data.user.id });
    const client = createClient(config.API_URL, config.ANON_KEY, options);
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    Object.assign(accounts.at(-1), { client, remote: createRemotePlannerApi(client) });
  }
  const [alice, bob] = accounts;
  const data = createInitialPlannerState();
  const first = { data, expectedRevision: null, mutationId: randomUUID() };
  assert.equal(await alice.remote.read(alice.id), null);
  assert.deepEqual(await alice.remote.save(alice.id, first), { outcome: 'saved', revision: 1, mutationId: first.mutationId });
  assert.equal((await alice.remote.save(alice.id, first)).revision, 1);
  assert.equal(await bob.remote.read(alice.id), null);
  await assert.rejects(bob.remote.save(alice.id, { ...first, mutationId: randomUUID() }), { kind: 'auth' });
  const writes = ['first writer', 'second writer'].map(title => ({
    data: { ...data, tasks: [{ id: randomUUID(), title, bucket: 'backlog', status: 'planned' }] },
    expectedRevision: 1, mutationId: randomUUID(),
  }));
  const results = await Promise.all(writes.map(write => alice.remote.save(alice.id, write)));
  assert.deepEqual(results.map(result => result.outcome).sort(), ['conflict', 'saved']);
  const winner = writes[results.findIndex(result => result.outcome === 'saved')];
  const stored = await alice.remote.read(alice.id);
  assert.equal(stored.revision, 2);
  assert.equal(stored.data.tasks[0].title, winner.data.tasks[0].title);
  assert.equal((await alice.remote.save(alice.id, winner)).revision, 2);
  console.log('Local Supabase passed: real authentication, account isolation, concurrent revision check and idempotent retry.');
} finally {
  const cleanup = await Promise.all(accounts.map(account => admin.auth.admin.deleteUser(account.id)));
  for (const result of cleanup) if (result.error) throw result.error;
}
