import { launchPersistent, getPageFromContext, log, sleep, checkLoginStatus, screenshot } from './utils';
import { promises as fs } from 'fs';

interface Site {
  name: string;
  url: string;
  displayName: string;
}

const sites: Site[] = [
  { name: 'chatgpt', url: 'https://chatgpt.com/', displayName: 'ChatGPT' },
  { name: 'seller-sprite-cn', url: 'https://www.sellersprite.com/cn/', displayName: 'Seller Sprite中文' },
  { name: 'seller-sprite-int', url: 'https://www.sellersprite.com/', displayName: 'Seller Sprite国际' },
  { name: 'xiyouzhaoci', url: 'https://www.xiyouzhaoci.com/', displayName: 'xiyouzhaoci' },
  { name: 'bilibili', url: 'https://www.bilibili.com/', displayName: 'Bilibili' },
  { name: 'taobao', url: 'https://www.taobao.com/', displayName: 'Taobao' },
];

interface TestResult {
  site: Site;
  success: boolean;
  title?: string;
  isLoggedIn?: boolean;
  screenshotPath?: string;
  error?: string;
  duration?: number;
}

// 测试单个网站
async function testSite(site: Site): Promise<TestResult> {
  const startTime = Date.now();

  try {
    log(`\n🚀 开始测试 ${site.displayName}...`, 'info');
    log(`📌 URL: ${site.url}`, 'info');

    // 启动持久化浏览器
    const context = await launchPersistent();
    const page = await getPageFromContext(context);

    // 访问网站
    log('📄 正在加载页面...', 'info');
    await page.goto(site.url, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    // 获取页面标题
    const title = await page.title();
    log(`✅ 页面标题: "${title || '(空)'}"`, 'success');

    // 等待页面加载
    await sleep(2000);

    // 检查登录状态
    const isLoggedIn = await checkLoginStatus(page, site.url);
    if (isLoggedIn) {
      log('✅ 登录状态: 已登录', 'success');
    } else {
      log('⚠️  登录状态: 未登录', 'warning');
    }

    // 截图
    const screenshotPath = `output/${site.name}.png`;
    await screenshot(page, site.name);
    log(`📸 截图已保存: ${screenshotPath}`, 'info');

    // 关闭页面和浏览器
    await page.close();
    await context.close();
    log(`✅ ${site.displayName} 浏览器已关闭`, 'info');

    const duration = Date.now() - startTime;
    log(`⏱️  耗时: ${duration}ms`, 'info');

    return {
      site,
      success: true,
      title,
      isLoggedIn,
      screenshotPath,
      duration,
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    log(`❌ ${site.displayName} 测试失败: ${error.message}`, 'error');

    return {
      site,
      success: false,
      error: error.message,
      duration,
    };
  }
}

// 主测试函数（串行执行）
async function testAllSequential() {
  log('='.repeat(60), 'info');
  log('🚀 开始串行测试所有网站...', 'info');
  log('='.repeat(60), 'info');

  // 确保output目录存在
  await fs.mkdir('output', { recursive: true });

  const startTime = Date.now();
  const results: TestResult[] = [];

  // 串行执行所有测试
  for (const site of sites) {
    const result = await testSite(site);
    results.push(result);

    // 等待一下，确保浏览器完全关闭
    await sleep(1000);
  }

  const duration = Date.now() - startTime;

  // 统计结果
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const loggedInCount = results.filter(r => r.isLoggedIn).length;

  // 打印总结
  log('\n' + '='.repeat(60), 'info');
  log('📊 测试结果总结', 'info');
  log('='.repeat(60), 'info');
  log(`⏱️  总耗时: ${duration}ms (${Math.floor(duration / 1000)}秒)`, 'info');
  log(`✅ 成功: ${successCount}/${sites.length}`, successCount === sites.length ? 'success' : 'info');
  log(`❌ 失败: ${failCount}/${sites.length}`, failCount > 0 ? 'error' : 'info');
  log(`🔐 已登录: ${loggedInCount}/${sites.length}`, loggedInCount > 0 ? 'success' : 'warning');

  // 详细结果
  log('\n📋 详细结果:', 'info');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const loginStatus = result.isLoggedIn ? '已登录' : '未登录';
    const time = result.duration ? `${result.duration}ms` : 'N/A';

    log(`${status} ${result.site.displayName} (${time})`, result.success ? 'success' : 'error');
    log(`   标题: "${result.title || '(无)'}"`, 'info');
    log(`   登录: ${loginStatus}`, result.isLoggedIn ? 'success' : 'warning');
    if (result.error) {
      log(`   错误: ${result.error}`, 'error');
    }
    if (result.screenshotPath) {
      log(`   截图: ${result.screenshotPath}`, 'info');
    }

    if (index < results.length - 1) {
      log('', 'info');
    }
  });

  // 保存结果到JSON
  const resultPath = 'output/test-results.json';
  await fs.writeFile(resultPath, JSON.stringify(results, null, 2));
  log(`\n📁 测试结果已保存到: ${resultPath}`, 'info');

  // 返回退出码
  const exitCode = failCount > 0 ? 1 : 0;
  log(`\n${exitCode === 0 ? '🎉 所有测试通过！' : '⚠️  部分测试失败！'}`, exitCode === 0 ? 'success' : 'warning');

  process.exit(exitCode);
}

// 运行测试
testAllSequential();
