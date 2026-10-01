import { test, expect } from '@playwright/test';

// The real panel, backed by the save-free study executor. These tests do not
// exercise Game's persistence-status integration or real operating-system IMEs.
test.beforeEach(async ({ page }) => {
  await page.goto('/tools/console.html');
  await expect(page.locator('#console-study')).toHaveAttribute('data-ready', 'true');
});

test('history traversal remains active when a recalled command has suggestions', async ({ page }) => {
  const input = page.getByRole('combobox', { name: 'Command', exact: true });
  for (const raw of ['refill hp', 'drop helmet']) {
    await input.fill(raw);
    await input.press('Enter');
    await expect(page.getByRole('status')).toContainText(`Preview received: ${raw}`);
  }
  await page.getByRole('button', { name: 'Clear command', exact: true }).click();
  for (const [key, value] of [
    ['ArrowUp', 'drop helmet'], ['ArrowUp', 'refill hp'],
    ['ArrowDown', 'drop helmet'], ['ArrowDown', ''],
  ]) {
    await input.press(key);
    await expect(input).toHaveValue(value);
  }
});

test('accepting a completion leaves history mode and lets arrows select flags', async ({ page }) => {
  const input = page.getByRole('combobox', { name: 'Command', exact: true });
  for (const raw of ['refill hp', 'drop helmet']) {
    await input.fill(raw);
    await input.press('Enter');
    await expect(page.getByRole('status')).toContainText(`Preview received: ${raw}`);
  }
  await page.getByRole('button', { name: 'Clear command', exact: true }).click();
  await input.press('ArrowUp');
  await expect(input).toHaveValue('drop helmet');
  await input.press('Tab');
  await expect(input).toHaveValue('drop helmet ');
  const selected = await input.getAttribute('aria-activedescendant');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('drop helmet ');
  await expect(input).not.toHaveAttribute('aria-activedescendant', selected!);
});

test('a composing Escape does not dismiss the console; ordinary Escape does', async ({ page }) => {
  const input = page.getByRole('combobox', { name: 'Command', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Local command console', exact: true });
  await input.dispatchEvent('keydown', {
    key: 'Escape', code: 'Escape', isComposing: true,
    bubbles: true, cancelable: true,
  });
  await expect(dialog).toBeVisible();
  await input.press('Escape');
  await expect(dialog).toBeHidden();
});
