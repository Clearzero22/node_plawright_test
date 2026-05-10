/**
 * 爬虫服务层
 *
 * 统一入口，可以被：
 *   - CLI 脚本直接调用
 *   - API 服务器调用
 *   - 按钮/事件触发
 *
 * 与爬虫逻辑解耦：不关心具体爬虫实现，只负责编排和存储。
 */

import { DatabaseService } from '../core/database-service';
import { RunContext } from '../core/run-context';
import { GigaB2BCrawler } from '../crawlers/gigab2b/crawler';
import { ProductRecord, CrawlerRun } from '../core/types';
import * as os from 'os';
import * as path from 'path';

/** 爬虫运行选项 */
export interface RunOptions {
  /** 是否保存到本地文件（默认 true） */
  saveFiles?: boolean;
  /** 是否写入数据库 */
  db?: DatabaseService;
  /** 是否 headless 模式（默认 true） */
  headless?: boolean;
  /** Chrome 用户数据目录（默认系统 tmp） */
  userDataDir?: string;
}

/** 运行结果摘要 */
export interface RunSummary {
  runId: string;
  source: string;
  status: string;
  itemsScraped: number;
  clean?: ProductRecord;
  error?: string;
}

/**
 * 爬虫服务
 *
 * 每个爬虫对应一个 runXxx 方法：
 *   - 创建 RunContext（本地文件）
 *   - 可选写入 DB
 *   - 执行爬虫
 *   - 保存数据
 *
 * 使用方式（CLI）：
 *   const svc = new CrawlerService();
 *   const result = await svc.runGigaB2B({ productUrl: '...' });
 *
 * 使用方式（未来 API）：
 *   app.post('/api/crawl', async (req, res) => {
 *     const result = await svc.runGigaB2B(req.body);
 *     res.json(result);
 *   });
 */
export class CrawlerService {
  /**
   * 运行 GigaB2B 爬虫
   */
  async runGigaB2B(
    productUrl: string,
    options: RunOptions = {}
  ): Promise<RunSummary> {
    const { saveFiles = true, db, headless = true, userDataDir } = options;

    // 1. 创建运行上下文
    const run = await RunContext.create('gigab2b', { url: productUrl });
    if (db) {
      await db.insertRun(run.run);
    }

    try {
      // 2. 执行爬虫（使用统一的 Chrome profile，确保登录状态共享）
      const { chromium } = await import('playwright');
      // ⚠️ 重要：统一使用共享的浏览器数据目录
      const sharedProfileDir = path.join(os.homedir(), '.node-plawright-test', 'chrome-profile', 'file-upload');
      const context = await chromium.launchPersistentContext(
        sharedProfileDir,
        { headless, args: ['--no-sandbox'] }
      );
      const page = await context.newPage();

      const crawler = new GigaB2BCrawler({ productUrl });

      // 3. 导航
      const navigated = await crawler.navigate(page);
      if (!navigated) {
        throw new Error('导航失败');
      }

      // 4. 保存 Raw
      if (saveFiles) {
        const html = await page.content();
        await run.saveRaw('page.html', html);
      }
      if (db) {
        const html = await page.content();
        await db.insertRaw(run.run.runId, productUrl, html);
      }

      // 5. 提取 → staging
      const staging = await crawler.extract(page);

      if (saveFiles) {
        await run.saveStaging('data.json', staging);
      }
      if (db) {
        await db.insertStaging(run.run.runId, 'gigab2b', staging);
      }
      run.incrementItems();

      // 6. 清洗 → clean
      const clean = crawler.clean(staging);
      clean.runId = run.run.runId;

      if (saveFiles) {
        await run.saveClean('product-ready.json', clean);
      }
      if (db) {
        await db.upsertProduct(clean);
      }

      await page.close();
      await context.close();

      // 7. 完成
      await run.complete('completed');
      if (db) {
        await db.updateRun(run.run);
      }

      return {
        runId: run.run.runId,
        source: 'gigab2b',
        status: 'completed',
        itemsScraped: run.run.itemsScraped,
        clean,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await run.complete('failed', message);
      if (db) {
        await db.updateRun(run.run);
      }
      return {
        runId: run.run.runId,
        source: 'gigab2b',
        status: 'failed',
        itemsScraped: run.run.itemsScraped,
        error: message,
      };
    }
  }

  // ─── 查询 ─────────────────────────────────────────────────

  /** 列出运行历史 */
  async listRuns(db?: DatabaseService, limit = 20): Promise<CrawlerRun[]> {
    if (db) {
      return db.listRuns(limit);
    }
    return RunContext.listRuns().slice(0, limit);
  }

  /** 获取某个运行的数据 */
  async getRunData(runId: string, db?: DatabaseService) {
    if (db) {
      return {
        run: await db.getRun(runId),
        staging: await db.getStagingByRun(runId),
        clean: await db.getProducts(undefined, 1),
      };
    }
    return { run: await RunContext.getRun(runId) };
  }
}
