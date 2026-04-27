import { launchPersistent, getPageFromContext, log, sleep } from './utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Amazon 产品搜索测试
 *
 * 功能：
 * 1. 访问 Amazon 网站
 * 2. 搜索指定关键词
 * 3. 抓取所有产品链接
 * 4. 保存到文件
 */

async function testAmazonSearch() {
  log('='.repeat(60), 'info');
  log('🚀 Amazon 产品搜索测试', 'info');
  log('='.repeat(60), 'info');

  try {
    // 1. 启动浏览器
    const context = await launchPersistent();
    log('✅ 浏览器已启动', 'success');

    const page = await getPageFromContext(context);

    // 2. 访问 Amazon
    log('\n🌐 访问 Amazon...', 'info');
    await page.goto('https://www.amazon.com/', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    log('✅ Amazon 页面加载完成', 'success');
    await sleep(3000);

    // 3. 查找搜索框
    log('\n🔍 查找搜索框...', 'info');

    const searchKeyword = 'Adjustable Bamboo C-Shaped Couch Side Table with Cup Holder & Phone Slot';

    try {
      // Amazon 搜索框的多种可能选择器
      const searchBox = page.locator('#twotabsearchtextbox, #nav-bb-search, input[type="text"][placeholder*="Search"]').first();

      await searchBox.waitFor({ state: 'visible', timeout: 10000 });
      log('✅ 找到搜索框', 'success');

      // 输入搜索关键词
      await searchBox.fill(searchKeyword);
      log(`✅ 已输入搜索关键词: ${searchKeyword}`, 'success');
      await sleep(1000);

      // 按回车键搜索
      await searchBox.press('Enter');
      log('✅ 已执行搜索', 'success');

      // 等待搜索结果页面加载
      await sleep(5000);

    } catch (error) {
      log('❌ 搜索失败: ' + (error as Error).message, 'error');
      process.exit(1);
    }

    // 4. 抓取产品链接
    log('\n📊 开始抓取产品链接...', 'info');

    const productLinks = await page.evaluate(() => {
      const links: string[] = [];
      const seen = new Set<string>();

      // Amazon 产品链接的多种可能选择器
      const selectors = [
        'a[href*="/dp/"]',
        'a[href*="/gp/product/"]',
        'a[href*="/product/"]',
        '[data-component-type="s-search-result"] a',
        '.s-result-item a',
        '[data-asin] a'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const href = (element as HTMLAnchorElement).href;
          if (href) {
            // 提取产品ID（/dp/XXXXX 或 /gp/product/XXXXX）
            const dpMatch = href.match(/\/dp\/([A-Z0-9]{10})/);
            const gpMatch = href.match(/\/gp\/product\/([A-Z0-9]{10})/);

            if (dpMatch) {
              const productId = dpMatch[1];
              const cleanUrl = `https://www.amazon.com/dp/${productId}`;
              if (!seen.has(cleanUrl)) {
                seen.add(cleanUrl);
                links.push(cleanUrl);
              }
            } else if (gpMatch) {
              const productId = gpMatch[1];
              const cleanUrl = `https://www.amazon.com/dp/${productId}`;
              if (!seen.has(cleanUrl)) {
                seen.add(cleanUrl);
                links.push(cleanUrl);
              }
            }
          }
        });
      });

      return links;
    });

    log(`✅ 找到 ${productLinks.length} 个产品链接`, 'success');

    // 5. 显示前10个产品链接
    if (productLinks.length > 0) {
      log('\n📋 前10个产品链接:', 'info');
      productLinks.slice(0, 10).forEach((link, index) => {
        log(`${index + 1}. ${link}`, 'info');
      });

      if (productLinks.length > 10) {
        log(`\n... 还有 ${productLinks.length - 10} 个链接`, 'info');
      }
    }

    // 6. 保存到文件
    log('\n💾 保存产品链接...', 'info');

    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

    // 保存为纯文本文件
    const textPath = path.join(outputDir, `amazon-search-${timestamp}.txt`);
    fs.writeFileSync(textPath, productLinks.join('\n'), 'utf-8');
    log(`✅ 文本文件已保存: ${textPath}`, 'success');

    // 保存为 JSON 文件
    const jsonData = {
      keyword: searchKeyword,
      totalResults: productLinks.length,
      links: productLinks,
      timestamp: new Date().toISOString(),
      url: page.url()
    };

    const jsonPath = path.join(outputDir, `amazon-search-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
    log(`✅ JSON文件已保存: ${jsonPath}`, 'success');

    // 7. 截图搜索结果页面
    const screenshotPath = path.join(outputDir, `amazon-search-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log(`📸 截图已保存: ${screenshotPath}`, 'info');

    // 8. 总结
    log('\n' + '='.repeat(60), 'info');
    log('🎉 搜索完成！', 'success');
    log('='.repeat(60), 'info');

    log('\n📊 搜索统计:', 'info');
    log(`🔍 搜索关键词: ${searchKeyword}`, 'info');
    log(`📦 找到产品: ${productLinks.length} 个`, 'success');
    log(`📄 输出文件: ${textPath}`, 'info');
    log(`📊 JSON文件: ${jsonPath}`, 'info');
    log(`📸 截图文件: ${screenshotPath}`, 'info');

    log('\n💡 浏览器保持打开，您可以查看搜索结果', 'info');

    // 保持浏览器打开
    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 搜索失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testAmazonSearch();
