/**
 * ChatGPT File Upload Service — 上传文件到 ChatGPT 并获取回复
 *
 * 使用 CDP 连接本机真实 Chrome 浏览器，绕过 Cloudflare 反自动化检测。
 *
 * 使用方式：
 *   1. 先启动 Chrome 远程调试模式（仅需一次）：
 *      /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
 *   2. 手动在 Chrome 中打开 ChatGPT 并完成登录/验证
 *   3. 调用此服务即可复用真实浏览器
 */

import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import { spawn } from 'child_process';

// ─── Types ────────────────────────────────────────────────────

export interface ChatGPTFileOptions {
  filePath: string;
  prompt: string;
  headless?: boolean;       // 此服务下无效，始终使用真实 Chrome
  responseTimeout?: number;
}

export interface ChatGPTFileResult {
  success: boolean;
  prompt: string;
  response: string;
  fileUploaded: boolean;
  filePath: string | null;
  savedPath: string | null;
  timestamp: string;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────

const CDP_PORT = 9222;
const CDP_URL = `http://localhost:${CDP_PORT}`;

// 绕过系统代理，直接请求 localhost CDP 端口
function fetchCDP(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON from CDP')); }
      });
    }).on('error', reject);
  });
}

// ─── Service ──────────────────────────────────────────────────

export class ChatGPTFileService {
  private browser: Browser | null = null;
  private ownProcess: any = null;

