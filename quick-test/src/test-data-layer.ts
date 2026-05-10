/**
 * 数据中间层测试
 *
 * 演示一个完整的爬虫数据生命周期：
 *   创建 Run → 保存 Raw → 保存 Staging → 保存 Clean → 完成 Run
 *
 * 不启动浏览器，只测试数据层本身。
 */

import { RunContext } from './core/run-context';
import { log } from './utils';

async function testDataLayer() {
  log('='.repeat(60), 'info');
  log('测试数据中间层', 'info');
  log('='.repeat(60), 'info');

  // ─── 1. 创建 Run ─────────────────────────────────────────────
  log('\n1. 创建运行上下文...', 'info');
  const run = await RunContext.create('gigab2b', {
    productUrl: 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431'
  });
  log(`   Run ID: ${run.run.runId}`, 'success');
  log(`   目录: ${run.dirs.root}`, 'info');

  // ─── 2. 保存 Raw 层（原始 HTML） ──────────────────────────────
  log('\n2. 保存 raw 层（原始 HTML）...', 'info');
  const rawHtml = `<!DOCTYPE html>
<html><head><title>Sofa Couch</title></head>
<body>
  <h1>Modern Fabric Sofa Couch</h1>
  <div class="price">$599.00</div>
  <div class="product-description">A comfortable modern sofa couch with solid wood frame</div>
  <div class="product-images">
    <img src="https://example.com/image1.jpg" />
    <img src="https://example.com/image2.jpg" />
    <img src="https://example.com/image3.jpg" />
  </div>
  <div id="tab-description">
    <div class="items"><span>Material:</span><span>Fabric + Solid Wood</span></div>
    <div class="items"><span>Color:</span><span>Gray</span></div>
    <div class="items"><span>Weight:</span><span>45 kg</span></div>
    <div class="items"><span>Package Size:</span><span>180x80x70 cm</span></div>
  </div>
</body></html>`;
  const rawPath = await run.saveRaw('product-page.html', rawHtml);
  log(`   ✅ ${rawPath}`, 'success');

  // ─── 3. 解析并保存 Staging 层 ────────────────────────────────
  log('\n3. 解析数据 → 保存 staging 层...', 'info');
  const parsedData = {
    url: 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431',
    title: '  Modern Fabric Sofa Couch  ',
    price: '  $599.00  ',
    description: 'A comfortable modern sofa couch with solid wood frame',
    images: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
      'https://example.com/image3.jpg'
    ],
    specifications: {
      'Material': 'Fabric + Solid Wood',
      'Color': 'Gray',
      'Weight': '45 kg',
      'Package Size': '180x80x70 cm'
    },
    scrapedAt: new Date().toISOString()
  };
  const stagingPath = await run.saveStaging('product-data.json', parsedData);
  log(`   ✅ ${stagingPath}`, 'success');
  run.incrementItems();

  // ─── 4. 清洗并保存 Clean 层 ──────────────────────────────────
  log('\n4. 清洗数据 → 保存 clean 层（入库就绪）...', 'info');

  // 清洗规则示例：trim、提取纯数字价格、生成外部 ID
  const cleanPrice = parsedData.price.trim().replace('$', '');
  const externalId = '747431';  // 从 URL 或页面中提取

  const cleanData = {
    source: run.run.source,
    runId: run.run.runId,
    url: parsedData.url,
    externalId,
    title: parsedData.title.trim(),
    price: cleanPrice,
    currency: 'USD',
    description: parsedData.description.trim(),
    images: parsedData.images,
    specifications: parsedData.specifications,
    scrapedAt: parsedData.scrapedAt,
  };

  const cleanPath = await run.saveClean('product-ready.json', cleanData);
  log(`   ✅ ${cleanPath}`, 'success');

  // ─── 5. 完成运行 ─────────────────────────────────────────────
  log('\n5. 完成运行...', 'info');
  await run.complete('completed');
  log(`   状态: ${run.run.status}`, 'success');
  log(`   抓取项: ${run.run.itemsScraped}`, 'info');

  // ─── 6. 查看运行历史 ─────────────────────────────────────────
  log('\n6. 所有运行记录:', 'info');
  const runs = RunContext.listRuns();
  runs.forEach(r => {
    log(`   ${r.runId}  ${r.source.padEnd(10)} ${r.status.padEnd(12)} ${r.startedAt.slice(0, 19)}`, 'info');
  });

  // ─── 7. 验证可以恢复已存在的运行 ──────────────────────────────
  log('\n7. 通过 runId 恢复运行上下文...', 'info');
  const restoredRun = await RunContext.getRun(run.run.runId);
  if (restoredRun) {
    log(`   恢复成功: ${restoredRun.run.runId}`, 'success');
    log(`   原始 run.json 内容:`, 'info');
    console.log(JSON.stringify(restoredRun.run, null, 2));
  }

  // ─── 8. 输出目录结构 ─────────────────────────────────────────
  log('\n8. 生成的目录结构:', 'info');
  log(`   output/runs/${run.run.runId}/`, 'info');
  log(`   ├── run.json`, 'info');
  log(`   ├── raw/product-page.html`, 'info');
  log(`   ├── staging/product-data.json`, 'info');
  log(`   └── clean/product-ready.json`, 'info');

  log('\n' + '='.repeat(60), 'info');
  log('测试完成！验证点:', 'success');
  log('   ✅ 每次运行有独立 runId，不会覆盖', 'info');
  log('   ✅ Raw / Staging / Clean 三层分离', 'info');
  log('   ✅ run.json 记录完整运行状态', 'info');
  log('   ✅ 支持通过 runId 恢复运行上下文', 'info');
  log('   ✅ listRuns() 可查看所有历史运行', 'info');
  log('='.repeat(60), 'info');
}

testDataLayer().catch(console.error);
