import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect } from '@playwright/test';
import { demoPassword } from '../../../../scripts/demo-api.mjs';
import { asUser, devUsers } from '../../../../scripts/dev-database.mjs';

export async function verifyMappedFeatures({ page, api, evidence, report }) {
  const button = name => page.getByRole('button', { name, exact: true });
  const saved = () => expect(page.getByRole('region', { name: 'Save status' })).toContainText('Saved');
  const screenshot = name => page.screenshot({ path: resolve(evidence, `${name}.png`), fullPage: true });
  const readPlan = async () => {
    const result = await asUser(api.db, devUsers[0].id, tx => tx.query('SELECT state_json, revision FROM public.planner_states'));
    return result.rows[0];
  };

  await button('New Task').click();
  const taskInput = page.getByPlaceholder('study math Ch.2');
  await taskInput.fill('Maintenance draft');
  await button('New Event').click();
  await button('New Task').click();
  await expect(taskInput).toHaveValue('Maintenance draft');
  await screenshot('tasks-draft');
  report.actions.push('Tasks: switching to New Event and back preserved the unfinished title.');

  await button('New Daily Task').click();
  const dailyInput = page.getByPlaceholder('Anki Cards');
  await dailyInput.fill('Maintenance daily task');
  await dailyInput.locator('..').getByRole('button', { name: 'Save', exact: true }).click();
  await saved();
  await button('Settings').click();
  await page.getByPlaceholder('Category name').first().fill('Maintenance category');
  await expect(page.getByPlaceholder('Category name').last()).toHaveValue('Other');
  await button('Dark').click();
  await screenshot('settings-before-save');
  await button('Save changes').click();
  await saved();
  await page.reload();
  await saved();
  await expect(page.getByRole('article').filter({ hasText: 'Maintenance daily task' })).toContainText('Maintenance category');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  for (const exit of ['Cancel', 'Close settings', 'Escape', 'backdrop']) {
    await button('Settings').click();
    await page.getByPlaceholder('Category name').first().fill('Discarded category');
    if (exit === 'Escape') await page.keyboard.press('Escape');
    else if (exit === 'backdrop') await page.locator('.modal-backdrop').click({ position: { x: 4, y: 4 } });
    else await button(exit).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await button('Settings').click();
    await expect(page.getByPlaceholder('Category name').first()).toHaveValue('Maintenance category');
    await button('Cancel').click();
  }
  await screenshot('settings-after-reload');
  const settings = await readPlan();
  assert.equal(settings.state_json.userSettings.theme, 'dark');
  assert(settings.state_json.dailyTasks.some(task => task.title === 'Maintenance daily task'));
  report.actions.push('Settings: daily category and dark theme survived reload; Cancel, Close settings, Escape and the backdrop discarded unsaved category edits.');

  const beforeOffline = await readPlan();
  await page.route('**/rest/v1/**', route => route.abort());
  await button('New Task').click();
  await taskInput.fill('Maintenance offline task');
  await taskInput.locator('..').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Save status' })).toContainText('Offline', { timeout: 20000 });
  await page.reload();
  await expect(page.getByText('Maintenance offline task', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Save status' })).toContainText('Offline', { timeout: 20000 });
  const duringOffline = await readPlan();
  assert.equal(duringOffline.revision, beforeOffline.revision);
  assert(!duringOffline.state_json.tasks.some(task => task.title === 'Maintenance offline task'));
  await screenshot('sync-offline');
  await page.unroute('**/rest/v1/**');
  await button('Try again').click();
  await saved();
  await page.reload();
  await saved();
  await expect(page.getByText('Maintenance offline task', { exact: true })).toBeVisible();
  const afterOffline = await readPlan();
  assert.equal(afterOffline.state_json.tasks.filter(task => task.title === 'Maintenance offline task').length, 1);
  assert(Number(afterOffline.revision) > Number(beforeOffline.revision));
  await writeFile(resolve(evidence, 'sync-database.json'), JSON.stringify({ beforeOffline, duringOffline, afterOffline }, null, 2));
  await screenshot('sync-reconnected');
  report.actions.push('Sync: offline task survived reload without changing the SQL revision; Try again persisted exactly one task after reconnecting.');

  await button('Logout').click();
  await expect(button('Sign in')).toBeVisible();
  await page.reload();
  await expect(button('Sign in')).toBeVisible();
  await page.getByRole('textbox', { name: 'Email' }).fill(devUsers[1].email);
  await page.getByLabel('Password', { exact: true }).fill(demoPassword);
  await button('Sign in').click();
  await saved();
  await expect(page.getByText('Verification persistence task', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Maintenance offline task', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Maintenance daily task', { exact: true })).toHaveCount(0);
  await screenshot('accounts-bob');
  const bob = await asUser(api.db, devUsers[1].id, tx => tx.query('SELECT user_id, state_json FROM public.planner_states'));
  assert.equal(bob.rows.length, 1);
  assert.equal(bob.rows[0].user_id, devUsers[1].id);
  assert.deepEqual(bob.rows[0].state_json.tasks, []);
  await writeFile(resolve(evidence, 'accounts-database.json'), JSON.stringify(bob.rows, null, 2));
  report.actions.push('Accounts: Logout remained effective after reload; Bob saw none of Alice\'s tasks and read only his own empty SQL plan.');
  const waitingTab = await page.context().newPage();
  try {
    await waitingTab.goto('/');
    await expect(waitingTab.getByRole('region', { name: 'Save status' })).toContainText('another tab');
    await waitingTab.screenshot({ path: resolve(evidence, 'accounts-waiting-tab.png'), fullPage: true });
    await waitingTab.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(waitingTab.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await waitingTab.reload();
    await expect(waitingTab.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await waitingTab.screenshot({ path: resolve(evidence, 'accounts-startup-signed-out.png'), fullPage: true });
  } finally { await waitingTab.close(); }
  report.actions.push('Accounts: a second tab waiting for the writer exposed Sign out; using it kept the tab signed out after reload.');
  report.coveredFeatures = ['tasks', 'settings', 'sync', 'accounts'];
}
