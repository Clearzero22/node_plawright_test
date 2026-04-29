import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import os from 'os';

// 获取用户数据目录
export function getUserDataDir(profileName?: string): string {
  if (process.platform === 'darwin') {
    // macOS: 使用项目本地持久化目录，避免与正在使用的Chrome冲突
    const projectDataDir = path.join(os.homedir(), '.node-plawright-test', 'chrome-profile', profileName || 'automation');
    return projectDataDir;
  }
  // Windows: 使用项目本地持久化目录
  const userDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'node_plawright_test', profileName || 'chromium-profile');
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

/**
 * 启动隐身模式浏览器（完整反检测配置）
 * 用于绕过 Google 等网站的自动化检测
 */
export async function launchStealth(userDataDir?: string): Promise<BrowserContext> {
  const dataDir = userDataDir || path.join(os.homedir(), '.node-plawright-test', 'chrome-profile', 'stealth');

  log('🚀 启动隐身模式浏览器', 'info');

  const launchOptions: any = {
    headless: false,
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--start-maximized',
      '--disable-save-password-bubble',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-translate',
    ],
    viewport: null,
    ignoreDefaultArgs: [
      '--enable-automation',
      '--enable-blink-features=IdleDetection',
    ],
    actionTimeout: 0,
  };

  const context = await chromium.launchPersistentContext(dataDir, launchOptions);

  // 注入完整的反检测脚本
  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {},
    };
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format" },
          description: "Portable Document Format",
          filename: "internal-pdf-viewer",
          length: 1,
          name: "Chrome PDF Plugin"
        },
        {
          0: { type: "application/pdf", suffixes: "pdf", description: "" },
          description: "",
          filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
          length: 1,
          name: "Chrome PDF Viewer"
        },
        {
          0: { type: "application/x-nacl", suffixes: "", description: "Native Client Executable" },
          1: { type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable" },
          description: "",
          filename: "internal-nacl-plugin",
          length: 2,
          name: "Native Client"
        }
      ],
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en', 'zh-CN', 'zh'],
    });
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
    );
    delete window.__playwright;
    delete window.__pw_manual;
    delete window.__pw_inspect;
    Object.defineProperty(screen, 'availHeight', { get: () => screen.height - 40 });
    Object.defineProperty(screen, 'availWidth', { get: () => screen.width });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
  `);

  log(`📁 使用数据目录: ${dataDir}`, 'info');

  return context;
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
