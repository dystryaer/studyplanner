import { test, expect } from '@playwright/test';

async function login(page, email = 'alice@planner.test') {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('PlannerDev-2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New Task', exact: true })).toBeVisible();
}

async function addTask(page, title) {
  const input = page.getByPlaceholder('study math Ch.2');
  if (!(await input.isVisible())) await page.getByRole('button', { name: 'New Task', exact: true }).click();
  await input.fill(title);
  await input.locator('..').getByRole('button', { name: 'Save', exact: true }).click();
}

async function saved(page) {
  await expect(page.getByRole('region', { name: 'Save status' })).toContainText('Saved');
}

test('forms retain drafts, saved tasks survive reload and accounts stay separate', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'New Task', exact: true }).click();
  await page.getByPlaceholder('study math Ch.2').fill('Browser persistence task');
  await page.getByRole('button', { name: 'New Event', exact: true }).click();
  await page.getByRole('button', { name: 'New Task', exact: true }).click();
  await expect(page.getByPlaceholder('study math Ch.2')).toHaveValue('Browser persistence task');
  await addTask(page, 'Browser persistence task');
  await saved(page);
  await expect(page.getByPlaceholder('study math Ch.2')).toHaveValue('');
  await page.reload();
  await expect(page.getByText('Browser persistence task', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await login(page, 'bob@planner.test');
  await expect(page.getByText('Browser persistence task', { exact: true })).toHaveCount(0);
});

test('offline changes survive reload and sync after retry', async ({ page }) => {
  await login(page);
  await saved(page);
  await page.route('**/rest/v1/**', route => route.abort());
  await addTask(page, 'Offline browser task');
  await expect(page.getByRole('region', { name: 'Save status' })).toContainText('Offline', { timeout: 15000 });
  await page.reload();
  await expect(page.getByText('Offline browser task', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Save status' })).toContainText('Offline', { timeout: 15000 });
  await page.unroute('**/rest/v1/**');
  await page.getByRole('button', { name: 'Try again' }).click();
  await saved(page);
  await page.reload();
  await expect(page.getByText('Offline browser task', { exact: true })).toBeVisible();
});

test('another device produces an explicit conflict and preserves a recovery copy', async ({ browser, page }) => {
  await login(page);
  await saved(page);
  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5174' });
  const other = await otherContext.newPage();
  try {
    await login(other);
    await saved(other);
    await addTask(page, 'Winning server task');
    await saved(page);
    await addTask(other, 'Conflicting local task');
    await expect(other.getByRole('button', { name: 'Use server version' })).toBeVisible();
    await other.getByRole('button', { name: 'Use server version' }).click();
    await expect(other.getByText('Winning server task', { exact: true })).toBeVisible();
    await expect(other.getByText('Conflicting local task', { exact: true })).toHaveCount(0);
    const backups = await other.evaluate(() => Object.values(localStorage).filter(value => value.includes('Conflicting local task')));
    expect(backups.length).toBeGreaterThan(0);
  } finally { await otherContext.close(); }
});

test('only one tab writes and a waiting tab can take over', async ({ page, context }) => {
  await login(page);
  await saved(page);
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('region', { name: 'Save status' })).toContainText('another tab');
  await page.close();
  await other.getByRole('button', { name: 'Try again' }).click();
  await expect(other.getByRole('button', { name: 'New Task', exact: true })).toBeVisible();
  await addTask(other, 'New tab owner task');
  await saved(other);
});

test('a failed local write keeps the form draft available for retry', async ({ page }) => {
  await login(page);
  await saved(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) {
      if (!key.startsWith('sb-')) throw new DOMException('Storage is full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await addTask(page, 'Retained after storage failure');
  await expect(page.getByRole('region', { name: 'Save status' })).toContainText('could not be saved');
  await expect(page.getByPlaceholder('study math Ch.2')).toHaveValue('Retained after storage failure');
  await page.evaluate(() => window.restoreStorage());
  await page.getByRole('button', { name: 'Try again' }).click();
  await addTask(page, 'Retained after storage failure');
  await saved(page);
  await expect(page.getByText('Retained after storage failure', { exact: true })).toBeVisible();
});

test('daily tasks keep category identity after renaming and theme survives reload', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'New Daily Task', exact: true }).click();
  const input = page.getByPlaceholder('Anki Cards');
  await input.fill('Daily category task');
  await input.locator('..').getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const names = page.getByPlaceholder('Category name');
  await names.first().fill('Renamed study category');
  await expect(names.last()).toHaveValue('Other');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await saved(page);
  await page.reload();
  const card = page.getByRole('article').filter({ hasText: 'Daily category task' });
  await expect(card).toContainText('Renamed study category');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('an expired token still permits owned offline access and explicit logout stays logged out', async ({ page }) => {
  test.setTimeout(60000);
  await login(page);
  await addTask(page, 'Expired token offline task');
  await saved(page);
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    const session = JSON.parse(localStorage.getItem(key));
    session.expires_at = 1;
    localStorage.setItem(key, JSON.stringify(session));
  });
  let refreshRequests = 0;
  await page.route('**/auth/v1/token?grant_type=refresh_token', route => {
    refreshRequests++;
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Offline test' }) });
  });
  await page.route('**/rest/v1/**', route => route.abort());
  await page.reload();
  await expect(page.getByText('Expired token offline task', { exact: true })).toBeVisible({ timeout: 25000 });
  await expect.poll(() => refreshRequests).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByText('Expired token offline task', { exact: true })).toHaveCount(0);
});

test('logout cannot reopen a retained SDK session when the local owner write fails', async ({ page }) => {
  await login(page);
  await addTask(page, 'Log out safely');
  await saved(page);
  const retainedSession = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    return { key, value: localStorage.getItem(key) };
  });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), retainedSession);
  let releaseLogout;
  await page.route('**/auth/v1/logout**', async route => {
    await new Promise(resolve => { releaseLogout = resolve; });
    await route.fulfill({ status: 200, body: '{}' }).catch(() => {});
  });
  try {
    await page.evaluate(() => {
      Storage.prototype.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); };
    });
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await expect.poll(() => Boolean(releaseLogout)).toBe(true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByText('Log out safely', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('sb-') && key.endsWith('-auth-token')))).toBe(true);
  } finally { releaseLogout?.(); }
});
