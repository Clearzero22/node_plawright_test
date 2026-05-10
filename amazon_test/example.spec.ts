import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://www.bilibili.com/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await page.goto('https://www.bilibili.com/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});




test('test gigab2test', async ({ page }) => {
  await page.goto('https://www.gigab2b.com/index.php');
  await page.getByText('Search').click();
  await page.getByText('Couch').click();
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431' }).click();
  const page1 = await page1Promise;
  await page1.locator('.el-image.image-item > .el-image__inner').first().click();
  await page1.locator('.el-image-viewer__mask').click();
  await page1.locator('.el-image.image-item.is-active > .el-image__inner').click();
  await page1.locator('.el-image-viewer__mask').click();
  await page1.locator('body').press('ControlOrMeta+Insert');
  await page1.locator('body').press('ControlOrMeta+Insert');
  await page1.getByText('Specification').click();
  await page1.getByText('Product Dimensions').click();
  await page1.getByText('Package Size').click();
});