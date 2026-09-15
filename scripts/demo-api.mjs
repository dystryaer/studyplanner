import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createDevDatabase, asUser, devUsers } from './dev-database.mjs';

export const demoPassword = 'PlannerDev-2026!';

export async function startDemoApi({ port = 54329, dataDir } = {}) {
  const db = await createDevDatabase(dataDir);
  const tokens = new Map();
  function session(user) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.${randomBytes(24).toString('base64url')}`;
    const refresh_token = randomBytes(32).toString('hex');
    const account = { ...user, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    tokens.set(access_token, account);
    tokens.set(refresh_token, account);
    return { access_token, refresh_token, expires_in: 3600, token_type: 'bearer', user: account };
  }
  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      response.writeHead(403).end();
      return;
    }
    response.setHeader('Access-Control-Allow-Origin', origin || 'http://127.0.0.1:5173');
    response.setHeader('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info,prefer,accept,accept-profile,content-profile,x-retry-count,x-supabase-api-version');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Content-Type', 'application/json');
    const send = (status, value) => { response.writeHead(status); response.end(JSON.stringify(value)); };
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      let raw = '';
      for await (const chunk of request) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 1024 * 1024) { send(413, { message: 'Request too large' }); return; }
      }
      const body = raw ? JSON.parse(raw) : {};
      if (url.pathname === '/auth/v1/token' && request.method === 'POST') {
        const user = url.searchParams.get('grant_type') === 'refresh_token'
          ? tokens.get(body.refresh_token)
          : body.password === demoPassword && devUsers.find(item => item.email === body.email);
        if (!user) { send(400, { code: 'invalid_credentials', message: 'Use a local demo account and password.' }); return; }
        send(200, session(user)); return;
      }
      const user = tokens.get(request.headers.authorization?.replace(/^Bearer /i, ''));
      if (!user) { send(401, { code: 'bad_jwt', message: 'Sign in to the local demo.' }); return; }
      if (url.pathname === '/auth/v1/user' && request.method === 'GET') { send(200, user); return; }
      if (url.pathname === '/auth/v1/logout' && request.method === 'POST') { send(200, {}); return; }
      if (url.pathname === '/rest/v1/planner_states' && request.method === 'GET') {
        const requestedUser = url.searchParams.get('user_id')?.replace(/^eq\./, '');
        const result = await asUser(db, user.id, tx => tx.query('SELECT state_json, revision, last_mutation_id FROM public.planner_states WHERE user_id = $1', [requestedUser]));
        send(200, result.rows); return;
      }
      if (url.pathname === '/rest/v1/rpc/save_planner_state' && request.method === 'POST') {
        const result = await asUser(db, user.id, tx => tx.query('SELECT * FROM public.save_planner_state($1, $2, $3, $4)', [body.p_user_id, body.p_state, body.p_expected_revision, body.p_mutation_id]));
        send(200, result.rows); return;
      }
      send(404, { message: 'This endpoint is not part of the local demo.' });
    } catch (error) {
      send(error.code === '42501' ? 403 : 400, { code: error.code || 'invalid_request', message: error.message, details: null, hint: null });
    }
  });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  } catch (error) {
    await db.close();
    throw error;
  }
  return { url: `http://127.0.0.1:${server.address().port}`, db, close: async () => { await new Promise(resolve => server.close(resolve)); await db.close(); } };
}
