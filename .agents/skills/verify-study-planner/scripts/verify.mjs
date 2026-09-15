import assert from 'node:assert/strict';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer as createPortProbe } from 'node:net';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { startDemoApi, demoPassword } from '../../../../scripts/demo-api.mjs';
import { asUser, devUsers } from '../../../../scripts/dev-database.mjs';
import { verifyMappedFeatures } from './mapped-features.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
process.chdir(root);
const doctorOnly = process.argv[2] === '--doctor';
const allFeatures = process.argv[2] === '--all';
assert(process.argv.length === 2 || ((doctorOnly || allFeatures) && process.argv.length === 3), 'Usage: node .agents/skills/verify-study-planner/scripts/verify.mjs [--doctor|--all]');
const evidence = resolve('.pstack/verification/study-planner', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
await mkdir(evidence, { recursive: true });
const report = { startedAt: new Date().toISOString(), mode: doctorOnly ? 'doctor' : allFeatures ? 'mapped-features' : 'task-persistence', actions: [], passed: false };
const json = (name, value) => writeFile(resolve(evidence, name), JSON.stringify(value, null, 2));
let api, vite, browser, context, page;
let tracing = false;
try {
  api = await startDemoApi({ port: 0 });
  process.env.VITE_SUPABASE_URL = api.url;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'local-demo-public-key';
  process.env.VITE_DEV_DEMO = 'true';
  // Vite treats port 0 as its default port. Select a free port explicitly.
  const probe = createPortProbe();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  vite = await createServer({ root, base: '/', server: { host: '127.0.0.1', port, strictPort: true } });
  await vite.listen();
  const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
  report.urls = { app: url, api: api.url };
  browser = await chromium.launch();
  context = await browser.newContext({ baseURL: url });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  tracing = true;
  page = await context.newPage();
  await page.goto('/');
  // Read-only checks against handles created by this process.
  assert(vite.httpServer.listening);
  assert.equal((await fetch(url)).status, 200);
  assert.equal((await fetch(`${api.url}/auth/v1/user`)).status, 401);
  const initial = await api.db.query('SELECT count(*)::int AS count FROM public.planner_states');
  assert.equal(initial.rows[0].count, 0);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await json('doctor.json', { healthy: true, ownedByPid: process.pid, urls: report.urls, initialRows: 0, anonymousAuthStatus: 401 });
  console.log(`Doctor passed. Evidence: ${evidence}`);
  if (!doctorOnly) {
    await page.getByRole('textbox', { name: 'Email' }).fill(devUsers[0].email);
    await page.getByLabel('Password', { exact: true }).fill(demoPassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Save status' })).toContainText('Saved');
    report.actions.push('Signed in through the local demo login form.');
    await page.getByRole('button', { name: 'New Task', exact: true }).click();
    const title = 'Verification persistence task';
    const input = page.getByPlaceholder('study math Ch.2');
    await input.fill(title);
    await page.screenshot({ path: resolve(evidence, 'before-save.png'), fullPage: true });
    await input.locator('..').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Save status' })).toContainText('Saved');
    await expect(input).toHaveValue('');
    report.actions.push('Filled the task title and clicked the form Save button; the draft cleared and status became Saved.');
    await page.reload();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Save status' })).toContainText('Saved');
    await page.screenshot({ path: resolve(evidence, 'after-reload.png'), fullPage: true });
    await writeFile(resolve(evidence, 'after-reload.aria.txt'), await page.locator('body').ariaSnapshot());
    const result = await asUser(api.db, devUsers[0].id, tx => tx.query('SELECT user_id, state_json, revision FROM public.planner_states'));
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].user_id, devUsers[0].id);
    assert.equal(result.rows[0].state_json.tasks.filter(task => task.title === title).length, 1);
    assert(Number(result.rows[0].revision) >= 1);
    await json('database.json', result.rows);
    report.actions.push('Reloaded the browser; the task remained visible and exactly one matching task exists in the account-owned SQL row.');
    if (allFeatures) await verifyMappedFeatures({ page, api, evidence, report });
  }
  report.passed = true;
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: resolve(evidence, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  const errors = [];
  const close = async (name, action) => { try { await action(); } catch (error) { errors.push(`${name}: ${error.message}`); } };
  if (tracing) await close('trace', () => context.tracing.stop({ path: resolve(evidence, 'trace.zip') }));
  if (browser) await close('browser', () => browser.close());
  if (vite) await close('vite', () => vite.close());
  if (api) await close('api/database', () => api.close());
  report.cleanup = { completed: errors.length === 0, errors };
  if (errors.length) { report.passed = false; process.exitCode = 1; }
  report.finishedAt = new Date().toISOString();
  await json('report.json', report);
  assert((await stat(resolve(evidence, 'report.json'))).size > 0);
  console.log(`${report.passed ? 'PASS' : 'FAIL'}; cleanup ${report.cleanup.completed ? 'complete' : 'failed'}; evidence retained at ${evidence}`);
  if (report.error) console.error(report.error);
}
