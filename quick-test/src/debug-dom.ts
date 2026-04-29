import { launchPersistent, getPageFromContext, log, sleep } from './utils';

async function debugDOM() {
  log('🔍 调试 GigaB2B 页面结构', 'info');

  const context = await launchPersistent();
  const page = await getPageFromContext(context);

  const productUrl = 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431';
  await page.goto(productUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });

  await sleep(2000);

  // 点击 Product Info 标签
  try {
    const productInfoTab = page.locator('#tab-description, [role="tab"]:has-text("Product Info")');
    await productInfoTab.click();
    log('✅ 已点击Product Info标签', 'success');
    await sleep(3000);
  } catch (error) {
    log('⚠️ Product Info标签点击失败', 'warning');
  }

  // 调试：打印 Product Info 面板的 HTML 结构
  const debugInfo = await page.evaluate(() => {
    const result: any = {
      paneExists: false,
      paneHTML: '',
      itemsContainers: [],
      allItems: [],
      tabs: []
    };

    // 检查面板是否存在
    const pane = document.querySelector('#pane-description');
    result.paneExists = !!pane;
    if (pane) {
      result.paneHTML = pane.innerHTML.substring(0, 2000);
    }

    // 查找所有 .items 容器
    const allItemsContainers = document.querySelectorAll('.items');
    result.itemsContainers = Array.from(allItemsContainers).slice(0, 10).map(item => ({
      html: item.outerHTML.substring(0, 300),
      parent: item.parentElement?.className,
      grandParent: item.parentElement?.parentElement?.className
    }));

    // 直接在面板内查找
    if (pane) {
      const paneItems = pane.querySelectorAll('.items');
      result.allItems = Array.from(paneItems).map(item => ({
        html: item.outerHTML.substring(0, 300),
        text: item.textContent?.trim()
      }));
    }

    // 查找所有标签
    document.querySelectorAll('[role="tab"]').forEach(tab => {
      result.tabs.push({
        text: tab.textContent?.trim(),
        id: tab.id,
        ariaControls: (tab as any).getAttribute('aria-controls')
      });
    });

    return result;
  });

  log('\n📊 调试信息:', 'info');
  log(`面板存在: ${debugInfo.paneExists}`, 'info');
  log(`标签页数量: ${debugInfo.tabs.length}`, 'info');

  debugInfo.tabs.forEach((tab: any) => {
    log(`  - ${tab.text} (${tab.id}) -> ${tab.ariaControls}`, 'info');
  });

  log(`\n.items 容器总数: ${debugInfo.itemsContainers.length}`, 'info');
  log(`面板内的 .items: ${debugInfo.allItems.length}`, 'info');

  if (debugInfo.allItems.length > 0) {
    log('\n前5个面板内的 .items 内容:', 'info');
    debugInfo.allItems.slice(0, 5).forEach((item: any, index: number) => {
      log(`${index + 1}. ${item.text}`, 'info');
    });
  }

  if (debugInfo.paneExists) {
    log('\n📄 面板 HTML (前2000字符):', 'info');
    console.log(debugInfo.paneHTML);
  }

  await new Promise(() => {});
}

debugDOM();
