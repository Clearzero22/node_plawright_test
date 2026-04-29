/**
 * GigaB2B 产品数据抓取 — 接入数据中间层版本
 *
 * 对比 test-gigab2b-clean.ts，展示了三个核心变化：
 *   1. RunContext 管理运行生命周期
 *   2. Raw → Staging → Clean 三层数据分离
 *   3. 错误时自动标记 run 状态为 failed
 */

import { launchPersistent, getPageFromContext, log, sleep, screenshot } from './utils';
import { RunContext } from './core/run-context';
import { ProductRecord } from './core/types';

async function testGigaB2B() {
  // ─── 1. 创建运行上下文 ──────────────────────────────────────
  const run = await RunContext.create('gigab2b', {
    productUrl: 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431'
  });
  log(`Run ID: ${run.run.runId}`, 'info');

  try {
    // ─── 2. 启动浏览器 ─────────────────────────────────────────
    const context = await launchPersistent();
    const page = await getPageFromContext(context);

    const productUrl = 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431';
    log(`\n📦 访问产品页面: ${productUrl}`, 'info');
    await page.goto(productUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await sleep(2000);

    // ─── 3. 保存 Raw 层：原始 HTML ──────────────────────────────
    log('\n💾 保存原始 HTML...', 'info');
    const html = await page.content();
    await run.saveRaw('product-page.html', html);
    log(`   ✅ raw/product-page.html`, 'success');

    await screenshot(page, `${run.run.runId}/product-page`);
    log('📸 截图已保存', 'info');

    // ─── 4. 点击 Product Info 标签 ──────────────────────────────
    log('\n📋 点击 Product Info 标签...', 'info');
    try {
      await page.waitForSelector('#tab-description', { timeout: 5000 });
      await page.locator('#tab-description').click();
      await sleep(3000);
    } catch {
      log('⚠️  Product Info 标签点击失败', 'warning');
    }

    // ─── 5. 解析数据 → 保存 Staging 层 ──────────────────────────
    log('\n📊 抓取产品数据...', 'info');

    // Playwright 方式抓取规格
    const productInfoPane = page.locator('#pane-description');
    const itemsCount = await productInfoPane.locator('.items').count();
    const specifications: Record<string, string> = {};
    for (let i = 0; i < itemsCount; i++) {
      const spans = productInfoPane.locator('.items').nth(i).locator('span');
      if (await spans.count() >= 2) {
        const key = (await spans.nth(0).textContent())?.replace(/:$/, '').trim();
        const val = (await spans.nth(1).textContent())?.trim();
        if (key && val && key.length > 2) {
          specifications[key] = val;
        }
      }
    }

    // page.evaluate 抓取其他数据（staging 层：保留原始格式，不做深度清洗）
    // 注意：evaluate 内必须用 function 声明，避免 tsx 注入 __name 导致报错
    const parsedData = await page.evaluate(function() {
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
        title: title,
        price: price,
        description: desc,
        images: images,
        scrapedAt: new Date().toISOString()
      };
    });

    parsedData.specifications = specifications;

    // staging 数据保持原始格式，不做 trim 以外的额外清洗
    log(`   标题: ${parsedData.title || '(空)'}`, 'info');
    log(`   价格: ${parsedData.price || '(空)'}`, 'info');
    log(`   图片: ${parsedData.images.length} 张`, 'info');
    log(`   规格: ${Object.keys(specifications).length} 个`, 'info');

    await run.saveStaging('product-data.json', parsedData);
    log(`   ✅ staging/product-data.json`, 'success');
    run.incrementItems();

    // ─── 6. 清洗数据 → 保存 Clean 层（入库就绪） ──────────────
    log('\n🧹 清洗数据...', 'info');

    const externalIdMatch = parsedData.url.match(/product_id=(\d+)/);
    const cleanPrice = parsedData.price
      .replace(/Login To See Price.*/gi, '')
      .replace(/[^0-9.]/g, '')
      .trim();

    const cleanData: ProductRecord = {
      source: run.run.source,
      runId: run.run.runId,
      url: parsedData.url,
      externalId: externalIdMatch ? externalIdMatch[1] : 'unknown',
      title: parsedData.title.replace(/\s+/g, ' ').trim(),
      price: cleanPrice || undefined,
      currency: cleanPrice ? 'USD' : undefined,
      description: parsedData.description.trim() || undefined,
      images: parsedData.images,
      specifications: parsedData.specifications,
      scrapedAt: parsedData.scrapedAt,
    };

    await run.saveClean('product-ready.json', cleanData);
    log(`   ✅ clean/product-ready.json`, 'success');

    // 输出清洗摘要
    log('\n📋 清洗前后对比:', 'info');
    log(`   标题: "${parsedData.title}" → "${cleanData.title}"`, 'info');
    log(`   价格: "${parsedData.price}" → "${cleanData.price} ${cleanData.currency}"`, 'info');

    // ─── 7. 完成运行 ───────────────────────────────────────────
    await run.complete('completed');
    log(`\n✅ 运行完成: ${run.run.runId}`, 'success');

    // ─── 8. 保存截图 ───────────────────────────────────────────
    await screenshot(page, `${run.run.runId}/final`);
    log('📸 最终截图已保存', 'info');

    // 输出摘要
    log('\n' + '='.repeat(60), 'info');
    log('📊 抓取摘要', 'info');
    log('='.repeat(60), 'info');
    log(`   Run ID: ${run.run.runId}`, 'info');
    log(`   产品: ${cleanData.title}`, 'info');
    log(`   价格: ${cleanData.price || 'N/A'} ${cleanData.currency || ''}`, 'info');
    log(`   图片: ${cleanData.images.length} 张`, 'info');
    log(`   规格: ${Object.keys(cleanData.specifications).length} 个`, 'info');
    log('='.repeat(60), 'info');
    log('\n💡 文件位置:', 'info');
    log(`   📄 run.json     → ${run.dirs.root}/`, 'info');
    log(`   📄 raw/         → ${run.dirs.raw}/`, 'info');
    log(`   📄 staging/     → ${run.dirs.staging}/`, 'info');
    log(`   📄 clean/       → ${run.dirs.clean}/`, 'info');

    await new Promise(() => {});

  } catch (error: any) {
    log(`\n❌ 抓取失败: ${error.message}`, 'error');
    await run.complete('failed', error.message);
    console.error(error);
    process.exit(1);
  }
}

testGigaB2B();
