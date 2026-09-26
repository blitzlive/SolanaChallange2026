import { test, expect } from '@playwright/test';

test('desktop: QR, borrow, persist on refresh, cross-location return', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dein Kaffee geht.');
  await expect(page.getByRole('button', { name: 'Pfand hinterlegen · Demo starten' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/pfandloop-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Behälter-QR-Code anzeigen' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR-Code zum Öffnen von LOOP-001' })).toBeVisible();
  await page.getByRole('button', { name: 'Verstanden' }).click();
  await page.getByRole('button', { name: 'Pfand hinterlegen · Demo starten' }).click();
  await expect(page.getByRole('region', { name: 'Pfandbeleg' })).toContainText('Dein Becher. Dein Pfand.');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Pfandbeleg' })).toContainText('LOOP-001');
  await page.getByRole('button', { name: 'Zurückgeben', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rückgabe bestätigen', exact: true })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Rückgabe bestätigen', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pfandbeleg' })).toContainText('Der Kreis ist geschlossen.');
  await expect(page.getByRole('region', { name: 'Pfandbeleg' })).toContainText('Wiesenklang Festival');
  await page.screenshot({ path: 'test-results/pfandloop-return.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('phone: cup link, invalid ID, successful demo and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?cup=LOOP-002');
  await expect(page.getByLabel('Behälter-Nummer')).toHaveValue('LOOP-002');
  await expect(page.getByRole('button', { name: 'Pfand hinterlegen · Demo starten' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/pfandloop-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Behälter-Nummer').fill('INVALID');
  await expect(page.getByRole('button', { name: 'Gültige Behälter-Nummer eingeben' })).toBeDisabled();
  await page.getByLabel('Behälter-Nummer').fill('LOOP-002');
  await page.getByRole('button', { name: 'Pfand hinterlegen · Demo starten' }).click();
  await expect(page.getByRole('region', { name: 'Pfandbeleg' })).toContainText('LOOP-002');
  await page.getByRole('button', { name: 'Zurückgeben', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Rückgabe bestätigen', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pfandbeleg' })).toContainText('Der Kreis ist geschlossen.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [768, 1024]) {
  test(`responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?cup=LOOP-003');
    await expect(page.getByRole('button', { name: 'Pfand hinterlegen · Demo starten' })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Zurückgeben', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Schließen wir den Kreis.' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
