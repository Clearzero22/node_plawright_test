import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import os from 'os';

// 获取用户数据目录（与Electron应用保持一致）
export function getUserDataDir(profileName: string = 'chromium-profile'): string {
  const userDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'node_plawright_test', profileName);
  return userDataDir;
}

// 使用Playwright持久化模式启动（参考main/index.ts实现）
export async function launchPersistent(userDataDir?: string): Promise<BrowserContext> {
  const dataDir = userDataDir || getUserDataDir();

  console.log(`📁 使用用户数据目录: ${dataDir}`);

  const launchOptions: any = {
    headless: false,
    channel: 'chrome', // 使用本地Chrome
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',  // 隐藏自动化特征
      '--disable-infobars',
      '--start-maximized',  // 启动时最大化窗口，跟随屏幕大小
    ],
    viewport: null,  // 禁用固定viewport，让浏览器跟随窗口大小
  };

  const context = await chromium.launchPersistentContext(dataDir, launchOptions);

  // 隐藏 webdriver 特征
  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
    window.chrome = {
      runtime: {},
    };
  `);

  return context;
}

// CDP模式连接（可选）
export async function connectCDP(): Promise<Browser> {
  return await chromium.connectOverCDP('http://localhost:9222');
}

// 获取页面（从context）
export async function getPageFromContext(context: BrowserContext): Promise<Page> {
  return await context.newPage();
}

// 获取页面（从CDP browser）
export async function getPage(browser: Browser): Promise<Page> {
  const context = browser.contexts()[0];
  return await context.newPage();
}

// 快速截图
export async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `output/${name}.png` });
}

// 等待
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 日志
export function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
  };

  const colorMap = {
    info: colors.cyan,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
  };

  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colorMap[type]}[${timestamp}] ${message}${colors.reset}`);
}

// 检查登录状态
export async function checkLoginStatus(page: Page, url: string): Promise<boolean> {
  try {
    if (url.includes('chatgpt.com')) {
      const avatar = await page.$('[data-testid="profile-button"], .avatar');
      const loginButton = await page.$('[data-testid="login-button"], a[href*="/login"]');
      return !!avatar && !loginButton;
    } else if (url.includes('sellersprite.com')) {
      const userMenu = await page.$('.user-dropdown, .user-info, [class*="user"], [class*="account"]');
      const loginButton = await page.$('a[href*="login"], a[href*="signin"], .btn-login');
      return !!userMenu && !loginButton;
    } else if (url.includes('xiyouzhaoci.com')) {
      const userInfo = await page.$('.user-info, .member-info, [class*="user"], [class*="member"]');
      const loginButton = await page.$('a[href*="login"], a[href*="signin"], .btn-login');
      return !!userInfo && !loginButton;
    } else if (url.includes('bilibili.com')) {
      const avatar = await page.$('.nav-user-info, .header-avatar-wrap');
      return !!avatar;
    } else if (url.includes('taobao.com')) {
      const userLink = await page.$('.site-nav-bd a[href*="member"]');
      return !!userLink;
    }
    return false;
  } catch {
    return false;
  }
}
