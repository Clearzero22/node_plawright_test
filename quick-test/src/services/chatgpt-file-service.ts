/**
 * ChatGPT File Upload Service — 上传文件到 ChatGPT 并获取回复
 *
 * 从 test-chatgpt-upload.ts 提取的 Service 类。
 * 自管理浏览器生命周期，支持文件上传和文本交互。
 */

import { chromium, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── Types ────────────────────────────────────────────────────

export interface ChatGPTFileOptions {
  /** 文件路径 */
  filePath: string;
  /** 提示词文本 */
  prompt: string;
  /** 是否 headless 模式（默认 true） */
  headless?: boolean;
  /** 等待回复超时时间（毫秒，默认 60000） */
  responseTimeout?: number;
}

export interface ChatGPTFileResult {
  success: boolean;
  prompt: string;
  response: string;
  fileUploaded: boolean;
  filePath: string | null;
  timestamp: string;
  error?: string;
}

// ─── Service ──────────────────────────────────────────────────

export class ChatGPTFileService {
  private context: BrowserContext | null = null;

  async upload(options: ChatGPTFileOptions): Promise<ChatGPTFileResult> {
    const { filePath, prompt, headless = true, responseTimeout = 60000 } = options;

    // 验证文件存在
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        prompt,
        response: '',
        fileUploaded: false,
        filePath: null,
        timestamp: new Date().toISOString(),
        error: `文件不存在: ${filePath}`,
      };
    }

    // 使用共享的浏览器数据目录
    const sharedProfileDir = path.join(os.homedir(), '.node-plawright-test', 'chrome-profile', 'file-upload');

    this.context = await chromium.launchPersistentContext(sharedProfileDir, {
      headless,
      viewport: { width: 1280, height: 900 },
      locale: 'zh-CN',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    try {
      const page = this.context.pages()[0] || await this.context.newPage();

      // 访问 ChatGPT
      await page.goto('https://chatgpt.com/', {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });

      // 等待页面稳定
      await this.sleep(3000);

      // 检查是否需要登录
      let checkCount = 0;
      while (checkCount < 3) {
        const currentUrl = page.url();

        if (currentUrl.includes('auth0') || currentUrl.includes('login')) {
          // 需要登录
          if (headless) {
            return {
              success: false,
              prompt,
              response: '',
              fileUploaded: false,
              filePath: null,
              timestamp: new Date().toISOString(),
              error: '需要登录 ChatGPT 账户，请在非 headless 模式下运行并完成登录',
            };
          }

          try {
            await page.waitForURL('https://chatgpt.com/**', { timeout: 120000 });
            await this.sleep(3000);
            break;
          } catch {
            return {
              success: false,
              prompt,
              response: '',
              fileUploaded: false,
              filePath: null,
              timestamp: new Date().toISOString(),
              error: '登录超时或失败',
            };
          }
        } else if (currentUrl.includes('chatgpt.com')) {
          break;
        }

        checkCount++;
        await this.sleep(2000);
      }

      await this.sleep(5000);

      // 上传文件
      let fileUploaded = false;

      try {
        // 方法1：找到隐藏的文件输入框并直接设置文件
        const fileInput = page.locator('input[type="file"]');
        const count = await fileInput.count();

        if (count > 0) {
          await fileInput.first().setInputFiles(filePath);
          fileUploaded = true;
          await this.sleep(2000);
        } else {
          // 方法2：使用FileChooser事件
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 10000 }),
            page.getByTestId('composer-plus-btn').click(),
          ]);

          await fileChooser.setFiles(filePath);
          fileUploaded = true;
          await this.sleep(2000);
        }
      } catch (error) {
        // 上传失败，继续执行
        console.error('文件上传失败:', error);
      }

      // 点击文本输入区域
      try {
        const textbox = page.getByRole('textbox', { name: 'Chat with ChatGPT' });
        await textbox.click();
        await this.sleep(500);
      } catch (error) {
        // 继续尝试输入
      }

      // 输入文本
      try {
        const textbox = page.getByRole('textbox', { name: 'Chat with ChatGPT' });
        await textbox.fill(prompt);
        await this.sleep(1000);

        // 按回车发送
        await textbox.press('Enter');
      } catch (error) {
        return {
          success: false,
          prompt,
          response: '',
          fileUploaded,
          filePath: fileUploaded ? filePath : null,
          timestamp: new Date().toISOString(),
          error: `输入文本失败: ${(error as Error).message}`,
        };
      }

      // 等待回复
      try {
        await page.waitForSelector('[data-message-author-role="assistant"]', {
          timeout: responseTimeout,
        });
        await this.sleep(3000);
      } catch (error) {
        return {
          success: false,
          prompt,
          response: '',
          fileUploaded,
          filePath: fileUploaded ? filePath : null,
          timestamp: new Date().toISOString(),
          error: `等待回复超时: ${(error as Error).message}`,
        };
      }

      // 获取回复内容
      let responseText = '';

      try {
        const lastResponse = page.locator('[data-message-author-role="assistant"]').last();
        if (await lastResponse.isVisible({ timeout: 5000 })) {
          responseText = await lastResponse.innerText();
        }
      } catch (error) {
        // 尝试备用选择器
        responseText = await page.evaluate(() => {
          const selectors = [
            '[data-message-author-role="assistant"]',
            '.agent-turn',
            '.markdown',
          ];

          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              const lastElement = elements[elements.length - 1];
              const text = lastElement.textContent?.trim();
              if (text && text.length > 10) {
                return text;
              }
            }
          }
          return '';
        });
      }

      return {
        success: true,
        prompt,
        response: responseText,
        fileUploaded,
        filePath: fileUploaded ? filePath : null,
        timestamp: new Date().toISOString(),
      };

    } finally {
      await this.close();
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
