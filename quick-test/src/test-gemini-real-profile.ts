import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Gemini 测试：使用本地 Chrome profile，增强反检测
 *
 * ⚠️ 注意：这个脚本默认使用统一的automation目录与其他脚本共享登录状态
 * 如需使用真实Chrome配置，需要关闭现有的 Chrome 实例
 */
(async () => {
  console.log('启动本地 Chrome...');

  // 使用统一的automation目录与其他脚本共享登录状态
  const userDataDir = path.join(
    require('os').homedir(),
    '.node-plawright-test', 'chrome-profile', 'automation'
  );

  // 如果确实需要使用真实Chrome配置，取消下面这行的注释
  // const userDataDir = path.join(require('os').homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--start-maximized',
      '--disable-features=ChromeWhatsNewUI',
    ],
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // 注入反检测脚本
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    (window as any).chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5] as any,
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['zh-CN', 'zh', 'en'],
    });
  });

  const page = await context.newPage();

  await page.goto('https://gemini.google.com/app', { timeout: 30000 });
  console.log('页面标题:', await page.title());

  // 等 3 秒看是否跳转到登录页
  await page.waitForTimeout(3000);
  const currentUrl = page.url();
  console.log('当前 URL:', currentUrl);

  // 检查是否被拦截
  if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
    console.log('被 Google 拦截了，等待手动登录...');
    console.log('请在浏览器中手动登录 Gemini，登录后此脚本将继续...');
    await page.waitForURL('https://gemini.google.com/**', { timeout: 120000 });
    console.log('检测到已登录！');
  }

  const prompt = '带我飞飞飞';
  try {
    const textbox = page.getByRole('textbox', { name: /输入提示|prompt|chat/ });
    await textbox.click();
    await textbox.fill(prompt);
    console.log(`已输入: ${prompt}`);
    await textbox.press('Enter');
    console.log('消息已发送');
  } catch (e: any) {
    console.log('输入框操作失败:', e.message);
    // 尝试备选选择器
    try {
      const textbox = page.locator('div[contenteditable="true"]').first();
      await textbox.click();
      await textbox.fill(prompt);
      await textbox.press('Enter');
      console.log('消息已发送 (备用方式)');
    } catch (e2: any) {
      console.log('备用方式也失败:', e2.message);
    }
  }

  console.log('等待回复 15 秒...');
  await page.waitForTimeout(15000);

  if (!fs.existsSync('output')) fs.mkdirSync('output');
  await page.screenshot({ path: 'output/gemini-cdp-result.png', fullPage: false });
  console.log('截图已保存: output/gemini-cdp-result.png');

  console.log('测试完成，浏览器保持打开。按 Ctrl+C 退出。');
  await new Promise(() => {});
})();
