import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 1. 打开 bilibili
  console.log('Navigating to bilibili...');
  await page.goto('https://www.bilibili.com/');
  console.log('Page title:', await page.title());

  // 2. 等待页面加载
  await page.waitForTimeout(3000);

  // 3. 搜索框输入并搜索
  const searchInput = page.locator('input.search-input');
  if (await searchInput.count() > 0) {
    console.log('Found search input, typing...');
    await searchInput.fill('Playwright 自动化教程');
    await searchInput.press('Enter');
    await page.waitForTimeout(3000);
    console.log('Search page title:', await page.title());
  } else {
    console.log('Search input not found, skipping search step.');
  }

  // 4. 截图保存
  await page.screenshot({ path: 'demo-screenshot.png', fullPage: true });
  console.log('Screenshot saved to demo-screenshot.png');

  await browser.close();
  console.log('Done!');
})();
