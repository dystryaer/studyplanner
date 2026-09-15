import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createDevDatabase, asUser, devUsers } from '../scripts/dev-database.mjs';

test('database enforces owner isolation, revisions and idempotent retries', async t => {
  const db = await createDevDatabase();
  t.after(() => db.close());
  const [alice, bob] = devUsers;
  const write = (owner, revision, mutation, title, caller = owner) => asUser(db, caller, tx => tx.query(
    'SELECT * FROM public.save_planner_state($1, $2::jsonb, $3, $4)',
    [owner, JSON.stringify({ tasks: [{ title }] }), revision, mutation],
  )).then(result => result.rows[0]);
  const firstMutation = randomUUID();
  assert.deepEqual(await write(alice.id, null, firstMutation, 'first'), { outcome: 'saved', revision: 1, mutation_id: firstMutation });
  assert.deepEqual(await write(alice.id, null, firstMutation, 'first'), { outcome: 'saved', revision: 1, mutation_id: firstMutation });
  const nextMutation = randomUUID();
  assert.equal((await write(alice.id, 1, nextMutation, 'latest')).revision, 2);
  assert.equal((await write(alice.id, 1, randomUUID(), 'stale')).outcome, 'conflict');
  assert.equal((await write(alice.id, null, randomUUID(), 'competing insert')).outcome, 'conflict');
  const own = await asUser(db, alice.id, tx => tx.query('SELECT state_json, revision FROM public.planner_states'));
  assert.deepEqual(own.rows, [{ state_json: { tasks: [{ title: 'latest' }] }, revision: 2 }]);
  const other = await asUser(db, bob.id, tx => tx.query('SELECT state_json FROM public.planner_states'));
  assert.deepEqual(other.rows, []);
  await assert.rejects(write(alice.id, 2, randomUUID(), 'wrong owner', bob.id), { code: '42501' });
  await assert.rejects(asUser(db, alice.id, tx => tx.query("UPDATE public.planner_states SET state_json = '{}'")), { code: '42501' });
  await assert.rejects(write(alice.id, 2, nextMutation, 'different data'), { code: '22023' });
  const migration = await readFile(new URL('../supabase/migrations/202609140001_planner_sync.sql', import.meta.url), 'utf8');
  await db.exec('GRANT ALL ON public.planner_states TO PUBLIC');
  await db.exec(migration);
  await assert.rejects(asUser(db, alice.id, tx => tx.query("UPDATE public.planner_states SET state_json = '{}'")), { code: '42501' });
  const retained = await asUser(db, alice.id, tx => tx.query('SELECT state_json, revision FROM public.planner_states'));
  assert.deepEqual(retained.rows, own.rows);
});