  /**
   * 确保 Chrome 远程调试模式已启动
   * 如果未启动则自动启动
   */
  private async ensureChromeCDP(): Promise<Browser> {
    try {
      const data = await fetchCDP('/json/version');
      if (data.webSocketDebuggerUrl) {
        const browser = await chromium.connectOverCDP(data.webSocketDebuggerUrl, { timeout: 5000 });
        console.log('[ChatGPT] 已通过 WebSocket 连接到现有 Chrome 实例');
        return browser;
      }
      const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
      console.log('[ChatGPT] 已连接到现有 Chrome 实例');
      return browser;
    } catch {
      // 没有运行中的 Chrome 调试实例，自动启动
      console.log('[ChatGPT] 未检测到 Chrome 调试实例，正在启动...');
      const platform = os.platform();
      const sharedProfileDir = this.getProfileDir();
      const chromePath = this.getChromePath(platform);

      const args = [
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${sharedProfileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
      ];

      this.ownProcess = spawn(chromePath, args, {
        detached: true,
        stdio: 'ignore',
      });
      this.ownProcess.unref();

      // 等待 Chrome 启动
      for (let i = 0; i < 15; i++) {
        await this.sleep(1000);
        try {
          const d = await fetchCDP('/json/version');
          const wsUrl = d.webSocketDebuggerUrl || CDP_URL;
          const browser = await chromium.connectOverCDP(wsUrl, { timeout: 3000 });
          console.log('[ChatGPT] Chrome 已启动并连接');
          return browser;
        } catch {
          // 继续等待
        }
      }

      throw new Error('Chrome 启动超时，请手动启动: ' +
        chromePath + ' --remote-debugging-port=' + CDP_PORT);
    }
  }

  async upload(options: ChatGPTFileOptions): Promise<ChatGPTFileResult> {
    const { filePath, prompt, responseTimeout = 60000 } = options;

    if (!fs.existsSync(filePath)) {
      return {
        success: false, prompt, response: '', fileUploaded: false, filePath: null,
        timestamp: new Date().toISOString(), error: `文件不存在: ${filePath}`,
      };
    }

    this.browser = await this.ensureChromeCDP();

    try {
      // 复用第一个 context 或创建新的
      let context: BrowserContext;
      const contexts = this.browser.contexts();
      if (contexts.length > 0) {
        context = contexts[0];
      } else {
        context = await this.browser.newContext();
      }

      const page = context.pages()[0] || await context.newPage();

      // 导航到 ChatGPT
      const currentUrl = page.url();
      if (!currentUrl.includes('chatgpt.com')) {
        console.log('[ChatGPT] 导航到 chatgpt.com...');
        await page.goto('https://chatgpt.com/', { timeout: 30000, waitUntil: 'domcontentloaded' });
        await this.sleep(5000);

        // 如果需要登录/验证，等待用户手动完成
        const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
        if (pageText.includes('请验证你是真人') ||
            pageText.includes('Verify you are human') ||
            pageText.includes('Log in') || pageText.includes('登录')) {
          console.log('[ChatGPT] 需要登录或验证，请在 Chrome 窗口中手动完成...');
          await page.waitForURL('https://chatgpt.com/**', { timeout: 120000 });
          await this.sleep(3000);
        }
      }

      // 上传文件
      let fileUploaded = false;
      try {
        const fileInput = page.locator('input[type="file"]');
        const count = await fileInput.count();
        if (count > 0) {
          await fileInput.first().setInputFiles(filePath);
          fileUploaded = true;
          await this.sleep(2000);
        } else {
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 10000 }),
            page.getByTestId('composer-plus-btn').click(),
          ]);
          await fileChooser.setFiles(filePath);
          fileUploaded = true;
          await this.sleep(2000);
        }
      } catch (error) {
        console.error('[ChatGPT] 文件上传失败:', error);
      }

      // 等待文本框
      let textboxFound = false;
      for (let i = 0; i < 5; i++) {
        try {
          const textbox = page.getByRole('textbox', { name: 'Chat with ChatGPT' });
          await textbox.waitFor({ state: 'visible', timeout: 10000 });
          textboxFound = true;
          break;
        } catch {
          console.log(`[ChatGPT] 等待文本框 ${i + 1}/5...`);
          await this.sleep(3000);
        }
      }

      if (!textboxFound) {
        return {
          success: false, prompt, response: '', fileUploaded,
          filePath: fileUploaded ? filePath : null,
          timestamp: new Date().toISOString(), error: '文本框加载超时',
        };
      }

      const textbox = page.getByRole('textbox', { name: 'Chat with ChatGPT' });
      await textbox.click();
      await this.sleep(500);
      await textbox.fill(prompt);
      await this.sleep(1000);

      // 记录发送前的 assistant 消息数量
      const msgCountBefore = await page.evaluate(() =>
        document.querySelectorAll('[data-message-author-role="assistant"]').length
      );

      await textbox.press('Enter');
      console.log(`[ChatGPT] 消息已发送，当前 assistant 消息数: ${msgCountBefore}`);

      // 等待新的 assistant 消息出现
      try {
        await page.waitForFunction(
          (before) => document.querySelectorAll('[data-message-author-role="assistant"]').length > before,
          msgCountBefore,
          { timeout: responseTimeout },
        );
        console.log('[ChatGPT] 新的 assistant 消息已出现');

        // 等待回复完全生成：stop button 出现后消失
        try {
          await page.waitForSelector('[data-testid="stop-button"]', { timeout: 5000 });
          await page.waitForSelector('[data-testid="stop-button"]', { state: 'hidden', timeout: responseTimeout });
        } catch {
          // 没有停止按钮或已消失
        }

        await this.sleep(2000);
      } catch (error) {
        return {
          success: false, prompt, response: '', fileUploaded,
          filePath: fileUploaded ? filePath : null,
          timestamp: new Date().toISOString(),
          error: `等待回复超时: ${(error as Error).message}`,
        };
      }

      // 获取最新一条 assistant 回复
      let responseText = '';
      try {
        // 方法1：通过 page.evaluate 触发复制按钮，读取剪贴板获取完整 Markdown
        responseText = await page.evaluate(async () => {
          const copyBtns = document.querySelectorAll('[data-testid="copy-turn-action-button"]');
          if (copyBtns.length === 0) return '';
          const lastBtn = copyBtns[copyBtns.length - 1] as HTMLElement;
          lastBtn.click();
          await new Promise(r => setTimeout(r, 500));
          try {
            return await navigator.clipboard.readText();
          } catch {
            return '';
          }
        });

        if (responseText) {
          console.log(`[ChatGPT] 通过复制按钮获取 Markdown，长度: ${responseText.length}`);
        }

        // 方法2：fallback 用 textContent
        if (!responseText) {
          responseText = await page.evaluate(() => {
            const msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
            if (msgs.length === 0) return '';
            return msgs[msgs.length - 1].textContent?.trim() || '';
          });
          console.log(`[ChatGPT] 通过 textContent 获取回复，长度: ${responseText.length}`);
        }
      } catch (error) {
        console.error('[ChatGPT] 获取回复失败:', error);
      }

      // 保存回复到文件
      if (responseText) {
        const saveDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
        const savePath = path.join(saveDir, `chatgpt-response-${Date.now()}.md`);
        fs.writeFileSync(savePath, responseText, 'utf-8');
        console.log(`[ChatGPT] 回复已保存: ${savePath}`);
      }

      return {
        success: true, prompt, response: responseText, fileUploaded,
        filePath: fileUploaded ? filePath : null,
        savedPath: responseText ? `output/chatgpt-response-${Date.now()}.md` : null,
        timestamp: new Date().toISOString(),
      };
    } finally {
      // CDP 连接的是真实 Chrome，只断开连接，不关闭浏览器
      if (this.browser) {
        try { await (this.browser as any).disconnect?.(); } catch { /* ignore */ }
        this.browser = null;
      }
    }
  }

  async close(): Promise<void> {
    // CDP 模式下不关闭浏览器
  }

  private getChromePath(platform: string): string {
    if (platform === 'darwin') {
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else if (platform === 'win32') {
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    } else {
      return '/usr/bin/google-chrome';
    }
  }

  private getProfileDir(): string {
    return path.join(os.homedir(), '.node-plawright-test', 'chrome-profile', 'automation');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
