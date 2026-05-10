import { Page } from 'playwright';
import { BaseCrawler } from '../base-crawler';
import { GigaB2BConfig, GigaB2BStaging, GigaB2BClean } from './config';
import { GigaB2BExtractor } from './extractor';
import { GigaB2BCleaner } from './cleaner';

/**
 * GigaB2B 爬虫
 *
 * 只需继承 BaseCrawler，实现三个方法：
 *   navigate → 导航到产品页
 *   extract  → 提取数据
 *   clean    → 清洗数据
 */
export class GigaB2BCrawler extends BaseCrawler<GigaB2BStaging, GigaB2BClean> {
  readonly source = 'gigab2b';

  private config: GigaB2BConfig;
  private extractor: GigaB2BExtractor;

  constructor(config: GigaB2BConfig) {
    super();
    this.config = config;
    this.extractor = new GigaB2BExtractor();
  }

  async navigate(page: Page): Promise<boolean> {
    try {
      await page.goto(this.config.productUrl, {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });
      await page.waitForTimeout(2000);
      return true;
    } catch {
      return false;
    }
  }

  async extract(page: Page): Promise<GigaB2BStaging> {
    return this.extractor.extract(page);
  }

  clean(staging: GigaB2BStaging): GigaB2BClean {
    const cleaner = new GigaB2BCleaner(this.source, '');
    // runId 会在 BaseCrawler.run() 中由 RunContext 生成
    // 这里传空字符串，由 service 层在拿到 runId 后设置
    return cleaner.clean(staging);
  }
}
