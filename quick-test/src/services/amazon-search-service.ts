/**
 * Amazon Search Service — 通过 Playwright 在 Amazon 搜索竞品
 *
 * 输入关键词，返回竞品 ASIN 列表。
 */

import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as os from 'os';
import * as path from 'path';

interface SearchResult {
  keyword: string;
  asins: string[];
  links: string[];
  total: number;
}

export class AmazonSearchService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async search(keyword: string, maxResults = 20): Promise<SearchResult> {
    const userDataDir = path.join(os.tmpdir(), 'amazon-search-profile');

    this.browser = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
    });
    this.context = this.browser;

    const page = this.context.pages()[0] || await this.context.newPage();

    // 搜索
    await page.goto('https://www.amazon.com/', {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2000);

    const searchBox = page.locator('#twotabsearchtextbox, #nav-bb-search, input[type="text"][placeholder*="Search"]').first();
    await searchBox.waitFor({ state: 'visible', timeout: 10000 });
    await searchBox.fill(keyword);
    await page.waitForTimeout(500);
    await searchBox.press('Enter');
    await page.waitForTimeout(5000);

    // 提取 ASIN
    const results = await page.evaluate((max) => {
      const asins: string[] = [];
      const links: string[] = [];
      const seen = new Set<string>();

      const elements = document.querySelectorAll('[data-component-type="s-search-result"]');
      for (const el of elements) {
        if (asins.length >= max) break;

        const asin = el.getAttribute('data-asin');
        if (!asin || asin.length !== 10 || seen.has(asin)) continue;
        seen.add(asin);
        asins.push(asin);
        links.push(`https://www.amazon.com/dp/${asin}`);
      }

      // fallback: 从链接中提取 ASIN
      if (asins.length === 0) {
        const anchors = document.querySelectorAll('a[href*="/dp/"]');
        for (const a of anchors) {
          if (asins.length >= max) break;
          const href = (a as HTMLAnchorElement).href;
          const match = href.match(/\/dp\/([A-Z0-9]{10})/);
          if (match && !seen.has(match[1])) {
            seen.add(match[1]);
            asins.push(match[1]);
            links.push(`https://www.amazon.com/dp/${match[1]}`);
          }
        }
      }

      return { asins, links };
    }, maxResults);

    return {
      keyword,
      asins: results.asins,
      links: results.links,
      total: results.asins.length,
    };
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    this.browser = null;
    this.context = null;
  }
}
