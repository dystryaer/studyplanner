import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { startDemoApi, demoPassword } from './demo-api.mjs';

const args = process.argv.slice(2);
const memory = args.includes('--memory');
const portIndex = args.indexOf('--port');
const port = portIndex < 0 ? 5173 : Number(args[portIndex + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use --port with a port number between 1 and 65535.');
if (!memory) await mkdir('.local-dev', { recursive: true });
const api = await startDemoApi({ port: memory ? 0 : 54329, dataDir: memory ? undefined : '.local-dev/pgdata' });
process.env.VITE_SUPABASE_URL = api.url;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'local-demo-public-key';
process.env.VITE_DEV_DEMO = 'true';
const vite = await createServer({ server: { host: '127.0.0.1', port, strictPort: true } });
try { await vite.listen(); } catch (error) { await api.close(); throw error; }
console.log(`Local demo: http://127.0.0.1:${port}\nAccounts: alice@planner.test / bob@planner.test\nDemo password: ${demoPassword}\nFixed test authentication. Use only fictitious data.`);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await vite.close();
  await api.close();
  process.exit(0);
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
