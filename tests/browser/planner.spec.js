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

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isoWeekKey(date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${pad(week)}`;
}

function shiftIsoWeekKey(date, delta) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + delta * 7);
  return isoWeekKey(shifted);
}

function uniqueTitle(label) {
  return `${label} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

test('week moves keep due dates after reload and group by category with collapsed done', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Add task category' }).click();
  await page.getByPlaceholder('Category name').nth(1).fill('Math filter');
  await page.getByRole('button', { name: 'Add task category' }).click();
  await page.getByPlaceholder('Category name').nth(2).fill('Bio filter');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await saved(page);

  const due = toDateKey(new Date(Date.now() + 5 * 86400000));
  const mathTitle = uniqueTitle('Math grouped');
  const otherTitle = uniqueTitle('Other grouped');
  await page.getByRole('button', { name: 'New Task', exact: true }).click();
  const taskForm = page.getByPlaceholder('study math Ch.2').locator('..');
  await page.getByPlaceholder('study math Ch.2').fill(mathTitle);
  await expect(taskForm.locator('select')).toContainText('Math filter');
  await taskForm.locator('select').selectOption({ label: 'Math filter' });
  await taskForm.locator('input[type="date"]').fill(due);
  await taskForm.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  await page.getByPlaceholder('study math Ch.2').fill(otherTitle);
  await taskForm.locator('select').selectOption({ label: 'Bio filter' });
  await taskForm.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);

  const mathCard = page.getByRole('article').filter({ hasText: mathTitle });
  await mathCard.getByRole('button', { name: 'This week', exact: true }).click();
  await saved(page);
  const otherCard = page.getByRole('article').filter({ hasText: otherTitle });
  await otherCard.getByRole('button', { name: 'This week', exact: true }).click();
  await saved(page);

  await page.getByRole('article').filter({ hasText: mathTitle }).getByRole('button', { name: 'Move to' }).click();
  await expect(page.getByRole('dialog', { name: 'Move to' })).toBeVisible();
  await page.getByLabel('Destination').selectOption('day');
  const planDate = toDateKey(new Date());
  await page.getByLabel('Date', { exact: true }).fill(planDate);
  await page.getByLabel('Start time').fill('09:00');
  await page.getByLabel('End time').fill('10:30');
  await page.getByRole('dialog', { name: 'Move to' }).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Move to' })).toHaveCount(0);
  await saved(page);

  await page.reload();
  const reloaded = page.getByRole('article').filter({ hasText: mathTitle });
  await expect(reloaded).toContainText('Math filter');
  await expect(reloaded).toContainText('Planned for:');
  await expect(reloaded).toContainText('Due date:');
  await expect(reloaded).toContainText('09:00 - 10:30');

  await page.getByRole('button', { name: 'Math filter', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: mathTitle })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: otherTitle })).toHaveCount(0);

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('article').filter({ hasText: otherTitle }).getByRole('button', { name: 'Done', exact: true }).click();
  await saved(page);
  await expect(page.getByText('Completed tasks are collapsed.')).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: otherTitle })).toHaveCount(0);
  await page.getByRole('button', { name: /Completed tasks/ }).click();
  await expect(page.getByRole('article').filter({ hasText: otherTitle })).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop-week.png', fullPage: true });
});

test('appointment edits show in calendar and week and date drag updates both', async ({ page }) => {
  await login(page);
  const title = uniqueTitle('Shared appointment');
  const renamed = `${title} edited`;
  const today = new Date();
  await page.getByRole('button', { name: 'New Event', exact: true }).click();
  const eventForm = page.getByPlaceholder('exam').locator('..');
  await page.getByPlaceholder('exam').fill(title);
  await eventForm.locator('input[type="date"]').fill(toDateKey(today));
  await eventForm.getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  await expect(page.getByRole('complementary', { name: 'Weekly agenda' }).getByText(title, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  const calendarCard = page.getByRole('group', { name: title });
  await expect(calendarCard.first()).toBeVisible();
  await calendarCard.first().getByRole('button', { name: 'Edit appointment' }).click();
  await page.getByRole('dialog', { name: 'Edit appointment' }).getByLabel('Name').fill(renamed);
  await page.getByRole('dialog', { name: 'Edit appointment' }).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Edit appointment' })).toHaveCount(0);
  await saved(page);
  await expect(page.getByText(renamed, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Week', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Weekly agenda' }).getByText(renamed, { exact: true })).toBeVisible();

  const agenda = page.getByRole('complementary', { name: 'Weekly agenda' });
  const originHeading = await agenda.locator('.agenda-day').filter({ has: page.getByRole('group', { name: renamed }) }).locator('h3').innerText();
  const handle = agenda.getByRole('button', { name: 'Drag appointment' });
  const targetDay = agenda.locator('.agenda-day').filter({ hasText: originHeading.startsWith('Fri') ? 'Mon' : 'Fri' });
  const from = await handle.boundingBox();
  const to = await targetDay.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 8, { steps: 4 });
  await page.mouse.move(to.x + 40, to.y + 28, { steps: 20 });
  await page.mouse.up();
  await saved(page);
  const movedDay = agenda.locator('.agenda-day').filter({ has: page.getByRole('group', { name: renamed }) });
  await expect(movedDay).toBeVisible();
  await expect(movedDay.locator('h3')).not.toHaveText(originHeading);
  const movedLabel = await movedDay.locator('h3').innerText();
  const dayNumber = Number(movedLabel.match(/(\d{2})\./)[1]);
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.locator(`.calendar-grid button.calendar-day-btn:not(.is-muted)[aria-label^="Day ${dayNumber}"]`).click();
  await expect(page.getByRole('group', { name: renamed }).first()).toBeVisible();
});

