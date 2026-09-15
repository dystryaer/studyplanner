import { parsePlannerState } from '../domain/plannerState.js';

function remoteError(error) {
  const result = new Error(error.message || 'Cloud sync failed.');
  result.code = error.code;
  result.kind = ['42703', '42P01', 'PGRST202', 'PGRST204'].includes(error.code)
    ? 'schema'
    : ['42501', 'PGRST301', 'bad_jwt'].includes(error.code) || error.status === 401
      ? 'auth'
      : !error.code || /fetch|network/i.test(error.message) ? 'offline' : 'remote';
  return result;
}

function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    const error = new Error('Cloud sync returned an invalid revision.');
    error.kind = 'invalid-data';
    throw error;
  }
  return value;
}

export function createRemotePlannerApi(client) {
  return {
    async read(userId) {
      const { data, error } = await client.from('planner_states')
        .select('state_json,revision,last_mutation_id').eq('user_id', userId).maybeSingle();
      if (error) throw remoteError(error);
      if (!data) return null;
      try {
        return { data: parsePlannerState(data.state_json), revision: revision(data.revision), mutationId: data.last_mutation_id };
      } catch (error) {
        error.kind = 'invalid-data';
        throw error;
      }
    },
    async save(userId, { data, expectedRevision, mutationId }) {
      const result = await client.rpc('save_planner_state', {
        p_user_id: userId, p_state: data, p_expected_revision: expectedRevision, p_mutation_id: mutationId,
      });
      if (result.error) throw remoteError(result.error);
      const row = result.data?.[0];
      if (!row || !['saved', 'conflict'].includes(row.outcome)) {
        const error = new Error('Cloud sync returned an invalid response.');
        error.kind = 'invalid-data';
        throw error;
      }
      return {
        outcome: row.outcome,
        revision: row.revision === null && row.outcome === 'conflict' ? null : revision(row.revision),
        mutationId: row.mutation_id,
      };
    },
  };
}
