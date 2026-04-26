import { launchPersistent, getPageFromContext, log, sleep } from './utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Gemini 简单测试：输入文本并发送，然后复制回复
 */

async function testGeminiSimple() {
  log('='.repeat(60), 'info');
  log('🚀 Gemini 简单测试', 'info');
  log('='.repeat(60), 'info');

  try {
    const context = await launchPersistent();
    const page = await getPageFromContext(context);

    // 访问 Gemini
    log('\n🌐 访问 Gemini...', 'info');
    await page.goto('https://gemini.google.com/app', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    log('✅ 页面加载完成', 'success');
    await sleep(3000);

    // 输入文本
    log('\n✍️  输入文本...', 'info');
    const prompt = '带我飞飞飞';

    try {
      // 使用找到的 DIV 输入框
      const textbox = page.getByRole('textbox', { name: '为 Gemini 输入提示' });
      await textbox.click();
      await sleep(500);
      await textbox.fill(prompt);
      log(`✅ 文本已输入: ${prompt}`, 'success');
      await sleep(1000);

      // 使用回车键发送消息
      log('\n📤 按回车键发送...', 'info');
      await textbox.press('Enter');
      log('✅ 消息已发送', 'success');
    } catch (error) {
      log('❌ 发送失败: ' + (error as Error).message, 'error');
    }

    // 等待回复
    log('\n⏳ 等待回复...', 'info');

    try {
      await page.waitForSelector('[data-test-id="copy-button"], .response-content', {
        timeout: 60000
      });
      log('✅ 收到回复', 'success');
      await sleep(3000);
    } catch (error) {
      log('⚠️  等待超时', 'warning');
    }

    // 复制回复
    log('\n📋 复制回复...', 'info');

    let responseText = '';

    try {
      const copyButton = page.locator('[data-test-id="copy-button"]').first();
      if (await copyButton.isVisible({ timeout: 5000 })) {
        await copyButton.click();
        log('✅ 已点击复制按钮', 'success');
        await sleep(500);

        // 从剪贴板读取
        responseText = await page.evaluate(async () => {
          return await navigator.clipboard.readText();
        });
        log('✅ 已从剪贴板获取内容', 'success');
      }
    } catch (error) {
      log('⚠️  剪贴板读取失败，直接抓取内容', 'warning');
    }

    // 如果剪贴板失败，直接抓取页面内容
    if (!responseText) {
      responseText = await page.evaluate(() => {
        const selectors = [
          '[data-test-id="model-verbose-text"]',
          '.response-content',
          '.model-response',
          '.markdown'
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const text = element.textContent.trim();
            if (text.length > 50) {
              return text;
            }
          }
        }
        return '';
      });
    }

    // 保存内容
    if (responseText) {
      log('\n💾 保存内容...', 'info');

      const outputDir = 'output';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const textPath = path.join(outputDir, `gemini-response-${timestamp}.txt`);

      fs.writeFileSync(textPath, responseText, 'utf-8');
      log(`✅ 已保存: ${textPath}`, 'success');

      log('\n📄 回复预览:', 'info');
      log(responseText.substring(0, 300) + '...', 'info');
    }

    log('\n' + '='.repeat(60), 'info');
    log('🎉 测试完成！', 'success');
    log('='.repeat(60), 'info');

    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testGeminiSimple();
