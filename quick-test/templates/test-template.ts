import { launchPersistent, getPageFromContext, log, sleep, checkLoginStatus, screenshot } from './utils';

/**
 * 测试模板
 *
 * 使用说明：
 * 1. 复制此文件到 src/test-your-feature.ts
 * 2. 替换 FEATURE_NAME 为你的功能名称
 * 3. 替换 URL 为目标网站URL
 * 4. 根据需要添加自定义逻辑
 */

const FEATURE_NAME = 'your-feature';
const URL = 'https://example.com';

async function test() {
  log('🚀 开始测试...', 'info');

  try {
    // 1. 启动浏览器（持久化模式）
    const context = await launchPersistent();
    log('✅ 浏览器已启动（持久化模式）', 'success');

    // 2. 获取页面
    const page = await getPageFromContext(context);

    // 3. 访问网站
    log(`🌐 正在打开 ${URL}...`, 'info');
    await page.goto(URL, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    // 4. 获取页面标题
    const title = await page.title();
    log(`📄 页面标题: "${title || '(空)'}"`, 'info');

    // 5. 等待页面完全加载
    await sleep(2000);

    // 6. 检查登录状态
    const isLoggedIn = await checkLoginStatus(page, URL);
    if (isLoggedIn) {
      log('✅ 登录状态: 已登录', 'success');
    } else {
      log('⚠️  登录状态: 未登录', 'warning');
    }

    // 7. 截图保存
    await screenshot(page, FEATURE_NAME);
    log(`📸 截图已保存: output/${FEATURE_NAME}.png`, 'info');

    // 8. 成功
    log('✅ 测试完成！', 'success');
    log('💡 浏览器保持打开状态，您可以继续操作', 'info');
    log('💡 登录数据会自动保存，下次运行会自动加载', 'info');

    // 保持浏览器打开（用于手动操作）
    await new Promise(() => {});

  } catch (error: any) {
    log('❌ 测试失败: ' + error.message, 'error');
    process.exit(1);
  }
}

test();
