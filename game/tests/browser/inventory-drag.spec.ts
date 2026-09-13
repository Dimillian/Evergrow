import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Stage the existing save-free review with one bag item and an equipped staff.
  await page.route('**/src/character-review.ts*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      p.character.inventory.fill(null);
      p.character.inventory[0] = generateItem(601, 1, 'weapon', 'storm-staff', 'magic');
      p.character.inventoryLayout = {};
      inventory.refresh(p);
    ` });
  });
  await page.goto('/character.html?loadout=staff');
  await expect(page.locator('[data-equipment="weapon"]')).toHaveAttribute('data-filled', 'true');
});

async function moveToCell(page: Page, cell: number) {
  const bounds = await page.locator(`.character-grid-cell[data-cell="${cell}"]`).boundingBox();
  if (!bounds) throw new Error('Inventory cell is not visible');
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await page.mouse.move(point.x, point.y, { steps: 12 });
  return point;
}

async function startDrag(page: Page, cell: number) {
  const bounds = await page.locator('[data-equipment="weapon"]').boundingBox();
  if (!bounds) throw new Error('Equipped weapon is not visible');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 8, bounds.y + bounds.height / 2 + 4, { steps: 2 });
  return moveToCell(page, cell);
}

test('repeated dragover keeps the preview stable and still accepts the drop', async ({ page }) => {
  const point = await startDrag(page, 16);
  const preview = page.locator('.character-pack-placement');
  await expect(preview).toBeVisible();
  await expect(preview).not.toHaveClass(/is-invalid/);
  const observations = await page.evaluateHandle(() => {
    const preview = document.querySelector('.character-pack-placement')!;
    const mutations: MutationRecord[] = [], accepted: boolean[] = [];
    const observer = new MutationObserver(records => mutations.push(...records));
    observer.observe(preview, { attributes: true });
    observer.observe(preview.parentNode!, { childList: true });
    const onDragOver = (event: DragEvent) => accepted.push(event.defaultPrevented);
    document.addEventListener('dragover', onDragOver);
    return { mutations, accepted, stop: () => { observer.disconnect(); document.removeEventListener('dragover', onDragOver); } };
  });
  for (let i = 0; i < 8; i++) await page.mouse.move(point.x + i % 2, point.y + i % 2);
  const result = await observations.evaluate(state => {
    state.stop(); return { mutations: state.mutations.length, accepted: state.accepted };
  });
  await observations.dispose();
  expect(result.mutations).toBe(0);
  expect(result.accepted.length).toBeGreaterThan(0);
  expect(result.accepted.every(Boolean)).toBe(true);
  await page.mouse.up();
  await expect(page.locator('[data-equipment="weapon"]')).toHaveAttribute('data-filled', 'false');
  await expect(page.locator('.character-bag-slot[data-cell="16"]')).toBeVisible();
  await expect(preview).toBeHidden();
});

test('a rejected edge drop clears the preview and permits a subsequent valid drop', async ({ page }) => {
  await startDrag(page, 71);
  await expect(page.locator('.character-pack-placement')).toHaveClass(/is-invalid/);
  await page.mouse.up();
  await expect(page.locator('[data-equipment="weapon"]')).toHaveAttribute('data-filled', 'true');
  await expect(page.locator('.character-pack-placement')).toBeHidden();
  await startDrag(page, 16);
  await page.mouse.up();
  await expect(page.locator('[data-equipment="weapon"]')).toHaveAttribute('data-filled', 'false');
  await expect(page.locator('.character-bag-slot[data-cell="16"]')).toBeVisible();
});

test('crossing grids updates validity and leaving the pack clears its preview', async ({ page }) => {
  await startDrag(page, 16);
  await moveToCell(page, 72);
  await expect(page.locator('.character-charm-grid .character-pack-placement')).toHaveClass(/is-invalid/);
  await moveToCell(page, 16);
  await expect(page.locator('.character-bag .character-pack-placement')).not.toHaveClass(/is-invalid/);
  const heading = await page.locator('#inventory-title').boundingBox();
  if (!heading) throw new Error('Inventory heading is not visible');
  await page.mouse.move(heading.x + 2, heading.y + 2, { steps: 12 });
  await expect(page.locator('.character-pack-placement')).toBeHidden();
  await page.mouse.up();
  await expect(page.locator('[data-equipment="weapon"]')).toHaveAttribute('data-filled', 'true');
  await expect(page.locator('.character-bag-slot:visible')).toHaveCount(1);
});
