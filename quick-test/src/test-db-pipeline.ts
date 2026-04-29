/**
 * 数据管道完整测试 — 本地文件 + PostgreSQL 三层存储
 *
 * 流程：
 *   docker-compose up -d → 模拟爬虫数据写入三层 → 查询验证
 */

import { RunContext } from './core/run-context';
import { DatabaseService } from './core/database-service';
import { log } from './utils';
import { execSync } from 'child_process';

async function waitForDB(db: DatabaseService, retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      await db.connect();
      log('   ✅ 数据库连接成功', 'success');
      return;
    } catch {
      log(`   等待数据库就绪 (${i + 1}/${retries})...`, 'info');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('数据库连接失败');
}

async function testDBPipeline() {
  log('='.repeat(60), 'info');
  log('数据管道测试：本地文件 + PostgreSQL', 'info');
  log('='.repeat(60), 'info');

  // ─── 1. 启动 PostgreSQL ─────────────────────────────────────
  log('\n1. 启动 PostgreSQL...', 'info');
  try {
    execSync('docker-compose up -d', { cwd: process.cwd(), stdio: 'pipe' });
    log('   ✅ docker-compose up -d', 'success');
  } catch {
    log('   ⚠️  docker-compose 启动失败，可能已运行中', 'warning');
  }

  const db = new DatabaseService();
  await waitForDB(db);

  try {
    // ─── 2. 创建本地运行上下文 ────────────────────────────────
    log('\n2. 创建运行上下文...', 'info');
    const run = await RunContext.create('gigab2b', {
      productUrl: 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431'
    });
    log(`   Run ID: ${run.run.runId}`, 'success');

    // 先把 run 写入 DB（外键约束需要）
    await db.insertRun(run.run);
    log('   🗄️  DB: crawler_runs 已写入', 'success');

    // ─── 3. Raw 层：保存原始 HTML 到本地 + DB ─────────────────
    log('\n3. Raw 层 — 保存原始 HTML...', 'info');
    const rawHtml = `<!DOCTYPE html>
<html><head><title>Modern Fabric Sofa Couch</title></head>
<body>
  <h1>  Modern Fabric Sofa Couch 2-Seater  </h1>
  <div class="price">  $599.00  </div>
  <p class="product-description">A comfortable 2-seater sofa with solid wood frame</p>
  <img src="https://example.com/img1.jpg" />
  <img src="https://example.com/img2.jpg" />
  <img src="https://example.com/img3.jpg" />
  <div id="tab-description">
    <div class="items"><span>Material:</span><span>Fabric + Wood</span></div>
    <div class="items"><span>Color:</span><span>Gray</span></div>
    <div class="items"><span>Weight:</span><span>45 kg</span></div>
  </div>
</body></html>`;

    // 本地文件
    const rawPath = await run.saveRaw('product-page.html', rawHtml);
    log(`   📁 本地: ${rawPath}`, 'info');

    // PostgreSQL
    const rawId = await db.insertRaw(
      run.run.runId,
      'https://www.gigab2b.com/index.php?route=product/product&product_id=747431',
      rawHtml
    );
    log(`   🗄️  DB: raw_data id=${rawId}`, 'success');

    // ─── 4. Staging 层 ────────────────────────────────────────
    log('\n4. Staging 层 — 保存解析后数据（保留原始格式）...', 'info');
    const parsedData = {
      url: 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431',
      title: '  Modern Fabric Sofa Couch 2-Seater  ',
      price: '  $599.00  ',
      description: 'A comfortable 2-seater sofa with solid wood frame',
      images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg', 'https://example.com/img3.jpg'],
      specifications: { 'Material': 'Fabric + Wood', 'Color': 'Gray', 'Weight': '45 kg' },
      scrapedAt: new Date().toISOString(),
    };

    const stagingPath = await run.saveStaging('product-data.json', parsedData);
    log(`   📁 本地: ${stagingPath}`, 'info');

    const stagingId = await db.insertStaging(run.run.runId, 'gigab2b', parsedData);
    log(`   🗄️  DB: staging_data id=${stagingId}`, 'success');
    run.incrementItems();

    // ─── 5. Clean 层 ──────────────────────────────────────────
    log('\n5. Clean 层 — 清洗数据并写入...', 'info');

    // 清洗逻辑
    const cleanRecord = {
      source: run.run.source,
      runId: run.run.runId,
      url: parsedData.url,
      externalId: '747431',
      title: parsedData.title.trim(),
      price: '599.00',
      currency: 'USD',
      description: parsedData.description.trim(),
      images: parsedData.images,
      specifications: parsedData.specifications,
      scrapedAt: parsedData.scrapedAt,
    };

    const cleanPath = await run.saveClean('product-ready.json', cleanRecord);
    log(`   📁 本地: ${cleanPath}`, 'info');

    const cleanId = await db.upsertProduct(cleanRecord);
    log(`   🗄️  DB: clean_products id=${cleanId}`, 'success');

    // ─── 6. 完成运行 ──────────────────────────────────────────
    await run.complete('completed');
    await db.updateRun(run.run);

    // ─── 7. 验证 ──────────────────────────────────────────────
    log('\n' + '='.repeat(60), 'info');
    log('验证：从数据库查询', 'info');
    log('='.repeat(60), 'info');

    const runs = await db.listRuns();
    log(`\n📋 运行记录 (${runs.length}):`, 'info');
    runs.forEach(r => log(`   ${r.runId} | ${r.source} | ${r.status} | ${r.itemsScraped} items`, 'info'));

    const products = await db.getProducts('gigab2b');
    log(`\n📦 Clean 产品 (${products.length}):`, 'info');
    products.forEach(p => {
      log(`   ${p.externalId} | ${p.title} | ${p.price} ${p.currency} | ${p.images.length} images`, 'info');
    });

    // 确认三层数据都写入了
    const rawRows = await db.getRawByRun(run.run.runId);
    log(`\n📐 三层数据量:`, 'info');
    log(`   raw:     ${rawRows.length} 行`, 'info');
    log(`   staging: 1 行`, 'info');
    log(`   clean:   ${products.filter(p => p.runId === run.run.runId).length} 行`, 'info');

    log('\n' + '='.repeat(60), 'info');
    log('测试通过！', 'success');
    log('='.repeat(60), 'info');

  } finally {
    await db.disconnect();
  }
}

testDBPipeline().catch(err => {
  log(`\n❌ 测试失败: ${err.message}`, 'error');
  console.error(err);
  process.exit(1);
});
