import { app, BrowserWindow, ipcMain } from 'electron';
import { chromium } from 'playwright';
import path from 'path';

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
const TASKS: Record<string, { channel?: string, url: string }> = {
  'chromium': { url: 'https://www.bilibili.com/' },
  'chrome':   { channel: 'chrome', url: 'https://www.bilibili.com/' },
};

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

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    log('启动浏览器...');
    browser = await chromium.launch({
      headless: false,
      channel: task.channel,
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
