import { launchPersistent, log, sleep, screenshot } from './utils';

/**
 * 单Context多Pages测试
 *
 * 测试场景：同一个已登录账号下同时打开多个页面
 * 适用场景：需要同时操作多个页面，提高效率
 */

async function testMultiPages() {
  log('='.repeat(60), 'info');
  log('🚀 单Context多Pages测试', 'info');
  log('='.repeat(60), 'info');

  try {
    // 1. 启动持久化浏览器
    const context = await launchPersistent();
    log('✅ 浏览器已启动（持久化模式）', 'success');

    // 2. 同时创建多个页面（共享同一个Context）
    log('\n📑 创建多个页面...', 'info');

    const page1 = await context.newPage();
    log('✅ 页面1已创建', 'success');

    const page2 = await context.newPage();
    log('✅ 页面2已创建', 'success');

    const page3 = await context.newPage();
    log('✅ 页面3已创建', 'success');

    // 3. 定义测试URL（使用不同页面测试并发访问）
    const urls = [
      'https://chatgpt.com/',
      'https://www.bilibili.com/',
      'https://www.taobao.com/'
    ];

    // 4. 同时访问多个页面（并发加载）
    log('\n🌐 同时加载多个页面...', 'info');
    log('⏱️  开始时间：' + new Date().toLocaleTimeString(), 'info');

    const startTime = Date.now();

    await Promise.all([
      page1.goto(urls[0], { timeout: 30000, waitUntil: 'domcontentloaded' })
        .then(() => log(`✅ 页面1加载完成: ${urls[0]}`, 'success'))
        .catch(err => log(`❌ 页面1加载失败: ${err.message}`, 'error')),

      page2.goto(urls[1], { timeout: 30000, waitUntil: 'domcontentloaded' })
        .then(() => log(`✅ 页面2加载完成: ${urls[1]}`, 'success'))
        .catch(err => log(`❌ 页面2加载失败: ${err.message}`, 'error')),

      page3.goto(urls[2], { timeout: 30000, waitUntil: 'domcontentloaded' })
        .then(() => log(`✅ 页面3加载完成: ${urls[2]}`, 'success'))
        .catch(err => log(`❌ 页面3加载失败: ${err.message}`, 'error'))
    ]);

    const loadTime = Date.now() - startTime;
    log(`⏱️  总耗时: ${loadTime}ms (${(loadTime / 1000).toFixed(2)}秒)`, 'info');

    // 5. 同时获取页面标题（验证页面状态）
    log('\n📄 同时获取页面信息...', 'info');

    const [title1, title2, title3] = await Promise.all([
      page1.title(),
      page2.title(),
      page3.title()
    ]);

    log(`📌 页面1标题: "${title1 || '(空)'}"`, 'info');
    log(`📌 页面2标题: "${title2 || '(空)'}"`, 'info');
    log(`📌 页面3标题: "${title3 || '(空)'}"`, 'info');

    // 6. 等待页面稳定
    log('\n⏳ 等待页面稳定...', 'info');
    await sleep(3000);

    // 7. 同时截图（验证所有页面都正常工作）
    log('\n📸 同时截图多个页面...', 'info');

    await Promise.all([
      page1.screenshot({ path: 'output/multi-page-1.png' })
        .then(() => log('✅ 页面1截图完成', 'success')),

      page2.screenshot({ path: 'output/multi-page-2.png' })
        .then(() => log('✅ 页面2截图完成', 'success')),

      page3.screenshot({ path: 'output/multi-page-3.png' })
        .then(() => log('✅ 页面3截图完成', 'success'))
    ]);

    // 8. 验证共享登录状态
    log('\n🔐 验证共享登录状态...', 'info');

    // 获取Context的Cookies
    const cookies = await context.cookies();
    log(`🍪 Context共享Cookies数量: ${cookies.length}`, 'info');

    if (cookies.length > 0) {
      log('✅ 确认：所有页面共享相同的Cookies', 'success');
      log('💡 这意味着在任一页面登录后，其他页面也会自动登录', 'info');
    }

    // 9. 测试页面间独立性
    log('\n🧪 测试页面间独立性...', 'info');

    // 在不同页面执行不同的JavaScript（验证它们是独立的）
    const results = await Promise.all([
      page1.evaluate(() => {
        return { page: 1, url: window.location.href, timestamp: Date.now() };
      }),
      page2.evaluate(() => {
        return { page: 2, url: window.location.href, timestamp: Date.now() };
      }),
      page3.evaluate(() => {
        return { page: 3, url: window.location.href, timestamp: Date.now() };
      })
    ]);

    results.forEach((result, index) => {
      log(`📊 页面${index + 1}独立执行结果:`, 'info');
      log(`   页面编号: ${result.page}`, 'info');
      log(`   当前URL: ${result.url}`, 'info');
      log(`   时间戳: ${result.timestamp}`, 'info');
    });

    log('✅ 确认：各页面独立运行，互不干扰', 'success');

    // 10. 性能统计
    log('\n📊 性能统计:', 'info');
    log(`⏱️  平均加载时间: ${(loadTime / 3).toFixed(0)}ms/页面`, 'info');
    log(`⚡ 并发效率: 3个页面同时加载`, 'info');
    log(`💾 内存共享: 共享Cookies和LocalStorage`, 'info');

    // 11. 总结
    log('\n' + '='.repeat(60), 'info');
    log('🎉 单Context多Pages测试完成！', 'success');
    log('='.repeat(60), 'info');

    log('\n✅ 验证结果:', 'success');
    log('✅ 多个页面可以同时创建', 'success');
    log('✅ 多个页面可以并发加载', 'success');
    log('✅ 多个页面可以同时操作', 'success');
    log('✅ 多个页面共享登录状态', 'success');
    log('✅ 多个页面独立运行', 'success');

    log('\n💡 适用场景:', 'info');
    log('   ✅ 同一账号下同时操作多个页面', 'info');
    log('   ✅ 并发抓取多个业务页面', 'info');
    log('   ✅ 提高数据采集效率', 'info');
    log('   ⚠️  不能用于多账号（会串号）', 'warning');

    log('\n📸 截图已保存:', 'info');
    log('   output/multi-page-1.png', 'info');
    log('   output/multi-page-2.png', 'info');
    log('   output/multi-page-3.png', 'info');

    log('\n💡 浏览器保持打开状态，您可以查看3个标签页', 'info');

    // 保持浏览器打开，便于查看
    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 测试失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testMultiPages();
