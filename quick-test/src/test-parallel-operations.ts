import { launchPersistent, log, sleep } from './utils';

/**
 * 并行操作测试
 *
 * 演示如何在多个页面同时执行不同的操作
 */

async function testParallelOperations() {
  log('='.repeat(60), 'info');
  log('🚀 并行操作测试', 'info');
  log('='.repeat(60), 'info');

  try {
    // 1. 启动浏览器
    const context = await launchPersistent();
    log('✅ 浏览器已启动', 'success');

    // 2. 创建多个页面
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const page3 = await context.newPage();
    log('✅ 已创建3个页面', 'success');

    // 3. 同时访问不同网站
    log('\n🌐 同时访问3个网站...', 'info');
    await Promise.all([
      page1.goto('https://chatgpt.com/', { timeout: 30000, waitUntil: 'domcontentloaded' }),
      page2.goto('https://www.bilibili.com/', { timeout: 30000, waitUntil: 'domcontentloaded' }),
      page3.goto('https://www.taobao.com/', { timeout: 30000, waitUntil: 'domcontentloaded' })
    ]);
    log('✅ 所有页面加载完成', 'success');

    await sleep(2000);

    // 4. 演示1：同时获取页面信息（并行读取）
    log('\n📖 演示1：同时获取页面信息...', 'info');

    const startTime1 = Date.now();
    const [title1, title2, title3, url1, url2, url3] = await Promise.all([
      page1.title(),
      page2.title(),
      page3.title(),
      page1.url(),
      page2.url(),
      page3.url()
    ]);
    const time1 = Date.now() - startTime1;

    log(`⏱️  并行获取耗时: ${time1}ms`, 'info');
    log(`   页面1: "${title1}" - ${url1}`, 'info');
    log(`   页面2: "${title2}" - ${url2}`, 'info');
    log(`   页面3: "${title3}" - ${url3}`, 'info');

    // 5. 演示2：同时执行JavaScript（并行计算）
    log('\n🧮 演示2：同时执行JavaScript...', 'info');

    const startTime2 = Date.now();
    const results = await Promise.all([
      page1.evaluate(() => {
        return {
          page: 1,
          title: document.title,
          linkCount: document.querySelectorAll('a').length,
          imageCount: document.querySelectorAll('img').length,
          timestamp: Date.now()
        };
      }),
      page2.evaluate(() => {
        return {
          page: 2,
          title: document.title,
          linkCount: document.querySelectorAll('a').length,
          imageCount: document.querySelectorAll('img').length,
          timestamp: Date.now()
        };
      }),
      page3.evaluate(() => {
        return {
          page: 3,
          title: document.title,
          linkCount: document.querySelectorAll('a').length,
          imageCount: document.querySelectorAll('img').length,
          timestamp: Date.now()
        };
      })
    ]);
    const time2 = Date.now() - startTime2;

    log(`⏱️  并行执行耗时: ${time2}ms`, 'info');
    results.forEach(r => {
      log(`   页面${r.page}: ${r.title} (${r.linkCount}个链接, ${r.imageCount}个图片)`, 'info');
    });

    // 6. 演示3：同时截图（并行截图）
    log('\n📸 演示3：同时截图...', 'info');

    const startTime3 = Date.now();
    await Promise.all([
      page1.screenshot({ path: 'output/parallel-1.png' }),
      page2.screenshot({ path: 'output/parallel-2.png' }),
      page3.screenshot({ path: 'output/parallel-3.png' })
    ]);
    const time3 = Date.now() - startTime3;

    log(`⏱️  并行截图耗时: ${time3}ms`, 'info');
    log('✅ 所有截图已保存', 'success');

    // 7. 演示4：模拟真实业务场景（并发数据提取）
    log('\n💼 演示4：模拟业务场景 - 并发数据提取...', 'info');

    const startTime4 = Date.now();

    // 模拟从不同页面同时提取数据
    const businessData = await Promise.all([
      // 从页面1提取用户信息
      page1.evaluate(() => {
        return {
          source: 'ChatGPT',
          data: {
            isLoggedIn: document.querySelector('[data-testid="profile-button"]') !== null,
            pageTitle: document.title,
            bodyText: document.body?.innerText?.substring(0, 100) || ''
          }
        };
      }),

      // 从页面2提取视频信息
      page2.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('.video-card')).length;
        return {
          source: 'Bilibili',
          data: {
            videoCount: videos,
            pageTitle: document.title,
            hasUserMenu: document.querySelector('.nav-user-info') !== null
          }
        };
      }),

      // 从页面3提取商品信息
      page3.evaluate(() => {
        const products = Array.from(document.querySelectorAll('[data-product-id]')).length;
        return {
          source: 'Taobao',
          data: {
            productCount: products,
            pageTitle: document.title,
            hasCart: document.querySelector('.cart') !== null
          }
        };
      })
    ]);

    const time4 = Date.now() - startTime4;

    log(`⏱️  并发数据提取耗时: ${time4}ms`, 'info');
    businessData.forEach(item => {
      log(`📦 ${item.source}数据:`, 'info');
      log(`   ${JSON.stringify(item.data, null, 2)}`, 'info');
    });

    // 8. 演示5：同时滚动页面（并行交互）
    log('\n🖱️  演示5：同时滚动页面...', 'info');

    const startTime5 = Date.now();
    await Promise.all([
      page1.evaluate(() => window.scrollTo(0, 500)),
      page2.evaluate(() => window.scrollTo(0, 500)),
      page3.evaluate(() => window.scrollTo(0, 500))
    ]);
    const time5 = Date.now() - startTime5;

    log(`⏱️  并行滚动耗时: ${time5}ms`, 'info');
    log('✅ 所有页面已滚动', 'success');

    await sleep(1000);

    // 9. 性能对比分析
    log('\n📊 性能对比分析:', 'info');
    log('串行执行（假设）: 6秒 × 3个页面 = 18秒', 'warning');
    log('并行执行（实际）: ' + (time1 + time2 + time3 + time4 + time5) + 'ms = ' + ((time1 + time2 + time3 + time4 + time5) / 1000).toFixed(2) + '秒', 'success');
    log('⚡ 性能提升: ' + ((18000 / (time1 + time2 + time3 + time4 + time5)).toFixed(1)) + 'x', 'success');

    // 10. 总结
    log('\n' + '='.repeat(60), 'info');
    log('🎉 并行操作测试完成！', 'success');
    log('='.repeat(60), 'info');

    log('\n✅ 验证结果:', 'success');
    log('✅ 可以同时读取页面信息', 'success');
    log('✅ 可以同时执行JavaScript', 'success');
    log('✅ 可以同时截图', 'success');
    log('✅ 可以同时提取数据', 'success');
    log('✅ 可以同时操作页面', 'success');

    log('\n💡 并行操作的优势:', 'info');
    log('   ⚡ 大幅提升效率（3-5倍）', 'info');
    log('   📊 同时处理多个页面', 'info');
    log('   🔄 适合数据采集场景', 'info');
    log('   💾 共享登录状态', 'info');

    log('\n🔥 实际应用场景:', 'info');
    log('   ✅ 同时抓取多个商品页面', 'info');
    log('   ✅ 同时监控多个订单状态', 'info');
    log('   ✅ 同时查询多个库存页面', 'info');
    log('   ✅ 同时操作多个后台页面', 'info');

    log('\n💡 浏览器保持打开，您可以查看3个标签页的状态', 'info');

    // 保持浏览器打开
    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 测试失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testParallelOperations();
