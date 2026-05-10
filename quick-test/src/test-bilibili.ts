import { launchPersistent, getPageFromContext, log, sleep, checkLoginStatus, screenshot } from './utils';

async function test() {
  log('🚀 开始测试 Bilibili...', 'info');

  try {
    // 使用Playwright持久化模式启动（与Electron应用保持一致）
    const context = await launchPersistent();
    log('✅ 浏览器已启动（持久化模式）', 'success');

    // 获取页面
    const page = await getPageFromContext(context);

    // 访问网站
    log('🌐 正在打开 https://www.bilibili.com/...', 'info');
    await page.goto('https://www.bilibili.com/', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    // 获取页面标题
    const title = await page.title();
    log('📄 页面标题: ' + (title || '(空)'), 'info');

    // 等待页面加载
    await sleep(2000);

    // 检查登录状态
    const isLoggedIn = await checkLoginStatus(page, 'https://www.bilibili.com/');
    if (isLoggedIn) {
      log('✅ 登录状态: 已登录', 'success');
    } else {
      log('⚠️  登录状态: 未登录', 'warning');
    }

    // 截图
    await screenshot(page, 'bilibili');
    log('📸 截图已保存: output/bilibili.png', 'info');

    // 成功
    log('✅ Bilibili 测试完成！', 'success');
    log('💡 浏览器保持打开状态，您可以继续操作', 'info');
    log('💡 登录数据会自动保存，下次运行会自动加载', 'info');

    // 保持浏览器打开
    await new Promise(() => {});

  } catch (error: any) {
    log('❌ 测试失败: ' + error.message, 'error');
    process.exit(1);
  }
}

test();
