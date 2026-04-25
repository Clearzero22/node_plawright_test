import { app, BrowserWindow, ipcMain } from 'electron';
import { chromium } from 'playwright';
import path from 'path';
import { BrowserManager } from './browser-manager';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 仅在开发环境打开 DevTools
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 自动化配置
const TASKS: Record<string, {
  channel?: string;
  executablePath?: string;
  url: string;
  useUserDataDir?: boolean;
}> = {
  'chatgpt': {
    url: 'https://chatgpt.com/',
    channel: 'chrome',
    useUserDataDir: true,
  },
  'seller-sprite-cn': {
    url: 'https://www.sellersprite.com/cn/',
    channel: 'chrome',
    useUserDataDir: true,
  },
  'seller-sprite': {
    url: 'https://www.sellersprite.com/',
    channel: 'chrome',
    useUserDataDir: true,
  },
  'xiyouzhaoci': {
    url: 'https://www.xiyouzhaoci.com/',
    channel: 'chrome',
    useUserDataDir: true,
  },
  'bilibili': {
    url: 'https://www.bilibili.com/',
    channel: 'chrome',
    useUserDataDir: true,
  },
  'taobao': {
    url: 'https://www.taobao.com/',
    channel: 'chrome',
    useUserDataDir: true,
  },
  'chromium': {
    url: 'https://www.bilibili.com/',
    useUserDataDir: true,
  },
  'chrome': {
    url: 'https://www.bilibili.com/',
    channel: 'chrome',
    useUserDataDir: true,
  },
};

// IPC: 检测浏览器可用性
ipcMain.handle('check-browser', async () => {
  return {
    hasLocalChrome: BrowserManager.hasLocalChrome(),
    hasPlaywrightChromium: !!BrowserManager.getPlaywrightChromePath(),
    hasUserDataDir: checkUserDataDir(),
  };
});

// 检查用户数据目录是否存在
function checkUserDataDir(): boolean {
  const userDataDir = path.join(app.getPath('userData'), 'chrome-profile');
  const fs = require('fs');
  return fs.existsSync(userDataDir);
}

