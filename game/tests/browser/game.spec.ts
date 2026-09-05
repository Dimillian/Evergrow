import { test, expect } from '@playwright/test';

// Opt-in only: never part of npm run check. The user owns normal gameplay testing.
test('character creation, pause checkpoint and reload continue use the same slot', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The character hall' })).toBeVisible();
  await expect(page.locator('[data-slot]')).toHaveCount(8);
  await page.getByLabel('Name your wayfarer').fill('Browser test');
  await page.getByRole('button', { name: 'BEGIN JOURNEY' }).click();
  await expect(page.locator('.title-screen')).toBeHidden();
  expect(await page.evaluate(() => (window as any).__evergrow.sim.player.character.inventory.filter(Boolean).length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'PAUSED' })).toBeVisible();
  await page.getByRole('button', { name: 'SAVE & CHARACTER HALL' }).click();
  await expect(page.locator('[data-slot="0"]')).toContainText('Browser test');
  await page.reload();
  await expect(page.getByRole('button', { name: 'CONTINUE JOURNEY' })).toBeVisible();
  await page.getByRole('button', { name: 'CONTINUE JOURNEY' }).click();
  expect(await page.evaluate(() => (window as any).__evergrow.sim.player.name)).toBe('Browser test');
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-save-state')).toHaveText('Character saved locally.');
  expect(errors).toEqual([]);
});

test('title creation is keyboard accessible and selected character deletion is explicit', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Name your wayfarer').fill('Temporary');
  await page.getByRole('button', { name: 'BEGIN JOURNEY' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'SAVE & CHARACTER HALL' }).click();
  await page.getByRole('button', { name: 'Delete Temporary', exact: true }).click();
  await page.getByRole('button', { name: 'Keep character' }).click();
  await expect(page.locator('[data-slot="0"]')).toContainText('Temporary');
  await page.getByRole('button', { name: 'Delete Temporary', exact: true }).click();
  await page.getByRole('button', { name: 'Delete character', exact: true }).click();
  await page.reload();
  await expect(page.locator('[data-slot="0"]')).toContainText('New journey');
});

test('the title retains mute preferences and follows system motion without remote assets', async ({ page }) => {
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  await page.addInitScript(() => localStorage.setItem('evergrow-preferences', JSON.stringify({ muted: true })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EVERGROW', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('evergrow-preferences')!))).toEqual({ muted: true });
  expect(await page.evaluate(() => (window as any).__evergrow.reducedMotion)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.evaluate(() => (window as any).__evergrow.reducedMotion)).toBe(false);
  expect(requests.filter(url => /^https?:/.test(url) && !url.startsWith('http://127.0.0.1:5173'))).toEqual([]);
});
