import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/');
  await page.getByLabel('Email').fill('alice@planner.test');
  await page.getByLabel('Password', { exact: true }).fill('PlannerDev-2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
}

async function add(page, title) {
  const input = page.getByPlaceholder('study math Ch.2');
  if (!(await input.isVisible())) await page.getByRole('button', { name: 'New Task', exact: true }).click();
  await input.fill(title);
  await input.locator('..').getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('article').filter({ hasText: title }).getByRole('button', { name: 'This week', exact: true }).click();
}

async function drag(page, handle, target) {
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  expect(to.y + to.height / 2).toBeLessThan(page.viewportSize().height);
  expect(to.y).toBeGreaterThanOrEqual(0);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 8, from.y + from.height / 2, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();
}

test('drag reorders down and self-drop leaves order unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  await login(page);
  for (const title of ['Drag Alpha', 'Drag Beta', 'Drag Gamma']) await add(page, title);
  const cards = page.locator('.week-group-cards .task-card').filter({ hasText: /Drag (Alpha|Beta|Gamma)/ });
  await expect(cards.locator('.task-title-text')).toHaveText(['Drag Alpha', 'Drag Beta', 'Drag Gamma']);
  await drag(page, cards.nth(0).getByRole('button', { name: 'Drag task' }), cards.nth(1));
  await expect(cards.locator('.task-title-text')).toHaveText(['Drag Beta', 'Drag Alpha', 'Drag Gamma']);
  await drag(page, cards.nth(1).getByRole('button', { name: 'Drag task' }), cards.nth(1));
  await expect(cards.locator('.task-title-text')).toHaveText(['Drag Beta', 'Drag Alpha', 'Drag Gamma']);
  await page.reload();
  await expect(cards.locator('.task-title-text')).toHaveText(['Drag Beta', 'Drag Alpha', 'Drag Gamma']);
});

test('edit and move drafts can retry a failed local save inside the dialog', async ({ page }) => {
  await login(page);
  await add(page, 'Retry modal task');
  const card = page.getByRole('article').filter({ hasText: 'Retry modal task' });
  for (const action of ['Edit task', 'Move to']) {
    await card.getByRole('button', { name: action }).click();
    const dialog = page.getByRole('dialog');
    if (action === 'Edit task') await dialog.getByLabel('Name', { exact: true }).fill('Retry modal task edited');
    else await dialog.getByLabel('Destination').selectOption('backlog');
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      window.restoreStorage = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function (key, value) {
        if (!key.startsWith('sb-')) throw new DOMException('Storage is full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Try again' })).toBeVisible();
    if (action === 'Edit task') await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Retry modal task edited');
    else await expect(dialog.getByLabel('Destination')).toHaveValue('backlog');
    await page.evaluate(() => window.restoreStorage());
    await dialog.getByRole('button', { name: 'Try again' }).click();
    await expect(dialog.getByRole('button', { name: 'Try again' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  await page.reload();
  await expect(page.locator('.backlog-panel').getByText('Retry modal task edited', { exact: true })).toBeVisible();
});

test('browsing a future week does not turn current work into a past-week review', async ({ page }) => {
  await login(page);
  await add(page, 'This week stays current');
  await page.getByRole('button', { name: 'Next Week', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Previous week review' })).toHaveCount(0);
});

test('mobile drafts survive navigation and desktop resize keeps a useful view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('study math Ch.2').fill('Mobile draft stays');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByPlaceholder('study math Ch.2')).toHaveValue('Mobile draft stays');
  await page.getByRole('button', { name: 'Routines', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('study math Ch.2')).toHaveValue('Mobile draft stays');
});

test('dragging a timed task to Done retains its agenda slot after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1800 });
  await login(page);
  await add(page, 'Timed completion');
  const card = page.getByRole('article').filter({ hasText: 'Timed completion' });
  await card.getByRole('button', { name: 'Move to' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Destination').selectOption('day');
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  await dialog.getByLabel('Date', { exact: true }).fill(date);
  await dialog.getByLabel('Start time').fill('09:00');
  await dialog.getByLabel('End time').fill('10:00');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  const done = page.locator('.board-main > .panel').filter({ has: page.getByRole('heading', { name: 'Done', exact: true }) });
  await drag(page, card.getByRole('button', { name: 'Drag task' }), done.locator('.droppable-task-list'));
  await expect(card).toHaveCount(0);
  await expect(page.locator('.agenda-task-chip').filter({ hasText: 'Timed completion' })).toContainText('Done');
  await page.reload();
  await page.getByRole('button', { name: /Completed tasks/ }).click();
  await expect(card).toContainText('Planned for:');
  await expect(card).toContainText('09:00 - 10:00');
  await expect(card.getByRole('button', { name: 'Reopen task' })).toBeVisible();
});

test('overdue view surfaces a backlog deadline without requiring week placement', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'New Task', exact: true }).click();
  const input = page.getByPlaceholder('study math Ch.2');
  await input.fill('Backlog deadline');
  await page.getByLabel('Due date (optional)', { exact: true }).fill('2020-01-01');
  await input.locator('..').getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Overdue', exact: true }).click();
  const card = page.locator('.board-main .task-card').filter({ hasText: 'Backlog deadline' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Due date: 01.01.2020');
  await expect(card.getByRole('button', { name: 'Drag task' })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Move to' })).toBeVisible();
});
