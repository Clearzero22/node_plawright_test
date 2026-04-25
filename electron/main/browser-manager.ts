import fs from 'fs';
import path from 'path';
import https from 'https';
import { app } from 'electron';
import extract from 'extract-zip';

// Playwright 浏览器版本信息
// 使用环境变量或默认值，便于在不同环境中配置
function getBrowserInfo() {
  const revision = process.env.PLAYWRIGHT_CHROMIUM_REVISION
    ? parseInt(process.env.PLAYWRIGHT_CHROMIUM_REVISION, 10)
    : 1217;

  const version = process.env.PLAYWRIGHT_CHROMIUM_VERSION || '147.0.7727.15';

  return {
    revision,
    version,
    getUrl: () => {
      // Detect platform
      if (process.platform === 'darwin') {
        const arch = process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
        return `https://cdn.playwright.dev/builds/cft/${version}/${arch}/chrome-${arch}.zip`;
      }
      if (process.platform === 'win32') {
        return `https://cdn.playwright.dev/builds/cft/${version}/win64/chrome-win64.zip`;
      }
      return `https://cdn.playwright.dev/builds/cft/${version}/linux64/chrome-linux64.zip`;
    },
  };
}

const BROWSER_INFO = getBrowserInfo();

// 本地 Playwright Chromium 路径
function getPlaywrightChromePath(): string | null {
  // macOS
  if (process.platform === 'darwin') {
    const basePath = path.join(
      app.getPath('home'),
      'Library', 'Caches', 'ms-playwright',
      `chromium-${BROWSER_INFO.revision}`,
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents', 'MacOS', 'Google Chrome for Testing'
    );
    if (fs.existsSync(basePath)) return basePath;
    // Try Intel version too
    const intelPath = basePath.replace('chrome-mac-arm64', 'chrome-mac-x64');
    if (fs.existsSync(intelPath)) return intelPath;
    return null;
  }

  // Windows
  if (process.env.LOCALAPPDATA) {
    const basePath = path.join(
      process.env.LOCALAPPDATA,
      'ms-playwright',
      `chromium-${BROWSER_INFO.revision}`,
      'chrome-win64',
      'chrome.exe'
    );
    if (fs.existsSync(basePath)) return basePath;
  }

  return null;
}

// 检查本地是否有 Google Chrome
function hasLocalChrome(): boolean {
  if (process.platform === 'darwin') {
    const paths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    ];
    return paths.some(p => fs.existsSync(p));
  }

  if (process.platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    return paths.some(p => fs.existsSync(p));
  }

  return false;
}

// 下载浏览器
function downloadBrowser(onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const browserDir = path.join(
      process.env.LOCALAPPDATA || app.getPath('userData'),
      'ms-playwright',
      `chromium-${BROWSER_INFO.revision}`
    );
    const zipPath = path.join(browserDir, 'chrome-win64.zip');

    if (!fs.existsSync(browserDir)) {
      fs.mkdirSync(browserDir, { recursive: true });
    }

    onProgress(0);

    const file = fs.createWriteStream(zipPath);
    const downloadUrl = BROWSER_INFO.getUrl();
    https.get(downloadUrl, (response) => {
      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalSize > 0) onProgress(Math.round((downloaded / totalSize) * 100));
      });

      response.pipe(file);
      file.on('finish', async () => {
        file.close();
        onProgress(90);

        try {
          await extract(zipPath, { dir: browserDir });
          fs.unlinkSync(zipPath);
          onProgress(100);
          resolve(browserDir);
        } catch (err: any) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

export const BrowserManager = {
  hasLocalChrome,
  getPlaywrightChromePath,
  downloadBrowser,
};
