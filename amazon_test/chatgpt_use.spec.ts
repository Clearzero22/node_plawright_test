import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://chatgpt.com/');
  await page.getByTestId('composer-plus-btn').click();
  await page.getByText('Add photos').click();
  await page.getByRole('textbox', { name: 'Chat with ChatGPT' }).setInputFiles('logo.png');
  await page.getByTestId('composer-plus-btn').click();
  await page.getByRole('textbox', { name: 'Chat with ChatGPT' }).getByRole('paragraph').click();
  await page.getByRole('textbox', { name: 'Chat with ChatGPT' }).getByRole('paragraph').click();
  await page.getByRole('textbox', { name: 'Chat with ChatGPT' }).fill('这个是什么呢');
  await page.getByTestId('send-button').click();
});


