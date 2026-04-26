import { launchPersistent, getPageFromContext, log, sleep } from './utils';

async function debugGemini() {
  log('🔍 调试 Gemini 页面结构', 'info');

  const context = await launchPersistent();
  const page = await getPageFromContext(context);

  await page.goto('https://gemini.google.com/app', {
    timeout: 30000,
    waitUntil: 'domcontentloaded'
  });

  await sleep(5000);

  // 调试页面结构
  const debugInfo = await page.evaluate(() => {
    const result: any = {
      buttons: [],
      textareas: [],
      fileInputs: [],
      uploadButtons: []
    };

    // 查找所有按钮
    document.querySelectorAll('button').forEach((btn, index) => {
      const text = btn.textContent?.trim();
      const ariaLabel = btn.getAttribute('aria-label');
      const className = btn.className;

      if (text || ariaLabel) {
        result.buttons.push({
          index,
          text: text?.substring(0, 50),
          ariaLabel,
          className: className?.substring(0, 100)
        });
      }
    });

    // 查找文件输入
    document.querySelectorAll('input[type="file"]').forEach((input, index) => {
      result.fileInputs.push({
        index,
        accept: input.getAttribute('accept'),
        multiple: input.getAttribute('multiple'),
        id: input.id,
        name: input.name
      });
    });

    // 查找文本输入框
    document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]').forEach((el, index) => {
      const placeholder = el.getAttribute('placeholder');
      const ariaLabel = el.getAttribute('aria-label');
      const className = el.className;

      result.textareas.push({
        index,
        tagName: el.tagName,
        placeholder,
        ariaLabel,
        className: className?.substring(0, 100)
      });
    });

    return result;
  });

  log('\n📊 页面调试信息:', 'info');

  log('\n🔘 按钮 (前20个):', 'info');
  debugInfo.buttons.slice(0, 20).forEach((btn: any) => {
    log(`  [${btn.index}] text="${btn.text}" ariaLabel="${btn.ariaLabel}"`, 'info');
  });

  log('\n📁 文件输入框:', 'info');
  if (debugInfo.fileInputs.length > 0) {
    debugInfo.fileInputs.forEach((input: any) => {
      log(`  [${input.index}] accept="${input.accept}" multiple=${input.multiple}`, 'info');
    });
  } else {
    log('  未找到文件输入框', 'info');
  }

  log('\n✍️  文本输入框:', 'info');
  debugInfo.textareas.slice(0, 10).forEach((input: any) => {
    log(`  [${input.index}] ${input.tagName} ariaLabel="${input.ariaLabel}"`, 'info');
  });

  // 尝试找到上传按钮并点击
  log('\n🔍 尝试查找上传按钮...', 'info');

  try {
    // 尝试多种选择器
    const uploadSelectors = [
      'button[aria-label*="upload"]',
      'button[aria-label*="Upload"]',
      'button:has-text("upload")',
      'button:has-text("Upload")',
      'button:has(svg)',
      '.mat-mdc-button'
    ];

    for (const selector of uploadSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        log(`  找到 ${count} 个元素: ${selector}`, 'success');

        // 获取前几个的详情
        for (let i = 0; i < Math.min(count, 5); i++) {
          const btn = page.locator(selector).nth(i);
          const text = await btn.textContent();
          const ariaLabel = await btn.getAttribute('aria-label');
          log(`    [${i}] text="${text}" ariaLabel="${ariaLabel}"`, 'info');
        }
      }
    }
  } catch (error) {
    log('  查找失败: ' + (error as Error).message, 'error');
  }

  log('\n💡 浏览器保持打开，请手动检查页面', 'info');

  await new Promise(() => {});
}

debugGemini();
