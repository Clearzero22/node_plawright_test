import { Page } from 'playwright';
import { GigaB2BStaging } from './config';

/**
 * GigaB2B 数据提取器
 *
 * 职责仅限于：接收 Page → 返回结构化数据
 * 不涉及文件 I/O、数据库、清洗逻辑
 */
export class GigaB2BExtractor {
  /**
   * 先点击 Product Info 标签（如果存在），再提取数据
   */
  async extract(page: Page): Promise<GigaB2BStaging> {
    // 尝试点击 Product Info 标签
    await this._clickProductInfoTab(page);

    // 用 Playwright 方式提取规格
    const specifications = await this._extractSpecifications(page);

    // 用 page.evaluate 提取其他数据
    const basicData = await this._extractBasicData(page);

    return {
      ...basicData,
      specifications,
    };
  }

  private async _clickProductInfoTab(page: Page): Promise<void> {
    try {
      await page.waitForSelector('#tab-description', { timeout: 5000 });
      await page.locator('#tab-description').click();
      await page.waitForTimeout(2000);
    } catch {
      // 标签不存在则跳过
    }
  }

  private async _extractSpecifications(page: Page): Promise<Record<string, string>> {
    const pane = page.locator('#pane-description');
    const count = await pane.locator('.items').count();
    const specs: Record<string, string> = {};

    for (let i = 0; i < count; i++) {
      const spans = pane.locator('.items').nth(i).locator('span');
      if (await spans.count() >= 2) {
        const key = (await spans.nth(0).textContent())?.replace(/:$/, '').trim();
        const val = (await spans.nth(1).textContent())?.trim();
        if (key && val && key.length > 2) {
          specs[key] = val;
        }
      }
    }
    return specs;
  }

  private async _extractBasicData(page: Page) {
    return page.evaluate(function() {
      const selectors = ['h1', '.product-title', '[class*="title"]'];
      let title = '';
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el && el.textContent) { title = el.textContent.trim(); break; }
      }

      const priceSelectors = ['.price', '[class*="price"]', '.product-price'];
      let price = '';
      for (const s of priceSelectors) {
        const el = document.querySelector(s);
        if (el && el.textContent) { price = el.textContent.trim(); break; }
      }

      const descSelectors = ['.product-description', '.short-description'];
      let desc = '';
      for (const s of descSelectors) {
        const el = document.querySelector(s);
        if (el && el.textContent) { desc = el.textContent.trim(); break; }
      }

      const images: string[] = [];
      document.querySelectorAll('img').forEach(function(img: HTMLImageElement) {
        const src = (img as any).src || (img as any).dataset?.src || (img as any).dataset?.original;
        if (src && src.indexOf('b2bfiles') >= 0 && src.indexOf('HDFlags') < 0 && src.indexOf('icon') < 0) {
          const cleanSrc = src.split('?')[0];
          if (images.indexOf(cleanSrc) < 0) images.push(cleanSrc);
        }
      });

      return {
        url: window.location.href,
        title,
        price,
        description: desc,
        images,
        scrapedAt: new Date().toISOString(),
      };
    });
  }
}

/** 导出单例工厂 */
export const createExtractor = () => new GigaB2BExtractor();
