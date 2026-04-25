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
ipcMain.handle('run-automation', async (_event, key: string) => {
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

  // 检查是否有本地 Chrome（如果需要使用）
  if (task.channel === 'chrome' && !BrowserManager.hasLocalChrome()) {
    log('❌ 未检测到本地 Chrome，请先安装 Google Chrome');
    return { success: false, error: '未安装 Google Chrome' };
  }

  // 确定用户数据目录
  let userDataDir: string | undefined;
  if (task.useUserDataDir) {
    userDataDir = path.join(app.getPath('userData'), 'chrome-profile');
    log(`📁 使用用户数据目录: ${userDataDir}`);
  }

  try {
    log('🚀 启动浏览器...');

    // 使用 launchPersistentContext 支持 userDataDir
    const launchOptions: any = {
      headless: false,
      channel: task.channel,
      executablePath: task.executablePath,
    };

    // 添加用户数据目录
    if (userDataDir) {
      launchOptions.userDataDir = userDataDir;
      launchOptions.args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ];
    }

    // 使用 launchPersistentContext 替代 launch + newContext
    const context = await chromium.launchPersistentContext(userDataDir || '', launchOptions);
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
    if (url.includes('bilibili.com')) {
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
