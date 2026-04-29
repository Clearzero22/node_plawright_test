import { launchPersistent, getPageFromContext, log, sleep } from './utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Gemini 文件上传和内容复制测试
 *
 * 功能：
 * 1. 访问 Gemini
 * 2. 上传文件/图片
 * 3. 输入提示词
 * 4. 发送消息
 * 5. 等待回复
 * 6. 复制回复内容
 * 7. 保存到文件
 */

async function testGeminiUpload() {
  log('='.repeat(60), 'info');
  log('🚀 Gemini 文件上传和内容复制测试', 'info');
  log('='.repeat(60), 'info');

  try {
    // 1. 启动浏览器
    const context = await launchPersistent();
    log('✅ 浏览器已启动', 'success');

    const page = await getPageFromContext(context);

    // 2. 访问 Gemini
    log('\n🌐 访问 Gemini...', 'info');
    await page.goto('https://gemini.google.com/app', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    log('✅ 页面加载完成', 'success');
    await sleep(3000);

    // 3. 上传文件
    log('\n📤 上传文件...', 'info');

    const imagePath = path.join(__dirname, '../../logo_script/logo.png');
    let fileUploaded = false;

    try {
      // 点击上传按钮然后选择文件
      log('点击上传按钮...', 'info');

      const uploadButton = page.getByRole('button', { name: 'Open upload file menu' });
      await uploadButton.waitFor({ state: 'visible', timeout: 5000 });
      await uploadButton.click();
      await sleep(500);

      const fileChooser = await page.waitForEvent('filechooser', { timeout: 10000 });
      await fileChooser.setFiles(imagePath);
      log(`✅ 文件已上传: ${imagePath}`, 'success');
      fileUploaded = true;
      await sleep(2000);
    } catch (error) {
      log('⚠️  文件上传失败，继续文本测试: ' + (error as Error).message, 'warning');
    }

    // 4. 点击输入框
    log('\n✍️  点击输入框...', 'info');

    try {
      const textbox = page.getByRole('textbox', { name: 'Enter a prompt for Gemini' });
      const paragraph = textbox.getByRole('paragraph');

      await paragraph.click();
      await paragraph.click();
      await paragraph.click();
      log('✅ 已点击输入框', 'success');
      await sleep(500);
    } catch (error) {
      log('⚠️  点击输入框失败，尝试直接输入', 'warning');
    }

    // 5. 输入提示词
    log('\n💬 输入提示词...', 'info');

    const prompt = '带我飞飞飞';

    try {
      const textbox = page.getByRole('textbox', { name: 'Enter a prompt for Gemini' });
      await textbox.fill(prompt);
      log(`✅ 提示词已输入: ${prompt}`, 'success');
      await sleep(1000);
    } catch (error) {
      log('❌ 输入提示词失败: ' + (error as Error).message, 'error');
    }

    // 6. 发送消息
    log('\n📤 发送消息...', 'info');

    try {
      const sendButton = page.getByRole('button', { name: 'Send message' });
      await sendButton.click();
      log('✅ 消息已发送', 'success');
    } catch (error) {
      log('❌ 发送失败: ' + (error as Error).message, 'error');
    }

    // 7. 等待回复
    log('\n⏳ 等待 Gemini 回复...', 'info');

    // 等待回复出现（最多等待60秒）
    try {
      await page.waitForSelector('[data-test-id="copy-button"], [data-test-id="model-verbose-text"], .response-content', {
        timeout: 60000
      });
      log('✅ 收到回复', 'success');
      await sleep(3000); // 额外等待确保完整内容加载
    } catch (error) {
      log('⚠️  等待回复超时，尝试继续...', 'warning');
    }

    // 8. 复制回复内容
    log('\n📋 复制回复内容...', 'info');

    let responseText = '';

    try {
      // 方法1：点击复制按钮
      const copyButton = page.locator('[data-test-id="copy-button"]').first();

      if (await copyButton.isVisible({ timeout: 5000 })) {
        await copyButton.click();
        log('✅ 已点击复制按钮', 'success');

        // 从剪贴板获取内容
        await sleep(500);
        try {
          const clipboardText = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
          });
          responseText = clipboardText;
          log('✅ 已从剪贴板获取内容', 'success');
        } catch (clipboardError) {
          log('⚠️  无法访问剪贴板，尝试直接抓取内容', 'warning');
        }
      }
    } catch (error) {
      log('⚠️  复制按钮操作失败，尝试直接抓取内容', 'warning');
    }

    // 方法2：如果复制失败，直接从页面抓取文本
    if (!responseText) {
      log('\n📄 直接从页面抓取内容...', 'info');

      try {
        responseText = await page.evaluate(() => {
          // 尝试多种选择器
          const selectors = [
            '[data-test-id="model-verbose-text"]',
            '.response-content',
            '.model-response',
            '[data-test-id="conversation-turn-1"]',
            '.markdown',
            '.prose'
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
              const text = element.textContent.trim();
              if (text.length > 50) { // 确保是有意义的内容
                return text;
              }
            }
          }

          // 备用：查找所有包含较长文本的 div
          const allDivs = document.querySelectorAll('div');
          for (const div of allDivs) {
            const text = div.textContent?.trim() || '';
            if (text.length > 100 && text.length < 10000) {
              // 过滤掉明显不是回复的内容
              if (!text.includes('Enter a prompt') && !text.includes('Gemini')) {
                return text;
              }
            }
          }

          return '';
        });

        if (responseText) {
          log('✅ 已从页面抓取内容', 'success');
        } else {
          log('⚠️  未能抓取到有效内容', 'warning');
        }
      } catch (error) {
        log('❌ 抓取内容失败: ' + (error as Error).message, 'error');
      }
    }

    // 9. 保存内容到文件
    if (responseText) {
      log('\n💾 保存回复内容...', 'info');

      const outputDir = 'output';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const textPath = path.join(outputDir, `gemini-response-${timestamp}.txt`);

      // 保存纯文本
      fs.writeFileSync(textPath, responseText, 'utf-8');
      log(`✅ 文本已保存: ${textPath}`, 'success');

      // 也保存 JSON 格式（包含元数据）
      const jsonData = {
        prompt: prompt,
        response: responseText,
        fileUploaded: fileUploaded,
        filePath: fileUploaded ? imagePath : null,
        timestamp: new Date().toISOString(),
        url: page.url()
      };

      const jsonPath = path.join(outputDir, `gemini-response-${timestamp}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
      log(`✅ JSON已保存: ${jsonPath}`, 'success');

      // 显示内容预览
      log('\n📄 回复内容预览:', 'info');
      const preview = responseText.substring(0, 300);
      log(preview + (responseText.length > 300 ? '...' : ''), 'info');
      log(`\n📊 内容长度: ${responseText.length} 字符`, 'info');
    }

    // 10. 完成
    log('\n' + '='.repeat(60), 'info');
    log('🎉 测试完成！', 'success');
    log('='.repeat(60), 'info');

    log('\n💡 浏览器保持打开，您可以继续查看', 'info');

    // 保持浏览器打开
    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 测试失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testGeminiUpload();
