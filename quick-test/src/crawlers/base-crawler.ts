import { Page } from 'playwright';
import { RunContext } from '../core/run-context';
import { DatabaseService } from '../core/database-service';

/** 爬虫运行时的选项 */
export interface CrawlerOptions {
  source: string;
  params: Record<string, string>;
  storage: {
    /** 是否保存到本地文件 */
    files?: boolean;
    /** 是否写入 PostgreSQL */
    database?: DatabaseService;
  };
}

/** 爬虫执行结果 */
export interface CrawlerResult<TClean = unknown> {
  runId: string;
  source: string;
  status: 'completed' | 'failed' | 'partial';
  itemsScraped: number;
  stagingData: unknown;
  cleanData: TClean;
  error?: string;
}

/**
 * 爬虫抽象基类
 *
 * 子类只需实现：
 *   - source        — 数据来源标识
 *   - navigate()   — 页面导航
 *   - extract()    — 从页面提取数据
 *   - clean()      — 清洗数据
 */
export abstract class BaseCrawler<TStaging, TClean> {
  abstract readonly source: string;

  /**
   * 导航到目标页面
   * @returns 返回 false 表示导航失败
   */
  abstract navigate(page: Page): Promise<boolean>;

  /**
   * 从页面提取数据（staging 层）
   */
  abstract extract(page: Page): Promise<TStaging>;

  /**
   * 清洗 staging 数据为 clean 格式
   */
  abstract clean(staging: TStaging): TClean;

  /**
   * 执行一次完整的爬取流程
   */
  async run(options: CrawlerOptions): Promise<CrawlerResult<TClean>> {
    const run = await RunContext.create(options.source, options.params);

    try {
      const { chromium } = await import('playwright');
      const context = await chromium.launchPersistentContext(
        run.dirs.root + '/chrome-profile',
        {
          headless: true,
          args: ['--no-sandbox'],
        }
      );

      const page = await context.newPage();

      // 1. 导航
      const navigated = await this.navigate(page);
      if (!navigated) {
        await run.complete('failed', '导航失败');
        throw new Error('导航失败');
      }

      // 2. 保存 Raw 层
      if (options.storage.files !== false) {
        const html = await page.content();
        await run.saveRaw('page.html', html);
      }
      if (options.storage.database) {
        const html = await page.content();
        await options.storage.database.insertRaw(run.run.runId, run.run.params.url || '', html);
      }

      // 3. 提取数据（staging）
      const staging = await this.extract(page);
      if (options.storage.files !== false) {
        await run.saveStaging('data.json', staging);
      }
      if (options.storage.database) {
        await options.storage.database.insertStaging(run.run.runId, this.source, staging);
      }
      run.incrementItems();

      // 4. 清洗数据（clean）
      const clean = this.clean(staging);
      if (options.storage.files !== false) {
        await run.saveClean('product-ready.json', clean);
      }

      await page.close();
      await context.close();

      // 5. 完成
      await run.complete('completed');

      return {
        runId: run.run.runId,
        source: this.source,
        status: 'completed',
        itemsScraped: run.run.itemsScraped,
        stagingData: staging,
        cleanData: clean,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await run.complete('failed', message);
      throw error;
    }
  }
}