// IPC: 清除用户数据（重新开始）
ipcMain.handle('clear-user-data', async () => {
  const fs = require('fs');
  const userDataDir = path.join(app.getPath('userData'), 'chrome-profile');

  try {
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
      return { success: true, message: '用户数据已清除' };
    }
    return { success: true, message: '没有用户数据需要清除' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// IPC: 获取用户数据目录信息
ipcMain.handle('get-user-data-info', async () => {
  const fs = require('fs');
  const userDataDir = path.join(app.getPath('userData'), 'chrome-profile');

  try {
    if (!fs.existsSync(userDataDir)) {
      return { success: true, exists: false, path: userDataDir };
    }

    const stats = fs.statSync(userDataDir);
    const cookiesPath = path.join(userDataDir, 'Default', 'Cookies');
    const hasCookies = fs.existsSync(cookiesPath);

    return {
      success: true,
      exists: true,
      path: userDataDir,
      size: stats.size,
      hasCookies,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// IPC: 运行自动化任务
ipcMain.handle('run-automation', async (_event, key: string, browserType: 'chrome' | 'chromium' | undefined = 'chrome') => {
  if (!mainWindow) return { success: false, error: 'No window' };

  const log = (msg: string) => {
    console.log(`[automation] ${msg}`);
    mainWindow?.webContents.send('automation-log', msg);
  };

  const task = TASKS[key];
  if (!task) {
    log(`未知任务: ${key}`);
    return { success: false, error: `Unknown task: ${key}` };
  }

  // 类型保护：确保 browserType 是有效值
  const validBrowserType: 'chrome' | 'chromium' = browserType || 'chromium';

  // 根据用户选择的浏览器类型覆盖配置
  const selectedChannel = validBrowserType === 'chrome' ? 'chrome' : undefined;
  const useLocalChrome = validBrowserType === 'chrome';

  // CDP 模式：连接到用户已启动的 Chrome
  const useCDP = validBrowserType === 'chrome'; // 默认 Chrome 使用 CDP

  if (useCDP) {
    log('🔍 尝试连接到 Chrome 调试端口...');
    try {
      // 尝试连接到已启动的 Chrome
      const browser = await chromium.connectOverCDP('http://localhost:9222');
      log('✅ 成功连接到 Chrome 调试模式');

      const context = browser.contexts()[0];
      const page = await context.newPage();

      log(`🌐 打开 ${task.url}...`);
      await page.goto(task.url, {
        timeout: 30000,
        waitUntil: 'domcontentloaded'
      });

      log(`📄 页面标题: ${await page.title()}`);

      // 检查登录状态
      const isLoggedIn = await checkLoginStatus(page, task.url);
      if (isLoggedIn) {
        log('✅ 已登录状态');
      } else {
        log('⚠️  未登录，请在已打开的浏览器中登录');
      }

      // 等待页面稳定
      await page.waitForTimeout(2000);

      // 截图
      const screenshotDir = app.getPath('desktop');
      const screenshot = path.join(screenshotDir, `screenshot-${key}-${Date.now()}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      log(`📸 截图已保存: ${screenshot}`);

      log('✅ 完成！（浏览器保持打开状态）');

      return {
        success: true,
        screenshot,
        isLoggedIn,
        browserKeptOpen: true,
        usedCDP: true,
      };
    } catch (error: any) {
      log('❌ 无法连接到 Chrome 调试模式');
      log('💡 请按以下步骤操作：');
      log('   1. 完全关闭所有 Chrome 窗口');
      log('   2. 打开命令提示符（CMD），运行：');
      log('      chrome.exe --remote-debugging-port=9222');
      log('   3. 或者使用完整路径：');
      log('      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222');
      log('   4. Chrome 会启动并显示"Chrome 正在被自动化测试软件控制"');
      log('   5. 重新点击按钮连接');

      return {
        success: false,
        error: 'CDP 连接失败，请先启动 Chrome 调试模式',
        requiresCDPSetup: true,
      };
    }
  }

  // 非 CDP 模式：使用 Playwright 启动浏览器
  if (useLocalChrome && !BrowserManager.hasLocalChrome()) {
    log('❌ 未检测到本地 Chrome，请先安装 Google Chrome');
    return { success: false, error: '未安装 Google Chrome' };
  }

  log(`🌐 使用浏览器: Playwright Chromium`);

  // 确定用户数据目录
  let userDataDir: string | undefined;
  if (task.useUserDataDir) {
    const profileName = "chromium-profile"; // 非 CDP 模式总是使用 chromium
    userDataDir = path.join(app.getPath('userData'), profileName);
    log(`📁 使用用户数据目录: ${userDataDir}`);
  }

  try {
    log('🚀 启动浏览器...');

    // 使用 launchPersistentContext 支持 userDataDir
    const launchOptions: any = {
      headless: false,
      channel: selectedChannel,  // 使用用户选择的浏览器类型
      executablePath: task.executablePath,
    };

    // 添加用户数据目录
    if (userDataDir) {
      launchOptions.userDataDir = userDataDir;
      launchOptions.args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',  // 隐藏自动化特征
        '--disable-infobars',
        '--window-size=1920,1080',
      ];
    }

    // 使用 launchPersistentContext 替代 launch + newContext
    const context = await chromium.launchPersistentContext(userDataDir || '', launchOptions);
    const page = await context.newPage();

    // 隐藏 webdriver 特征
    await page.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      window.chrome = {
        runtime: {},
      };
    `);

    log(`🌐 打开 ${task.url}...`);
    await page.goto(task.url, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    log(`📄 页面标题: ${await page.title()}`);

    // 检查登录状态
    const isLoggedIn = await checkLoginStatus(page, task.url);
    if (isLoggedIn) {
      log('✅ 已登录状态');
    } else {
      log('⚠️  未登录，如已登录请刷新页面');
    }

    // 等待页面稳定
    await page.waitForTimeout(2000);

    // 截图
    const screenshotDir = app.getPath('desktop');
    const screenshot = path.join(screenshotDir, `screenshot-${key}-${Date.now()}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    log(`📸 截图已保存: ${screenshot}`);

    log('✅ 完成！（浏览器保持打开状态，您可以继续操作）');

    return {
      success: true,
      screenshot,
      isLoggedIn,
      browserKeptOpen: true,
    };
  } catch (err: any) {
    log(`❌ 错误: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// 检查登录状态
async function checkLoginStatus(page: any, url: string): Promise<boolean> {
  try {
    if (url.includes('chatgpt.com')) {
      // ChatGPT 登录检测：检查是否存在用户头像或登录按钮消失
      const avatar = await page.$('[data-testid="profile-button"], .avatar');
      const loginButton = await page.$('[data-testid="login-button"], a[href*="/login"]');
      return !!avatar && !loginButton;
    } else if (url.includes('sellersprite.com')) {
      // Seller Sprite 登录检测：检查是否存在用户信息或登录按钮
      const userMenu = await page.$('.user-dropdown, .user-info, [class*="user"], [class*="account"]');
      const loginButton = await page.$('a[href*="login"], a[href*="signin"], .btn-login');
      return !!userMenu && !loginButton;
    } else if (url.includes('xiyouzhaoci.com')) {
      // xiyouzhaoci 登录检测：检查是否存在用户信息或登录按钮
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

// IPC: 关闭所有浏览器实例
ipcMain.handle('close-browsers', async () => {
  try {
    // 这里可以添加逻辑来跟踪和关闭所有启动的浏览器
    return { success: true, message: '浏览器已关闭' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
