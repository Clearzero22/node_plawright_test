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

  mainWindow.webContents.openDevTools();
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 自动化配置
const TASKS: Record<string, { channel?: string, executablePath?: string, url: string }> = {
  'chromium': { url: 'https://www.bilibili.com/' },
  'chrome':   { channel: 'chrome', url: 'https://www.bilibili.com/' },
};

// IPC: 检测浏览器可用性
ipcMain.handle('check-browser', async () => {
  return {
    hasLocalChrome: BrowserManager.hasLocalChrome(),
    hasPlaywrightChromium: !!BrowserManager.getPlaywrightChromePath(),
  };
});

// IPC: 下载 Chromium
ipcMain.handle('download-chromium', async () => {
  if (!mainWindow) return { success: false, error: 'No window' };

  return new Promise((resolve) => {
    BrowserManager.downloadBrowser((pct) => {
      mainWindow?.webContents.send('automation-log', `下载进度: ${pct}%`);
    })
      .then((dir) => resolve({ success: true, dir }))
      .catch((err) => resolve({ success: false, error: err.message }));
  });
});

// IPC: 渲染进程点击按钮 → 主进程直接执行 Playwright
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

  // 如果是 chromium 模式且没有本地 Playwright Chromium，自动下载
  if (key === 'chromium') {
    const pwPath = BrowserManager.getPlaywrightChromePath();
    if (pwPath) {
      task.executablePath = pwPath;
    } else {
      log('未检测到 Playwright Chromium，正在下载...');
      const dl = await BrowserManager.downloadBrowser((pct) => {
        mainWindow?.webContents.send('automation-log', `下载进度: ${pct}%`);
      });
      log('下载完成');
      // Set executable path based on platform
      if (process.platform === 'darwin') {
        const arch = process.arch === 'arm64' ? 'chrome-mac-arm64' : 'chrome-mac-x64';
        task.executablePath = path.join(dl, arch, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
      } else if (process.platform === 'win32') {
        task.executablePath = path.join(dl, 'chrome-win64', 'chrome.exe');
      } else {
        task.executablePath = path.join(dl, 'chrome-linux64', 'chrome');
      }
    }
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    log('启动浏览器...');
    browser = await chromium.launch({
      headless: false,
      channel: task.channel,
      executablePath: task.executablePath,
    });
    const page = await browser.newPage();

    log(`打开 ${task.url}...`);
    await page.goto(task.url, { timeout: 30000 });
    log(`页面标题: ${await page.title()}`);

    await page.waitForTimeout(2000);

    const screenshot = path.join(app.getPath('desktop'), `screenshot-${key}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    log(`截图已保存: ${screenshot}`);

    log('完成！');
    return { success: true, screenshot };
  } catch (err: any) {
    log(`错误: ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    if (browser) {
      try {
        await browser.close();
        log('浏览器已关闭');
      } catch {}
    }
  }
});
