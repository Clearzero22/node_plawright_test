import { launchPersistent, getPageFromContext, log, sleep } from './utils';
import * as path from 'path';

/**
 * ChatGPT 上传文件并发送消息测试
 *
 * 功能：
 * 1. 访问 ChatGPT
 * 2. 点击附件按钮
 * 3. 上传图片文件
 * 4. 输入文本消息
 * 5. 点击发送
 */

async function testChatGPTUpload() {
  log('='.repeat(60), 'info');
  log('🚀 ChatGPT 文件上传测试', 'info');
  log('='.repeat(60), 'info');

  try {
    // 1. 启动浏览器
    const context = await launchPersistent();
    log('✅ 浏览器已启动', 'success');

    const page = await getPageFromContext(context);

    // 2. 访问 ChatGPT
    log('\n🌐 访问 ChatGPT...', 'info');
    await page.goto('https://chatgpt.com/', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    log('✅ 页面加载完成', 'success');
    await sleep(3000);

    // 3. 直接上传文件（不需要点击按钮）
    log('\n📤 直接上传文件...', 'info');

    const imagePath = path.join(__dirname, '../../logo_script/logo.png');

    try {
      // 方法1：找到隐藏的文件输入框并直接设置文件
      const fileInput = page.locator('input[type="file"]');
      const count = await fileInput.count();

      if (count > 0) {
        await fileInput.first().setInputFiles(imagePath);
        log(`✅ 文件已通过隐藏输入框上传: ${imagePath}`, 'success');
      } else {
        // 方法2：使用FileChooser事件
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          page.getByTestId('composer-plus-btn').click()
        ]);
        await fileChooser.setFiles(imagePath);
        log(`✅ 文件已通过FileChooser上传: ${imagePath}`, 'success');
      }

      await sleep(2000);
    } catch (error) {
      log('❌ 文件上传失败: ' + (error as Error).message, 'error');
    }

    // 4. 点击文本输入区域
    log('\n✍️  点击文本输入区域...', 'info');

    try {
      const textbox = page.getByRole('textbox', { name: 'Chat with ChatGPT' });
      await textbox.click();
      log('✅ 已点击输入区域', 'success');
      await sleep(500);
    } catch (error) {
      log('⚠️  点击输入区域失败，尝试直接输入', 'warning');
    }

    // 5. 输入文本消息
    log('\n💬 输入消息...', 'info');

    try {
      const textbox = page.getByRole('textbox', { name: 'Chat with ChatGPT' });
      await textbox.fill('这个是什么呢');
      log('✅ 消息已输入', 'success');
      await sleep(1000);
    } catch (error) {
      log('❌ 输入消息失败: ' + (error as Error).message, 'error');
    }

    // 6. 点击发送按钮
    log('\n📤 点击发送按钮...', 'info');

    try {
      const sendButton = page.getByTestId('send-button');
      await sendButton.click();
      log('✅ 消息已发送', 'success');
    } catch (error) {
      log('❌ 发送失败: ' + (error as Error).message, 'error');
    }

    // 10. 完成
    log('\n' + '='.repeat(60), 'info');
    log('🎉 测试完成！', 'success');
    log('='.repeat(60), 'info');

    log('\n💡 浏览器保持打开，您可以查看 ChatGPT 的回复', 'info');

    // 保持浏览器打开
    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 测试失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testChatGPTUpload();
