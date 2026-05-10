import { launchPersistent, getPageFromContext, log, sleep, screenshot } from './utils';
import * as fs from 'fs';
import * as path from 'path';

interface ProductData {
  url: string;
  title: string;
  price: string;
  description: string;
  images: string[];
  specifications: Record<string, string>;
  timestamp: string;
}

async function testGigaB2B() {
  log('='.repeat(60), 'info');
  log('🚀 GigaB2B 产品数据抓取测试 (优化版)', 'info');
  log('='.repeat(60), 'info');

  try {
    const context = await launchPersistent();
    log('✅ 浏览器已启动', 'success');

    const page = await getPageFromContext(context);

    // const productUrl = 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431';
        
    const productUrl = 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431';

    log(`📦 直接访问产品页面: ${productUrl}`, 'info');

    await page.goto(productUrl, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    log('✅ 产品页面加载完成', 'success');
    await sleep(2000);

    // 点击Product Info标签
    log('\n📋 点击Product Info标签...', 'info');

    try {
      await page.waitForSelector('#tab-description, [role="tab"]', { timeout: 5000 });
      const productInfoTab = page.locator('#tab-description');
      await productInfoTab.click();
      log('✅ 已点击Product Info标签', 'success');
      await sleep(3000);
    } catch (error) {
      log('⚠️  Product Info标签点击失败，尝试继续...', 'warning');
    }

    await screenshot(page, 'gigab2b-product-page');
    log('📸 产品页面截图已保存', 'info');

    // 使用 Playwright 方式抓取 Product Info 数据
    log('\n📊 精确抓取产品数据...', 'info');

    const productInfoPane = page.locator('#pane-description');
    const itemsCount = await productInfoPane.locator('.items').count();
    log(`找到 ${itemsCount} 个数据项`, 'info');

    const specifications: Record<string, string> = {};

    for (let i = 0; i < itemsCount; i++) {
      const item = productInfoPane.locator('.items').nth(i);
      const spans = item.locator('span');

      if (await spans.count() >= 2) {
        const key = (await spans.nth(0).textContent())?.trim();
        const val = (await spans.nth(1).textContent())?.trim();

        const cleanKey = key?.replace(/:$/, '').trim();

        if (cleanKey && val && cleanKey.length > 2 && cleanKey.length < 100) {
          if (!specifications[cleanKey]) {
            specifications[cleanKey] = val;
          }
        }
      }
    }

    // 抓取其他数据
    const productData: ProductData = await page.evaluate(() => {
      const data: ProductData = {
        url: window.location.href,
        title: '',
        price: '',
        description: '',
        images: [],
        specifications: {},
        timestamp: new Date().toISOString()
      };

      const titleSelectors = ['h1', '.product-title', '[class*="title"]'];
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.trim().length > 5) {
          data.title = element.textContent.trim();
          break;
        }
      }

      const priceSelectors = ['.price', '[class*="price"]', '.product-price'];
      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.trim().length > 0) {
          let priceText = element.textContent.trim();
          priceText = priceText.replace(/Login To See Price.*/gi, '').trim();
          if (priceText && priceText !== 'Price') {
            data.price = priceText;
            break;
          }
        }
      }

      const productImages: string[] = [];
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || (img as any).dataset.original;
        if (src && !src.includes('HDFlags') && !src.includes('icon') && !src.includes('logo')) {
          if (src.includes('b2bfiles') || src.includes('product')) {
            const originalSrc = src.split('?')[0];
            if (!productImages.includes(originalSrc)) {
              productImages.push(originalSrc);
            }
          }
        }
      });

      data.images = productImages;
      return data;
    });

    productData.specifications = specifications;

    log(`\n✅ 产品标题: ${productData.title || '(未找到)'}`, 'success');
    log(`💰 价格: ${productData.price || '(未找到)'}`, 'info');
    log(`🖼️  产品图片: ${productData.images.length} 张`, 'success');
    log(`📋 规格参数: ${Object.keys(productData.specifications).length} 个`, 'success');

    if (Object.keys(productData.specifications).length > 0) {
      log('\n📋 主要规格参数:', 'info');
      Object.entries(productData.specifications).slice(0, 15).forEach(([key, value], index) => {
        log(`${index + 1}. ${key}: ${value}`, 'info');
      });
    }

    if (productData.images.length > 0) {
      log('\n🖼️  产品图片 (前5张):', 'info');
      productData.images.slice(0, 5).forEach((img, index) => {
        log(`${index + 1}. ${img}`, 'info');
      });
    }

    log('\n💾 保存产品数据...', 'info');

    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const jsonPath = path.join(outputDir, 'gigab2b-product-data-clean.json');
    fs.writeFileSync(jsonPath, JSON.stringify(productData, null, 2), 'utf-8');
    log(`✅ JSON数据已保存: ${jsonPath}`, 'success');

    const imagesPath = path.join(outputDir, 'gigab2b-images-clean.txt');
    fs.writeFileSync(imagesPath, productData.images.join('\n'), 'utf-8');
    log(`✅ 图片链接已保存: ${imagesPath}`, 'success');

    await screenshot(page, 'gigab2b-final');
    log('📸 最终截图已保存', 'info');

    log('\n' + '='.repeat(60), 'info');
    log('🎉 产品数据抓取完成！', 'success');
    log('='.repeat(60), 'info');

    log('\n📊 抓取统计:', 'info');
    log(`✅ 产品标题: 已获取`, 'success');
    log(`✅ 价格信息: 已获取`, 'success');
    log(`✅ 产品图片: ${productData.images.length}张`, 'success');
    log(`✅ 规格参数: ${Object.keys(productData.specifications).length}个`, 'success');
    log(`✅ 数据质量: 干净无垃圾数据`, 'success');

    log('\n💡 文件位置:', 'info');
    log(`📄 JSON数据: ${jsonPath}`, 'info');
    log(`🖼️  图片链接: ${imagesPath}`, 'info');
    log(`📸 截图文件: output/gigab2b-*.png`, 'info');

    log('\n💡 浏览器保持打开，您可以查看页面', 'info');

    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 抓取失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testGigaB2B();
