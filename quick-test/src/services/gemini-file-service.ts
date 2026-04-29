/**
 * Gemini File Upload Service — 上传文件到 Gemini 并获取回复
 *
 * 从 test-gemini-file-upload.ts 提取的 Service 类。
 * 自管理浏览器生命周期，支持文件上传和文本交互。
 */

import { chromium, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── Types ────────────────────────────────────────────────────

export interface GeminiFileOptions {
  /** 文件路径 */
  filePath: string;
  /** 提示词文本 */
  prompt: string;
  /** 是否 headless 模式（默认 true） */
  headless?: boolean;
  /** 等待回复超时时间（毫秒，默认 60000） */
  responseTimeout?: number;
}

export interface GeminiFileResult {
  success: boolean;
  prompt: string;
  response: string;
  fileUploaded: boolean;
  filePath: string | null;
  timestamp: string;
  error?: string;
}

// ─── Service ──────────────────────────────────────────────────

export class GeminiFileService {
  private context: BrowserContext | null = null;

  async upload(options: GeminiFileOptions): Promise<GeminiFileResult> {
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
    });

    try {
      const page = this.context.pages()[0] || await this.context.newPage();

      // 访问 Gemini
      await page.goto('https://gemini.google.com/app', {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });

      // 等待页面稳定
      await this.sleep(3000);

      // 检查是否需要登录
      let checkCount = 0;
      while (checkCount < 3) {
        const currentUrl = page.url();

        if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
          // 需要登录
          if (headless) {
            return {
              success: false,
              prompt,
              response: '',
              fileUploaded: false,
              filePath: null,
              timestamp: new Date().toISOString(),
              error: '需要登录 Google 账户，请在非 headless 模式下运行并完成登录',
            };
          }

          try {
            await page.waitForURL('https://gemini.google.com/**', { timeout: 120000 });
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
        } else if (currentUrl.includes('gemini.google.com')) {
          break;
        }

        checkCount++;
        await this.sleep(2000);
      }

      await this.sleep(5000);

      // 上传文件
      let fileUploaded = false;

      try {
        const uploadButton = page.locator('uploader >> button >> .mat-mdc-button-touch-target');
        await uploadButton.waitFor({ state: 'visible', timeout: 10000 });
        await uploadButton.click();
        await this.sleep(1000);

        const uploadMenuItem = page.locator('[data-test-id="local-images-files-uploader-button"]');
        await uploadMenuItem.waitFor({ state: 'visible', timeout: 5000 });

        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 10000 }),
          uploadMenuItem.click(),
        ]);

        await fileChooser.setFiles(filePath);
        fileUploaded = true;
        await this.sleep(2000);
      } catch (error) {
        // 尝试备用方法
        try {
          const uploadSelectors = [
            'button:has-text("Open upload file menu")',
            'button:has(svg):has-text("")',
            '.mat-mdc-button:has(.mat-mdc-button-touch-target)',
          ];

          for (const selector of uploadSelectors) {
            const count = await page.locator(selector).count();
            if (count > 0) {
              try {
                const [fileChooser] = await Promise.all([
                  page.waitForEvent('filechooser', { timeout: 5000 }),
                  page.locator(selector).first().click(),
                ]);

                await fileChooser.setFiles(filePath);
                fileUploaded = true;
                await this.sleep(2000);
                break;
              } catch {
                // 继续尝试下一个
              }
            }
          }
        } catch (fallbackError) {
          // 上传失败，继续执行
        }
      }

      // 输入文本
      try {
        const textbox = page.getByRole('textbox', { name: '为 Gemini 输入提示' });
        await textbox.click();
        await this.sleep(500);
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
        await page.waitForSelector('[data-test-id="copy-button"], .response-content', {
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
        const copyButton = page.locator('[data-test-id="copy-button"]').first();
        if (await copyButton.isVisible({ timeout: 5000 })) {
          await copyButton.click();
          await this.sleep(500);

          responseText = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
          });
        }
      } catch (error) {
        // 剪贴板读取失败，直接抓取内容
      }

      if (!responseText) {
        responseText = await page.evaluate(() => {
          const selectors = [
            '[data-test-id="model-verbose-text"]',
            '.response-content',
            '.model-response',
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
              const text = element.textContent.trim();
              if (text.length > 50) {
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
