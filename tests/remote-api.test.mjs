import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRemotePlannerApi } from '../src/api/remotePlannerApi.js';

test('a missing migration fails without falling back to an unchecked write', async () => {
  const calls = [];
  const remote = createRemotePlannerApi({ rpc: async (...args) => {
    calls.push(args);
    return { error: { code: 'PGRST202', message: 'Function not found' } };
  } });
  await assert.rejects(remote.save('owner', { data: {}, expectedRevision: 3, mutationId: 'mutation' }), { kind: 'schema' });
  assert.deepEqual(calls, [['save_planner_state', { p_user_id: 'owner', p_state: {}, p_expected_revision: 3, p_mutation_id: 'mutation' }]]);
});

test('unsupported remote state is a data error rather than an offline response', async () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { state_json: { version: 999 }, revision: 1 } }) };
  const remote = createRemotePlannerApi({ from: () => query });
  await assert.rejects(remote.read('owner'), { kind: 'invalid-data' });
});
