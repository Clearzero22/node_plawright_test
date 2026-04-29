import { chromium } from 'playwright';
import path from 'path';
import os from 'os';

/**
 * 使用统一配置目录进行 Google 登录
 *
 * ⚠️  注意：这个脚本默认使用统一的automation目录与其他脚本共享登录状态
 * ✅ 优点：与其他Gemini脚本共享登录状态，只需登录一次
 * ⚠️  如需使用真实Chrome配置，需要关闭现有的 Chrome 实例
 */
(async () => {
  console.log('🚀 启动 Gemini (使用统一配置)...');

  // 使用统一的automation目录与其他脚本共享登录状态
  const userDataDir = path.join(
    os.homedir(),
    '.node-plawright-test',
    'chrome-profile',
    'automation'
  );

  // 如果确实需要使用真实Chrome配置，取消下面这行的注释并关闭Chrome
  // const userDataDir = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');

  console.log(`📁 使用配置文件: ${userDataDir}`);
  console.log('');
  console.log('✅ 此配置与其他Gemini脚本共享，只需登录一次');
  console.log('');
  console.log('等待 3 秒...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: 'chrome', // 使用系统安装的 Chrome
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--start-maximized',
      ],
      viewport: null,
      // 不使用任何反自动化脚本，因为这是真实的 Chrome
    });

    const page = context.pages()[0] || await context.newPage();

    console.log('🌐 访问 Gemini...');

    // 直接访问 Gemini，如果已经登录会直接进入
    await page.goto('https://gemini.google.com/app', {
      waitUntil: 'networkidle',
    });

    console.log('✅ Gemini 已打开！');
    console.log('');
    console.log('💡 提示：');
    console.log('   - 如果已经登录，会直接进入 Gemini');
    console.log('   - 如果未登录，请手动登录一次');
    console.log('   - 登录状态会与其他Gemini脚本共享');
    console.log('');
    console.log('💡 按 Ctrl+C 退出');

    // 保持浏览器打开
    await new Promise(() => {});

  } catch (error: any) {
    console.error('❌ 启动失败：', error.message);
    console.log('');
    console.log('可能的原因：');
    console.log('1. 如果使用真实Chrome配置 - Chrome 浏览器正在运行，请完全退出 Chrome');
    console.log('2. 配置文件路径不正确');
    console.log('3. Chrome 版本不兼容');
    process.exit(1);
  }
})();