test('previous-week review can carry work or return it to the backlog', async ({ page }) => {
  await login(page);
  const carryTitle = uniqueTitle('Carry review');
  const backlogTitle = uniqueTitle('Backlog review');
  await addTask(page, carryTitle);
  await addTask(page, backlogTitle);
  await saved(page);
  for (const title of [carryTitle, backlogTitle]) {
    await page.getByRole('article').filter({ hasText: title }).getByRole('button', { name: 'This week', exact: true }).click();
    await saved(page);
    await page.getByRole('article').filter({ hasText: title }).getByRole('button', { name: 'Move to' }).click();
    await page.getByRole('dialog', { name: 'Move to' }).getByLabel('Destination').selectOption('week');
    await page.getByRole('dialog', { name: 'Move to' }).locator('input[type="week"]').fill(shiftIsoWeekKey(new Date(), -1));
    await page.getByRole('dialog', { name: 'Move to' }).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Move to' })).toHaveCount(0);
    await saved(page);
  }
  await expect(page.getByRole('region', { name: 'Previous week review' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Previous week review' })).toContainText(carryTitle);
  await expect(page.getByRole('region', { name: 'Previous week review' })).toContainText(backlogTitle);
  await page.getByRole('listitem').filter({ hasText: carryTitle }).getByRole('button', { name: 'Carry to this week' }).click();
  await saved(page);
  await page.getByRole('listitem').filter({ hasText: backlogTitle }).getByRole('button', { name: 'Move to backlog' }).click();
  await saved(page);
  await page.reload();
  await expect(page.getByRole('article').filter({ hasText: carryTitle })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: backlogTitle })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Previous week review' })).toHaveCount(0);
});

test('paused and skipped routines survive reload', async ({ page }) => {
  await login(page);
  const title = uniqueTitle('Routine persist');
  await page.getByRole('button', { name: 'New Daily Task', exact: true }).click();
  const input = page.getByPlaceholder('Anki Cards');
  await input.fill(title);
  await input.locator('..').getByRole('button', { name: 'Save', exact: true }).click();
  await saved(page);
  const row = page.locator('.routine-row').filter({ hasText: title });
  await row.getByRole('button', { name: 'Skip today' }).click();
  await saved(page);
  await row.getByRole('button', { name: 'Pause' }).click();
  await saved(page);
  await page.reload();
  const reloaded = page.locator('.routine-row').filter({ hasText: title });
  await expect(reloaded.getByRole('button', { name: 'Undo skip' })).toBeVisible();
  await expect(reloaded.getByRole('button', { name: 'Resume' })).toBeVisible();
});

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('week is visible first without overflow and all sections are reachable', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Email' }).fill('alice@planner.test');
    await page.getByLabel('Password', { exact: true }).fill('PlannerDev-2026!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'This Week' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Planner sections' })).toBeVisible();
    const weekBox = await page.getByRole('heading', { name: 'This Week' }).boundingBox();
    expect(weekBox.y).toBeLessThan(420);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBeFalsy();
    await expect(page.getByRole('button', { name: 'New Task', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(page.getByLabel('Monthly Calendar')).toBeVisible();
    await page.getByRole('button', { name: 'Routines', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Daily routines' })).toBeVisible();
    await page.getByRole('button', { name: 'Backlog', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Backlog', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('button', { name: 'New Task', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'This Week' })).toBeVisible();
    await page.screenshot({ path: 'test-results/mobile-390-week.png', fullPage: true });
  });
});
