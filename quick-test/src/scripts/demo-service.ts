/**
 * 服务层演示 — 不启动浏览器，只测试服务层编排
 *
 * 演示 CrawlerService 可以被多种方式调用（CLI / API / 按钮）
 * 且调用方不需要知道爬虫内部逻辑
 */

import { CrawlerService } from '../services/crawler-service';
import { DatabaseService } from '../core/database-service';
import { log } from '../utils';

async function demo() {
  log('='.repeat(60), 'info');
  log('CrawlerService 演示', 'info');
  log('=', 'info');
  log('', 'info');
  log('分层结构:', 'info');
  log('  scripts/     →  最薄入口，只负责 CLI 参数解析', 'info');
  log('  services/    →  编排层，统一管理运行生命周期', 'info');
  log('  crawlers/    →  爬虫实现，只关心导航+提取+清洗', 'info');
  log('  core/        →  基础设施，文件+DB存储', 'info');
  log('', 'info');

  const svc = new CrawlerService();

  // ─── 演示 1：查看运行历史 ─────────────────────────────────
  log('\n📋 运行历史:', 'info');
  const runs = await svc.listRuns();
  if (runs.length === 0) {
    log('   (还没有运行记录)', 'info');
  } else {
    runs.forEach(r => log(`   ${r.runId} | ${r.source} | ${r.status}`, 'info'));
  }

  // ─── 演示 2：服务层可被不同前端调用 ────────────────────────
  log('\n', 'info');
  log('调用方式示例:', 'info');
  log('', 'info');
  log('  // 方式 1: CLI', 'info');
  log('  $ npx tsx src/scripts/run-gigab2b.ts', 'info');
  log('  $ npx tsx src/scripts/run-gigab2b.ts --db', 'info');
  log('  $ npx tsx src/scripts/run-gigab2b.ts --headless', 'info');
  log('', 'info');
  log('  // 方式 2: API 服务器 (未来)', 'info');
  log('  app.post("/api/crawl", async (req, res) => {', 'info');
  log('    const result = await svc.runGigaB2B(req.body.url);', 'info');
  log('    res.json(result);', 'info');
  log('  });', 'info');
  log('', 'info');
  log('  // 方式 3: 按钮点击 (未来)', 'info');
  log('  button.onclick = async () => {', 'info');
  log('    const result = await svc.runGigaB2B(urlInput.value);', 'info');
  log('    showResult(result);', 'info');
  log('  };', 'info');
  log('', 'info');

  // ─── 演示 3：数据库查询 ────────────────────────────────────
  try {
    const db = new DatabaseService();
    await db.connect();
    const dbRuns = await db.listRuns();
    log(`📊 数据库运行记录: ${dbRuns.length} 条`, 'info');
    await db.disconnect();
  } catch {
    log('⚠️  数据库不可用 (docker-compose up -d 启动)', 'warning');
  }

  log('\n✅ 演示完成', 'success');
}

demo().catch(console.error);
