import { chromium } from 'playwright';
import path from 'path';
import os from 'os';

async function testGeminiSimple() {
  console.log('🚀 启动 Gemini (简单模式)...');
  
  // 使用统一的用户数据目录（所有Gemini脚本共享）
  const userDataDir = path.join(os.homedir(), '.node-plawright-test', 'chrome-profile', 'automation');
  
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const page = context.pages()[0] || await context.newPage();
  
  console.log('🌐 访问 Gemini...');
  await page.goto('https://gemini.google.com/app');
  
  console.log('✅ Gemini 已打开！');
  console.log('💡 浏览器将保持打开，您可以手动测试文件上传功能');
  console.log('💡 按 Ctrl+C 退出');
  
  // 保持浏览器打开
  await new Promise(() => {});
}

testGeminiSimple().catch(console.error);
