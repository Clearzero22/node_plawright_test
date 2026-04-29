import fs from 'fs';
import path from 'path';

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

// 使用Playwright持久化模式的模板（参考main/index.ts）
const template = (site: Site) => `import { launchPersistent, getPageFromContext, log, sleep, checkLoginStatus, screenshot } from './utils';

async function test() {
  log('🚀 开始测试 ${site.displayName}...', 'info');

  try {
    // 使用Playwright持久化模式启动（与Electron应用保持一致）
    const context = await launchPersistent();
    log('✅ 浏览器已启动（持久化模式）', 'success');

    // 获取页面
    const page = await getPageFromContext(context);

    // 访问网站
    log('🌐 正在打开 ${site.url}...', 'info');
    await page.goto('${site.url}', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    // 获取页面标题
    const title = await page.title();
    log('📄 页面标题: ' + (title || '(空)'), 'info');

    // 等待页面加载
    await sleep(2000);

    // 检查登录状态
    const isLoggedIn = await checkLoginStatus(page, '${site.url}');
    if (isLoggedIn) {
      log('✅ 登录状态: 已登录', 'success');
    } else {
      log('⚠️  登录状态: 未登录', 'warning');
    }

    // 截图
    await screenshot(page, '${site.name}');
    log('📸 截图已保存: output/${site.name}.png', 'info');

    // 成功
    log('✅ ${site.displayName} 测试完成！', 'success');
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
`;

// 生成所有测试脚本
sites.forEach(site => {
  const content = template(site);
  const filename = `test-${site.name}.ts`;
  const filepath = path.join(__dirname, filename);

  fs.writeFileSync(filepath, content);
  console.log(`✅ Created: ${filename}`);
});

console.log('\n🎉 所有测试脚本生成完成！');
console.log('📝 使用Playwright持久化模式（与Electron应用一致）');
console.log('📝 运行方式:');
console.log('   npm run test:chatgpt');
console.log('   npm run test:seller-cn');
console.log('   npx tsx src/test-chatgpt.ts');
console.log('\n💡 提示：');
console.log('   - 用户数据目录: ~/AppData/Roaming/node_plawright_test/chromium-profile');
console.log('   - 首次运行需要手动登录，登录后会自动保存');
console.log('   - 与Electron应用共享相同的用户数据');
