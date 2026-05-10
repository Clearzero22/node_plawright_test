/**
 * API 服务器 — 为工作流编辑器提供爬虫服务
 *
 * 启动:
 *   npx tsx src/api-server.ts
 *   npx tsx src/api-server.ts --port 3456
 *
 * 路由:
 *   GET  /api/health          — 健康检查
 *   POST /api/crawl/gigab2b   — 执行 GigaB2B 爬虫
 *   GET  /api/runs            — 运行记录列表
 *   GET  /api/runs/:id        — 单次运行详情
 *   POST /api/ai/recognize    — AI 图片识别（支持 templateId / 自定义 prompt，可选存库）
 *   POST /api/ai/compare      — AI 多图对比
 *   GET  /api/ai/templates    — 获取预设提示词模板列表
 *   GET  /api/ai/results      — 查询 AI 识别结果（?runId=xxx）
 *   POST /api/search/amazon   — Amazon 竞品搜索
 *
 * 工作流编辑器通过 Vite proxy 调用:
 *   vite.config.ts → server.proxy: { '/api': 'http://localhost:3456' }
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { CrawlerService } from './services/crawler-service';
import { AiVisionService, PROMPT_TEMPLATES } from './services/ai-vision-service';
import { AmazonSearchService } from './services/amazon-search-service';
import { AmazonProductService } from './services/amazon-product-service';
import { DatabaseService } from './core/database-service';
import * as xiyouzhaociService from './services/xiyouzhaociService';
import { GeminiFileService } from './services/gemini-file-service';
import { ChatGPTFileService } from './services/chatgpt-file-service';

// ─── 配置 ────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3456;

// ─── 依赖 ────────────────────────────────────────────────────

const crawlerService = new CrawlerService();

function createVisionService(): AiVisionService | null {
  try {
    return new AiVisionService();
  } catch {
    return null;
  }
}

function createDb(): DatabaseService | null {
  try {
    return new DatabaseService();
  } catch {
    return null;
  }
}

// ─── 应用 ────────────────────────────────────────────────────

const app = new Hono();

// CORS（开发环境需要）
app.use('/api/*', cors());

// ─── GET /api/health ─────────────────────────────────────────

app.get('/api/health', async (c) => {
  const db = createDb();
  let dbConnected = false;
  if (db) {
    try {
      await db.connect();
      dbConnected = true;
      await db.disconnect();
    } catch {
      // DB not available
    }
  }
  const vision = createVisionService();
  return c.json({
    status: 'ok',
    db: dbConnected,
    ai: !!vision,
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /api/crawl/gigab2b ─────────────────────────────────

app.post('/api/crawl/gigab2b', async (c) => {
  let body: { url?: string; headless?: boolean; saveToDb?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: '请求体必须是 JSON' }, 400);
  }

  if (!body.url || typeof body.url !== 'string') {
    return c.json({ success: false, error: '缺少必填字段: url' }, 400);
  }

  const headless = body.headless !== false;
  const saveToDb = body.saveToDb !== false;

  // 可选连接 DB
  let db: DatabaseService | null = null;
  if (saveToDb) {
    db = createDb();
    try {
      await db!.connect();
    } catch {
      db = null;
      // 降级到仅存文件
    }
  }

  const startTime = Date.now();

  try {
    const result = await crawlerService.runGigaB2B(body.url, {
      saveFiles: true,
      headless,
      db: db || undefined,
    });

    const duration = Date.now() - startTime;

    return c.json({
      success: result.status === 'completed',
      runId: result.runId,
      status: result.status,
      duration,
      error: result.error,
      product: result.clean ? {
        externalId: result.clean.externalId,
        title: result.clean.title,
        price: result.clean.price ? Number(result.clean.price) : null,
        currency: result.clean.currency,
        description: result.clean.description,
        images: result.clean.images,
        specifications: result.clean.specifications,
      } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  } finally {
    if (db) {
      await db.disconnect();
    }
  }
});

// ─── GET /api/runs ───────────────────────────────────────────

app.get('/api/runs', async (c) => {
  const limit = Number(c.req.query('limit')) || 20;
  const db = createDb();

  if (!db) {
    // 无 DB，从本地文件读取
    const runs = await crawlerService.listRuns();
    return c.json({ runs, total: runs.length });
  }

  try {
    await db.connect();
    const runs = await db.listRuns(limit);
    return c.json({ runs, total: runs.length });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败',
    }, 500);
  } finally {
    await db.disconnect();
  }
});

// ─── GET /api/runs/:id ───────────────────────────────────────

app.get('/api/runs/:id', async (c) => {
  const runId = c.req.param('id');
  const db = createDb();

  if (!db) {
    // 无 DB，从本地文件读取
    const run = await crawlerService.getRunData(runId);
    if (!run.run) {
      return c.json({ success: false, error: '运行记录不存在' }, 404);
    }
    return c.json(run);
  }

  try {
    await db.connect();
    const run = await db.getRun(runId);
    if (!run) {
      return c.json({ success: false, error: '运行记录不存在' }, 404);
    }

    const staging = await db.getStagingByRun(runId);
    const clean = await db.getProducts(undefined, 1);

    return c.json({
      run,
      staging: staging.map(r => ({ id: r.id, data: r.data, parsedAt: r.parsed_at })),
      clean: clean.filter(p => p.runId === runId),
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败',
    }, 500);
  } finally {
    await db.disconnect();
  }
});

// ─── GET /api/ai/templates ───────────────────────────────────

app.get('/api/ai/templates', async (c) => {
  return c.json({
    templates: PROMPT_TEMPLATES.map(t => ({
      id: t.id,
      label: t.label,
      description: t.description,
    })),
  });
});

// ─── POST /api/ai/recognize ──────────────────────────────────

app.post('/api/ai/recognize', async (c) => {
  const vision = createVisionService();
  if (!vision) {
    return c.json({ success: false, error: 'DASHSCOPE_API_KEY 未配置' }, 503);
  }

  let body: {
    image?: string; prompt?: string; templateId?: string; model?: string;
    runId?: string; nodeId?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: '请求体必须是 JSON' }, 400);
  }

  if (!body.image || typeof body.image !== 'string') {
    return c.json({ success: false, error: '缺少必填字段: image（URL 或 Base64）' }, 400);
  }

  const promptOrTemplate = body.templateId || body.prompt || 'general';

  // 可选连接 DB 持久化
  let db: DatabaseService | null = null;
  if (body.runId) {
    db = createDb();
    try { await db!.connect(); } catch { db = null; }
  }

  try {
    const result = await vision.recognize(body.image, promptOrTemplate, body.model);

    // 存库
    if (db && body.nodeId) {
      await db.insertAiResult({
        runId: body.runId,
        nodeId: body.nodeId,
        imageUrl: body.image,
        templateId: body.templateId || undefined,
        prompt: body.prompt || undefined,
        result,
        model: body.model || 'qwen3.6-flash',
        status: 'success',
      });
    }

    return c.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // 失败也存库
    if (db && body.nodeId) {
      await db.insertAiResult({
        runId: body.runId,
        nodeId: body.nodeId,
        imageUrl: body.image,
        templateId: body.templateId || undefined,
        prompt: body.prompt || undefined,
        result: message,
        model: body.model || 'qwen3.6-flash',
        status: 'failed',
        error: message,
      });
    }

    return c.json({ success: false, error: message }, 500);
  } finally {
    if (db) await db.disconnect();
  }
});

// ─── GET /api/ai/results ──────────────────────────────────────

app.get('/api/ai/results', async (c) => {
  const runId = c.req.query('runId');
  if (!runId) {
    return c.json({ success: false, error: '缺少参数: runId' }, 400);
  }

  const db = createDb();
  if (!db) {
    return c.json({ success: false, error: '数据库不可用' }, 503);
  }

  try {
    await db.connect();
    const results = await db.getAiResults(runId);
    return c.json({ success: true, results });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败',
    }, 500);
  } finally {
    await db.disconnect();
  }
});

// ─── POST /api/ai/compare ────────────────────────────────────

app.post('/api/ai/compare', async (c) => {
  const vision = createVisionService();
  if (!vision) {
    return c.json({ success: false, error: 'DASHSCOPE_API_KEY 未配置' }, 503);
  }

  let body: { images?: string[]; prompt?: string; templateId?: string; model?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: '请求体必须是 JSON' }, 400);
  }

  if (!body.images || !Array.isArray(body.images) || body.images.length < 2) {
    return c.json({ success: false, error: '缺少必填字段: images（至少 2 张图片的 URL/Base64 数组）' }, 400);
  }

  const promptOrTemplate = body.templateId || body.prompt || 'compare-products';

  try {
    const result = await vision.compare(body.images, promptOrTemplate, body.model);
    return c.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
});

// ─── POST /api/search/amazon ─────────────────────────────────

app.post('/api/search/amazon', async (c) => {
  let body: { keyword?: string; maxResults?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: '请求体必须是 JSON' }, 400);
  }

  if (!body.keyword || typeof body.keyword !== 'string') {
    return c.json({ success: false, error: '缺少必填字段: keyword' }, 400);
  }

  const maxResults = Math.min(Number(body.maxResults) || 20, 48);
  const service = new AmazonSearchService();

  try {
    const result = await service.search(body.keyword, maxResults);
    return c.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  } finally {
    await service.close();
  }
});

// ─── POST /api/scrape/amazon-product ────────────────────────

app.post('/api/scrape/amazon-product', async (c) => {
  let body: { asin?: string; url?: string; headless?: boolean; saveToDb?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: '请求体必须是 JSON' }, 400);
  }

  if (!body.asin && !body.url) {
    return c.json({ success: false, error: '缺少必填字段: asin 或 url（至少提供一个）' }, 400);
  }

  const headless = body.headless !== false;
  const saveToDb = body.saveToDb !== false;

  // Optional DB persistence
  let db: DatabaseService | null = null;
  if (saveToDb) {
    db = createDb();
    try { await db!.connect(); } catch { db = null; }
  }

  const startTime = Date.now();
  const runId = `ap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const service = new AmazonProductService();

  try {
    const product = await service.scrape({
      asin: body.asin,
      url: body.url,
      headless,
    });
    const duration = Date.now() - startTime;

    // Persist to DB
    if (db) {
      await db.insertRun({
        runId,
        source: 'amazon-product',
        status: 'completed',
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        itemsScraped: 1,
        errors: 0,
        params: { asin: body.asin || '', url: body.url || '' },
      });
      await db.upsertProduct({
        source: 'amazon-product',
        runId,
        url: product.url,
        externalId: product.asin,
        title: product.title,
        price: product.price ? product.price.replace(/[^0-9.]/g, '') || undefined : undefined,
        currency: 'USD',
        description: [product.bulletPoints.join('\n'), product.longDescription].filter(Boolean).join('\n\n'),
        images: product.images,
        specifications: product.specifications,
        scrapedAt: product.timestamp,
      });
    }

    return c.json({ success: true, runId, duration, product });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  } finally {
    await service.close();
    if (db) await db.disconnect();
  }
});

// ─── GET /api/db/stats ───────────────────────────────────────

app.get('/api/db/stats', async (c) => {
  const db = createDb();
  if (!db) return c.json({ success: false, error: '数据库不可用' }, 503);
  try {
    await db.connect();
    const stats = await db.getStats();
    return c.json({ success: true, ...stats });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : '查询失败' }, 500);
  } finally {
    await db.disconnect();
  }
});

// ─── GET /api/db/runs ───────────────────────────────────────

app.get('/api/db/runs', async (c) => {
  const db = createDb();
  if (!db) return c.json({ success: false, error: '数据库不可用' }, 503);
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
  try {
    await db.connect();
    const runs = await db.listRuns(limit);
    return c.json({ success: true, runs });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : '查询失败' }, 500);
  } finally {
    await db.disconnect();
  }
});

// ─── GET /api/db/products ───────────────────────────────────

app.get('/api/db/products', async (c) => {
  const db = createDb();
  if (!db) return c.json({ success: false, error: '数据库不可用' }, 503);
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
  try {
    await db.connect();
    const products = await db.getProducts(undefined, limit);
    return c.json({ success: true, products });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : '查询失败' }, 500);
  } finally {
    await db.disconnect();
  }
});

// ─── GET /api/db/ai-results ─────────────────────────────────

app.get('/api/db/ai-results', async (c) => {
  const db = createDb();
  if (!db) return c.json({ success: false, error: '数据库不可用' }, 503);
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
  const runId = c.req.query('runId');
  try {
    await db.connect();
    const results = await db.getAiResults(runId || undefined, limit);
    return c.json({ success: true, results });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : '查询失败' }, 500);
  } finally {
    await db.disconnect();
  }
});

// ─── GET /api/db/runs/:runId/products ────────────────────────

app.get('/api/db/runs/:runId/products', async (c) => {
  const db = createDb();
  if (!db) return c.json({ success: false, error: '数据库不可用' }, 503);
  const runId = c.req.param('runId');
  try {
    await db.connect();
    const products = await db.getProductsByRun(runId);
    return c.json({ success: true, products });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : '查询失败' }, 500);
  } finally {
    await db.disconnect();
  }
});

// ─── GET /api/db/runs/:runId/raw ────────────────────────────

app.get('/api/db/runs/:runId/raw', async (c) => {
  const db = createDb();
  if (!db) return c.json({ success: false, error: '数据库不可用' }, 503);
  const runId = c.req.param('runId');
  try {
    await db.connect();
    const raw = await db.getRawByRun(runId);
    return c.json({ success: true, raw: raw.map(r => ({ id: r.id, url: r.url, content: r.content, fetchedAt: r.fetched_at })) });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : '查询失败' }, 500);
  } finally {
    await db.disconnect();
  }
});

// ─── GET /api/db/runs/:runId/staging ─────────────────────────

app.get('/api/db/runs/:runId/staging', async (c) => {
  const db = createDb();
  if (!db) return c.json({ success: false, error: '数据库不可用' }, 503);
  const runId = c.req.param('runId');
  try {
    await db.connect();
    const staging = await db.getStagingByRun(runId);
    return c.json({ success: true, staging: staging.map(s => ({ id: s.id, source: s.source, data: s.data, parsedAt: s.parsed_at })) });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : '查询失败' }, 500);
  } finally {
    await db.disconnect();
  }
});

// ─── POST /api/keywords/xiyouzhaoci ────────────────────────────────

app.post('/api/keywords/xiyouzhaoci', async (c) => {
  try {
    const { asin, headless = true, maxKeywords = 50 } = await c.req.json();

    if (!asin || typeof asin !== 'string') {
      return c.json(
        { success: false, error: 'ASIN is required and must be a string' },
        400,
      );
    }

    // Validate ASIN format (basic check)
    if (!/^[A-Z0-9]{10}$/.test(asin)) {
      return c.json(
        {
          success: false,
          error: 'Invalid ASIN format. ASIN must be 10 alphanumeric characters.',
        },
        400,
      );
    }

    console.log(`[API] Xiyouzhaoci request for ASIN: ${asin}`);

    const result = await xiyouzhaociService.scrapeXiyouzhaociKeywords(asin, {
      headless,
      maxKeywords,
      saveCsv: true,
    });

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[API] Xiyouzhaoci error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return c.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      500,
    );
  }
});

// ─── POST /api/gemini/upload ─────────────────────────────────────────

app.post('/api/gemini/upload', async (c) => {
  try {
    const { filePath, prompt, headless = true, responseTimeout = 60000 } = await c.req.json();

    if (!filePath || typeof filePath !== 'string') {
      return c.json(
        { success: false, error: 'filePath is required and must be a string' },
        400,
      );
    }

    if (!prompt || typeof prompt !== 'string') {
      return c.json(
        { success: false, error: 'prompt is required and must be a string' },
        400,
      );
    }

    console.log(`[API] Gemini file upload request: ${filePath}`);

    const service = new GeminiFileService();
    const result = await service.upload({
      filePath,
      prompt,
      headless,
      responseTimeout,
    });

    return c.json(result);
  } catch (error) {
    console.error('[API] Gemini file upload error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return c.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      500,
    );
  }
});

// ─── POST /api/chatgpt/upload ─────────────────────────────────────────

app.post('/api/chatgpt/upload', async (c) => {
  try {
    const { filePath, prompt, headless = true, responseTimeout = 60000 } = await c.req.json();

    if (!filePath || typeof filePath !== 'string') {
      return c.json(
        { success: false, error: 'filePath is required and must be a string' },
        400,
      );
    }

    if (!prompt || typeof prompt !== 'string') {
      return c.json(
        { success: false, error: 'prompt is required and must be a string' },
        400,
      );
    }

    console.log(`[API] ChatGPT file upload request: ${filePath}`);

    const service = new ChatGPTFileService();
    const result = await service.upload({
      filePath,
      prompt,
      headless,
      responseTimeout,
    });

    return c.json(result);
  } catch (error) {
    console.error('[API] ChatGPT file upload error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return c.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      500,
    );
  }
});

// ─── POST /api/ai/optimize ──────────────────────────────────────

app.post('/api/ai/optimize', async (c) => {
  try {
    const body = await c.req.json();
    const {
      title, description, bulletPoints, longDescription,
      competitors, keywords,
      tone = 'professional', language = 'zh-CN', headless = false,
    } = body;

    if (!title || typeof title !== 'string') {
      return c.json({ success: false, error: 'title is required' }, 400);
    }

    const toneGuide: Record<string, string> = {
      professional: '专业、可信、突出品质',
      marketing: '营销导向、有感染力、刺激购买欲',
      concise: '简洁明了、突出核心卖点',
    };

    // Build competitor block
    let competitorSection = '';
    if (Array.isArray(competitors) && competitors.length > 0) {
      const topComps = competitors.slice(0, 3);
      const sections = topComps.map((comp: Record<string, unknown>, i: number) => {
        const cTitle = String(comp.title || '未知');
        const cBrand = comp.brand ? String(comp.brand) : '';
        const cPrice = comp.price ? `$${comp.price}` : '';
        const cRating = comp.rating ? `${comp.rating}星` : '';
        const cBullets = (Array.isArray(comp.bulletPoints) ? comp.bulletPoints as string[] : []).slice(0, 3);
        const bulletText = cBullets.length > 0
          ? cBullets.map((b, j) => `  ${j + 1}. ${String(b).slice(0, 150)}`).join('\n')
          : '  (无)';
        const cDesc = comp.longDescription ? String(comp.longDescription).slice(0, 200) : '';
        return `### 竞品 ${i + 1}: ${cBrand ? cBrand + ' — ' : ''}${cTitle}\n- 价格: ${cPrice || '未知'} | 评分: ${cRating || '未知'}\n- 五点描述:\n${bulletText}${cDesc ? `\n- 长描述摘要: ${cDesc}` : ''}`;
      }).join('\n\n');
      competitorSection = `\n## 竞品 Listing 分析（Top ${topComps.length}）\n\n${sections}\n\n分析要点: 提取竞品共性卖点、差异化方向、关键词覆盖策略\n`;
    }

    // Build keyword block
    let keywordSection = '';
    if (Array.isArray(keywords) && keywords.length > 0) {
      const topKw = keywords.slice(0, 15);
      keywordSection = `\n## 关键词数据\n${topKw.map((k: Record<string, unknown>, i: number) => `${i + 1}. ${k.keyword || k} (搜索量: ${k.searchVolume || '-'}, 难度: ${k.difficulty || '-'})`).join('\n')}`;
    }

    const prompt = `你是一位资深的 Amazon 跨境电商 Listing 优化专家。请根据以下商品信息和竞品数据，优化文案。

## 我的商品信息
- 标题: ${title}
${description ? `- 描述: ${description}` : ''}
${Array.isArray(bulletPoints) && bulletPoints.length > 0 ? `- 五点描述:\n${bulletPoints.map((b: string, i: number) => `  ${i + 1}. ${b}`).join('\n')}` : ''}
${longDescription ? `- 长描述: ${longDescription}` : ''}
${competitorSection}
${keywordSection}

## 输出要求

请严格按以下结构输出 JSON:
{
  "optimizedTitle": "200字符以内的优化标题",
  "optimizedBulletPoints": ["五点1", "五点2", "五点3", "五点4", "五点5"],
  "optimizedLongDescription": "300-500字长描述",
  "seoKeywords": ["关键词1", "关键词2", ...],
  "competitorAnalysis": "竞品分析总结"
}

语气: ${toneGuide[tone] || toneGuide.professional}
只输出 JSON，不要其他文字`;

    const service = new GeminiFileService();

    try {
      const result = await service.chat(prompt, { headless, responseTimeout: 90000 });

      if (!result.success) {
        return c.json({ success: false, error: result.error }, 500);
      }

      let parsed: Record<string, unknown>;
      try {
        const jsonMatch = result.response.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {
          optimizedTitle: result.response.split('\n')[0]?.slice(0, 200) || title,
          optimizedDescription: result.response.slice(0, 1000) || description,
          seoKeywords: [],
        };
      } catch {
        parsed = {
          optimizedTitle: result.response.split('\n')[0]?.slice(0, 200) || title,
          optimizedDescription: result.response.slice(0, 1000) || description,
          seoKeywords: [],
        };
      }

      return c.json({
        success: true,
        optimizedTitle: parsed.optimizedTitle || title,
        optimizedDescription: parsed.optimizedDescription || description,
        optimizedBulletPoints: parsed.optimizedBulletPoints || [],
        optimizedLongDescription: parsed.optimizedLongDescription || '',
        seoKeywords: parsed.seoKeywords || [],
        competitorAnalysis: parsed.competitorAnalysis || '',
      });
    } finally {
      await service.close();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: errorMessage }, 500);
  }
});

// ─── Workflow Execution APIs ────────────────────────────────

// POST /api/workflow/executions — Create execution record
app.post('/api/workflow/executions', async (c) => {
  const db = new DatabaseService();
  try {
    await db.connect();
    const { execution_id, template_id, workflow_name, trigger } = await c.req.json();
    if (!execution_id || !workflow_name) {
      return c.json({ success: false, error: 'execution_id and workflow_name required' }, 400);
    }
    await db.pool.query(
      `INSERT INTO workflow_executions (execution_id, template_id, workflow_name, trigger)
       VALUES ($1, $2, $3, $4)`,
      [execution_id, template_id || null, workflow_name, trigger || 'manual']
    );
    return c.json({ success: true, execution_id });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  } finally {
    await db.disconnect();
  }
});

// GET /api/workflow/executions — List executions
app.get('/api/workflow/executions', async (c) => {
  const db = new DatabaseService();
  try {
    await db.connect();
    const status = c.req.query('status');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    const { rows } = status
      ? await db.pool.query(
          `SELECT * FROM workflow_executions WHERE status = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
          [status, limit, offset]
        )
      : await db.pool.query(
          `SELECT * FROM workflow_executions ORDER BY started_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
    return c.json({ success: true, executions: rows });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  } finally {
    await db.disconnect();
  }
});

// GET /api/workflow/executions/:id — Single execution with steps and logs
app.get('/api/workflow/executions/:id', async (c) => {
  const db = new DatabaseService();
  try {
    await db.connect();
    const executionId = c.req.param('id');
    const { rows: [exec] } = await db.pool.query(
      `SELECT * FROM workflow_executions WHERE execution_id = $1`, [executionId]
    );
    if (!exec) return c.json({ success: false, error: 'Not found' }, 404);
    const { rows: steps } = await db.pool.query(
      `SELECT * FROM workflow_step_records WHERE execution_id = $1 ORDER BY step_index`, [executionId]
    );
    const { rows: logs } = await db.pool.query(
      `SELECT * FROM workflow_execution_logs WHERE execution_id = $1 ORDER BY created_at`, [executionId]
    );
    return c.json({ success: true, execution: exec, steps, logs });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  } finally {
    await db.disconnect();
  }
});

// PUT /api/workflow/executions/:id/complete — Mark execution complete
app.put('/api/workflow/executions/:id/complete', async (c) => {
  const db = new DatabaseService();
  try {
    await db.connect();
    const executionId = c.req.param('id');
    const { status = 'completed', duration_ms } = await c.req.json();
    const { rows: [{ count: total }] } = await db.pool.query(
      `SELECT COUNT(*) as count FROM workflow_step_records WHERE execution_id = $1`, [executionId]
    );
    const { rows: [{ count: success }] } = await db.pool.query(
      `SELECT COUNT(*) as count FROM workflow_step_records WHERE execution_id = $1 AND status = 'success'`, [executionId]
    );
    const { rows: [{ count: errors }] } = await db.pool.query(
      `SELECT COUNT(*) as count FROM workflow_step_records WHERE execution_id = $1 AND status = 'error'`, [executionId]
    );
    await db.pool.query(
      `UPDATE workflow_executions SET status = $1, duration_ms = $2, total_steps = $3, success_steps = $4, error_steps = $5, completed_at = NOW() WHERE execution_id = $6`,
      [status, duration_ms || null, Number(total), Number(success), Number(errors), executionId]
    );
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  } finally {
    await db.disconnect();
  }
});

// POST /api/workflow/steps — Write step data
app.post('/api/workflow/steps', async (c) => {
  const db = new DatabaseService();
  try {
    await db.connect();
    const { execution_id, step_index, node_id, node_label, node_type, status, input_data, output_data, config_data, duration_ms, error, logs } = await c.req.json();
    if (!execution_id || !node_id) {
      return c.json({ success: false, error: 'execution_id and node_id required' }, 400);
    }
    await db.pool.query(
      `INSERT INTO workflow_step_records (execution_id, step_index, node_id, node_label, node_type, status, input_data, output_data, config_data, duration_ms, error, logs, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb, NOW())`,
      [execution_id, step_index ?? 0, node_id, node_label || node_id, node_type || 'step', status || 'success',
       JSON.stringify(input_data || {}), JSON.stringify(output_data || {}), JSON.stringify(config_data || {}),
       duration_ms || null, error || null, JSON.stringify(logs || [])]
    );
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  } finally {
    await db.disconnect();
  }
});

// GET /api/workflow/steps/:node_id/history — Node execution history
app.get('/api/workflow/steps/:node_id/history', async (c) => {
  const db = new DatabaseService();
  try {
    await db.connect();
    const nodeId = c.req.param('node_id');
    const limit = parseInt(c.req.query('limit') || '20');
    const { rows } = await db.pool.query(
      `SELECT ws.*, we.workflow_name, we.started_at as exec_started_at
       FROM workflow_step_records ws
       JOIN workflow_executions we ON ws.execution_id = we.execution_id
       WHERE ws.node_id = $1
       ORDER BY ws.id DESC LIMIT $2`,
      [nodeId, limit]
    );
    return c.json({ success: true, history: rows });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  } finally {
    await db.disconnect();
  }
});

// POST /api/workflow/logs — Write logs (batch)
app.post('/api/workflow/logs', async (c) => {
  const db = new DatabaseService();
  try {
    await db.connect();
    const { execution_id, logs } = await c.req.json();
    if (!execution_id || !Array.isArray(logs)) {
      return c.json({ success: false, error: 'execution_id and logs[] required' }, 400);
    }
    for (const log of logs) {
      await db.pool.query(
        `INSERT INTO workflow_execution_logs (execution_id, node_id, node_label, level, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [execution_id, log.node_id || null, log.node_label || null, log.level || 'info', log.message || '']
      );
    }
    return c.json({ success: true, count: logs.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  } finally {
    await db.disconnect();
  }
});

// GET /api/workflow/stats — Dashboard statistics
app.get('/api/workflow/stats', async (c) => {
  const db = new DatabaseService();
  try {
    await db.connect();
    const { rows: [{ count: totalExecs }] } = await db.pool.query(`SELECT COUNT(*) as count FROM workflow_executions`);
    const { rows: [{ count: successExecs }] } = await db.pool.query(`SELECT COUNT(*) as count FROM workflow_executions WHERE status = 'completed'`);
    const { rows: [{ avg: avgDur }] } = await db.pool.query(`SELECT ROUND(AVG(duration_ms)) as avg FROM workflow_executions WHERE status = 'completed'`);
    const { rows: [{ count: activeNodes }] } = await db.pool.query(`SELECT COUNT(DISTINCT node_id) as count FROM workflow_step_records`);
    const { rows: nodeStats } = await db.pool.query(
      `SELECT node_id, node_label, COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'success') as success, ROUND(AVG(duration_ms)) as avg_ms
       FROM workflow_step_records GROUP BY node_id, node_label ORDER BY total DESC`
    );
    const { rows: trend } = await db.pool.query(
      `SELECT DATE(started_at) as date, COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'completed') as success, COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM workflow_executions WHERE started_at > NOW() - INTERVAL '30 days' GROUP BY DATE(started_at) ORDER BY date DESC`
    );
    return c.json({
      success: true,
      stats: {
        totalExecutions: Number(totalExecs),
        successRate: Number(totalExecs) > 0 ? Math.round(Number(successExecs) / Number(totalExecs) * 100) : 0,
        avgDurationMs: Number(avgDur) || 0,
        activeNodes: Number(activeNodes),
      },
      nodeStats,
      trend,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  } finally {
    await db.disconnect();
  }
});

// ─── 全局错误处理 ────────────────────────────────────────────

// ─── 静态文件服务（Electron 生产模式） ─────────────────────────

const FRONTEND_DIR = process.env.FRONTEND_DIR;

if (FRONTEND_DIR && fs.existsSync(FRONTEND_DIR)) {
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  function getMime(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // Serve static assets from FRONTEND_DIR
  app.get('/assets/*', (c) => {
    const assetPath = new URL(c.req.url).pathname;
    const filePath = path.join(FRONTEND_DIR, assetPath);
    try {
      const content = fs.readFileSync(filePath);
      return new Response(content, {
        headers: { 'Content-Type': getMime(filePath), 'Cache-Control': 'public, max-age=86400' },
      });
    } catch {
      return c.notFound();
    }
  });

  // SPA fallback: serve index.html for non-API routes not otherwise matched
  app.notFound((c) => {
    const urlPath = new URL(c.req.url).pathname;
    if (urlPath.startsWith('/api/')) {
      return c.json({ error: 'Not found' }, 404);
    }
    const indexPath = path.join(FRONTEND_DIR, 'index.html');
    try {
      return c.html(fs.readFileSync(indexPath, 'utf-8'));
    } catch {
      return c.json({ error: 'Not found' }, 404);
    }
  });
}

// ─── 全局错误处理 ────────────────────────────────────────────

app.onError((err, c) => {
  console.error(`[API Error] ${err.message}`);
  return c.json({ success: false, error: err.message }, 500);
});

// ─── 启动 ────────────────────────────────────────────────────

serve(
  { fetch: app.fetch, port: PORT },
  (info) => {
    console.log(`\n  🚀 API 服务器已启动`);
    console.log(`  📍 http://localhost:${info.port}`);
    console.log(`  📋 路由:`);
    console.log(`     GET  /api/health`);
    console.log(`     POST /api/crawl/gigab2b`);
    console.log(`     GET  /api/runs`);
    console.log(`     GET  /api/runs/:id`);
    console.log(`     POST /api/ai/recognize`);
    console.log(`     POST /api/ai/compare`);
    console.log(`     GET  /api/ai/templates`);
    console.log(`     GET  /api/ai/results`);
    console.log(`     POST /api/search/amazon`);
    console.log(`     POST /api/scrape/amazon-product`);
    console.log(`     POST /api/keywords/xiyouzhaoci`);
    console.log(`     POST /api/gemini/upload`);
    console.log(`     POST /api/chatgpt/upload`);
    console.log(`     POST /api/ai/optimize\n`);
  }
);
