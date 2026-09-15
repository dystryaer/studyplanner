import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { startDemoApi, demoPassword } from '../scripts/demo-api.mjs';

test('Supabase client authenticates and writes through the local demo to SQL', async () => {
  const api = await startDemoApi({ port: 0 });
  const client = createClient(api.url, 'local-public-key', { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const login = await client.auth.signInWithPassword({ email: 'alice@planner.test', password: demoPassword });
    assert.equal(login.error, null);
    const userId = login.data.user.id;
    const args = { p_user_id: userId, p_state: { tasks: [] }, p_expected_revision: null, p_mutation_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    const saved = await client.rpc('save_planner_state', args);
    assert.equal(saved.error, null);
    assert.equal(saved.data[0].outcome, 'saved');
    assert.equal(saved.data[0].revision, 1);
    const read = await client.from('planner_states').select('state_json,revision,last_mutation_id').eq('user_id', userId).maybeSingle();
    assert.equal(read.error, null);
    assert.deepEqual(read.data.state_json, { tasks: [] });
    const stale = await client.rpc('save_planner_state', { ...args, p_mutation_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    assert.equal(stale.data[0].outcome, 'conflict');
    await client.auth.signOut();
  } finally { await api.close(); }
});
