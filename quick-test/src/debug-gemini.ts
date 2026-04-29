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
  log('\n🔍 查找所有带图标/符号的按钮...', 'info');

  try {
    // 查找所有按钮，特别关注包含 "+" 或 "工具" 旁边的按钮
    const allButtons = await page.evaluate(() => {
      const result: any[] = [];
      const buttons = document.querySelectorAll('button');
      buttons.forEach((btn, index) => {
        const text = btn.textContent?.trim();
        const ariaLabel = btn.getAttribute('aria-label');
        const innerHTML = btn.innerHTML.substring(0, 200);

        // 查找可能的上传按钮（包含+号、或特定文本）
        if (text && (text.includes('+') || text === '工具' || btn.nextElementSibling?.textContent?.includes('工具') || btn.previousElementSibling?.textContent?.includes('工具'))) {
          result.push({
            index,
            text: text?.substring(0, 30),
            ariaLabel,
            innerHTML: innerHTML.substring(0, 100)
          });
        }
      });
      return result;
    });

    if (allButtons.length > 0) {
      log('  找到可能的上传按钮:', 'success');
      allButtons.forEach((btn: any) => {
        log(`    [${btn.index}] text="${btn.text}" ariaLabel="${btn.ariaLabel}"`, 'info');
        log(`           HTML: ${btn.innerHTML.substring(0, 50)}`, 'info');
      });
    } else {
      log('  未找到明确的+号按钮', 'warning');
    }

    // 也查找所有 mat-icon 元素
    const icons = await page.evaluate(() => {
      const result: any[] = [];
      const iconElements = document.querySelectorAll('mat-icon, .mat-icon, [class*="icon"]');
      iconElements.forEach((icon, index) => {
        const text = icon.textContent?.trim();
        if (text === 'add' || text === '+' || text === 'upload' || text === 'attach_file') {
          result.push({
            index,
            text,
            parent: icon.parentElement?.tagName,
            parentText: icon.parentElement?.textContent?.substring(0, 30)
          });
        }
      });
      return result;
    });

    if (icons.length > 0) {
      log('\n  找到相关图标:', 'success');
      icons.forEach((icon: any) => {
        log(`    [${icon.index}] text="${icon.text}" parent=${icon.parent} "${icon.parentText}"`, 'info');
      });
    }
  } catch (error) {
    log('  查找失败: ' + (error as Error).message, 'error');
  }

  // 尝试多种选择器
  log('\n🔍 尝试多种选择器查找上传按钮...', 'info');

  const selectors = [
    'button:has-text("+")',
    'button:has(mat-icon):has-text("add")',
    'button:has(.mat-icon)',
    '[aria-label*="add"]',
    '[aria-label*="upload"]',
    '[aria-label*="attach"]'
  ];

  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    if (count > 0) {
      log(`  找到 ${count} 个: ${selector}`, 'success');
    }
  }

  log('\n💡 浏览器保持打开，请手动检查页面', 'info');

  await new Promise(() => {});
}

debugGemini();
