import { launchPersistent, getPageFromContext, log, sleep } from './utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Gemini 文件上传测试
 *
 * 功能：
 * 1. 访问 Gemini
 * 2. 上传文件
 * 3. 输入提示词
 * 4. 发送消息
 * 5. 保存回复
 */

async function testGeminiFileUpload() {
  log('='.repeat(60), 'info');
  log('🚀 Gemini 文件上传测试', 'info');
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
    await sleep(5000); // 增加等待时间，确保页面完全加载

    // 上传文件
    log('\n📤 上传文件...', 'info');

    const imagePath = path.join(__dirname, '../../logo_script/logo.png');
    let fileUploaded = false;

    try {
      // 使用精确的 CSS 选择器定位+号按钮
      log('查找上传按钮...', 'info');

      const uploadButton = page.locator('uploader >> button >> .mat-mdc-button-touch-target');

      await uploadButton.waitFor({ state: 'visible', timeout: 10000 });
      log('✅ 找到上传按钮', 'success');

      // 点击触发文件选择
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        uploadButton.click()
      ]);

      await fileChooser.setFiles(imagePath);
      log(`✅ 文件已上传: ${imagePath}`, 'success');
      fileUploaded = true;
      await sleep(2000);

    } catch (error) {
      log('上传失败: ' + (error as Error).message, 'warning');
    }

    // 方法2：如果方法1失败，尝试直接点击可能的上传按钮
    if (!fileUploaded) {
      try {
        log('尝试方法2：查找上传按钮...', 'info');

        // 查找所有可能的文件上传触发器
        const uploadSelectors = [
          'button:has-text("Open upload file menu")',
          'button:has(svg):has-text("")',  // 有SVG的按钮（通常是上传图标）
          '.mat-mdc-button:has(.mat-mdc-button-touch-target)'
        ];

        for (const selector of uploadSelectors) {
          const count = await page.locator(selector).count();
          if (count > 0) {
            log(`找到 ${count} 个匹配元素: ${selector}`, 'info');

            // 尝试点击并触发文件选择
            try {
              const [fileChooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 5000 }),
                page.locator(selector).first().click()
              ]);

              await fileChooser.setFiles(imagePath);
              log(`✅ 文件已上传: ${imagePath}`, 'success');
              fileUploaded = true;
              await sleep(2000);
              break;
            } catch (e) {
              // 继续尝试下一个选择器
            }
          }
        }
      } catch (error) {
        log('方法2失败: ' + (error as Error).message, 'warning');
      }
    }

    // 输入文本
    log('\n✍️  输入文本...', 'info');
    const prompt = '这个是什么？';

    try {
      const textbox = page.getByRole('textbox', { name: '为 Gemini 输入提示' });
      await textbox.click();
      await sleep(500);
      await textbox.fill(prompt);
      log(`✅ 文本已输入: ${prompt}`, 'success');
      await sleep(1000);

      // 使用回车键发送
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

    // 复制并保存回复
    log('\n📋 复制回复...', 'info');

    let responseText = '';

    try {
      const copyButton = page.locator('[data-test-id="copy-button"]').first();
      if (await copyButton.isVisible({ timeout: 5000 })) {
        await copyButton.click();
        await sleep(500);

        responseText = await page.evaluate(async () => {
          return await navigator.clipboard.readText();
        });
        log('✅ 已从剪贴板获取内容', 'success');
      }
    } catch (error) {
      log('剪贴板读取失败，直接抓取内容', 'warning');
    }

    if (!responseText) {
      responseText = await page.evaluate(() => {
        const selectors = [
          '[data-test-id="model-verbose-text"]',
          '.response-content',
          '.model-response'
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
      const jsonPath = path.join(outputDir, `gemini-upload-${timestamp}.json`);

      const jsonData = {
        prompt: prompt,
        response: responseText,
        fileUploaded: fileUploaded,
        filePath: fileUploaded ? imagePath : null,
        timestamp: new Date().toISOString()
      };

      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
      log(`✅ 已保存: ${jsonPath}`, 'success');

      log('\n📄 回复预览:', 'info');
      log(responseText.substring(0, 200) + '...', 'info');
    }

    log('\n' + '='.repeat(60), 'info');
    log('🎉 测试完成！', 'success');
    log(`📁 文件上传: ${fileUploaded ? '成功' : '失败'}`, 'info');
    log('='.repeat(60), 'info');

    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testGeminiFileUpload();
