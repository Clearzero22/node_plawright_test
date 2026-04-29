import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://gemini.google.com/app');
  await page.getByRole('button', { name: 'Open upload file menu' }).click();
  await page.getByRole('button', { name: 'Tools' }).click();
  await page.getByRole('textbox', { name: 'Enter a prompt for Gemini' }).getByRole('paragraph').click();
  await page.getByRole('textbox', { name: 'Enter a prompt for Gemini' }).getByRole('paragraph').click();
  await page.getByRole('textbox', { name: 'Enter a prompt for Gemini' }).getByRole('paragraph').click();
  await page.getByRole('textbox', { name: 'Enter a prompt for Gemini' }).fill('带我飞飞飞');
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.goto('https://gemini.google.com/app/c65fa2c0de46df88');
  await page.locator('[data-test-id="copy-button"]').click();
});