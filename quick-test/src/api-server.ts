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
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { CrawlerService } from './services/crawler-service';
import { AiVisionService, PROMPT_TEMPLATES } from './services/ai-vision-service';
import { AmazonSearchService } from './services/amazon-search-service';
import { DatabaseService } from './core/database-service';

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
    console.log(`     POST /api/search/amazon\n`);
  }
);
