import { launchPersistent, getPageFromContext, log, sleep, screenshot } from './utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GigaB2B 产品数据抓取测试
 *
 * 功能：
 * 1. 访问GigaB2B网站
 * 2. 搜索"Couch"产品
 * 3. 打开指定产品页面
 * 4. 抓取产品图片链接
 * 5. 抓取产品详细信息
 * 6. 保存为JSON文件
 */

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
  log('🚀 GigaB2B 产品数据抓取测试', 'info');
  log('='.repeat(60), 'info');

  try {
    // 1. 启动浏览器
    const context = await launchPersistent();
    log('✅ 浏览器已启动', 'success');

    const page = await getPageFromContext(context);

    // 2. 访问首页
    log('\n🌐 访问 GigaB2B 首页...', 'info');
    await page.goto('https://www.gigab2b.com/index.php', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    log('✅ 首页加载完成', 'success');
    await sleep(2000);

    // 3. 搜索"Couch"产品
    log('\n🔍 搜索 "Couch" 产品...', 'info');

    try {
      // 点击搜索按钮
      const searchButton = page.getByText('Search');
      if (await searchButton.isVisible()) {
        await searchButton.click();
        log('✅ 已点击搜索按钮', 'success');
      }

      await sleep(500);

      // 点击"Couch"选项
      const couchOption = page.getByText('Couch');
      if (await couchOption.isVisible()) {
        await couchOption.click();
        log('✅ 已选择 Couch 产品', 'success');
      }

      await sleep(2000);
    } catch (error) {
      log('⚠️  搜索步骤跳过，直接访问产品页面', 'warning');
    }

    // 4. 打开指定产品页面
    const productUrl = 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431';
    log(`\n📦 打开产品页面: ${productUrl}`, 'info');

    await page.goto(productUrl, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    log('✅ 产品页面加载完成', 'success');
    await sleep(2000);

    // 5. 截图产品页面
    await screenshot(page, 'gigab2b-product-page');
    log('📸 产品页面截图已保存', 'info');

    // 6. 抓取产品数据
    log('\n📊 开始抓取产品数据...', 'info');

    // 先点击Product Info标签获取产品详细信息
    try {
      const productInfoTab = page.locator('#tab-description, [role="tab"]:has-text("Product Info")');
      if (await productInfoTab.isVisible()) {
        await productInfoTab.click();
        log('✅ 已点击Product Info标签', 'success');
        await sleep(2000); // 等待内容加载
      }
    } catch (error) {
      log('⚠️  Product Info标签点击跳过', 'warning');
    }

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

      // 抓取产品标题
      const titleElement = document.querySelector('h1, .product-title, .title, [class*="title"]');
      if (titleElement) {
        data.title = titleElement.textContent?.trim() || '';
      }

      // 抓取价格
      const priceElement = document.querySelector('.price, [class*="price"], .product-price');
      if (priceElement) {
        data.price = priceElement.textContent?.trim() || '';
      }

      // 抓取描述（只获取产品简介，不包含规格信息）
      const descElement = document.querySelector('.product-description, .short-description, [class*="short-desc"]');
      if (descElement) {
        data.description = descElement.textContent?.trim().substring(0, 200) || '';
      } else {
        // 如果没有专门的描述字段，尝试获取产品名称作为描述
        const titleElement = document.querySelector('h1, .product-title, [class*="product-title"]');
        if (titleElement) {
          data.description = titleElement.textContent?.trim() || '';
        }
      }

      // 抓取所有图片链接
      const images: string[] = [];

      // 从img标签抓取（优先产品图片）
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || (img as any).dataset.original;
        // 过滤掉小图标和非产品图片
        if (src && !src.includes('HDFlags') && !src.includes('icon') && !src.includes('logo')) {
          if (src.includes('image') || src.includes('product') || src.includes('b2bfiles')) {
            if (!images.includes(src)) {
              images.push(src);
            }
          }
        }
      });

      // 从图库容器抓取
      document.querySelectorAll('.el-image.image-item, .image-item, [class*="image"]').forEach(item => {
        const img = item.querySelector('img');
        if (img) {
          const src = img.src || img.dataset.src || (img as any).dataset.original;
          if (src && !images.includes(src)) {
            images.push(src);
          }
        }
      });

      data.images = images;

      // 抓取规格信息（从Product Info标签页）- 针对GigaB2B的具体结构
      const productInfoPane = document.querySelector('#pane-description, [role="tabpanel"], [aria-labelledby*="description"]');
      if (productInfoPane) {
        // 专门针对GigaB2B的规格信息抓取
        // 抓取所有.items容器中的键值对
        const itemContainers = productInfoPane.querySelectorAll('.items');
        itemContainers.forEach(container => {
          const spans = container.querySelectorAll('span');
          if (spans.length >= 2) {
            const labelSpan = spans[0];
            const valueSpan = spans[1];

            let key = labelSpan.textContent?.trim();
            let val = valueSpan.textContent?.trim();

            // 清理数据（移除冒号等）
            if (key) {
              key = key.replace(/:$/, '').trim();
            }

            // 严格过滤条件，确保只抓取产品规格数据
            const isValidKey = key && key.length > 2 && key.length < 100 &&
              !key.includes('color-') && !key.includes('size:') &&
              !key.includes('weight:') && !key.includes('text-') &&
              !key.includes('font-') && !key.includes('line-') &&
              !key.includes('margin') && !key.includes('padding');

            const isValidVal = val && val.length > 0 && val.length < 500 &&
              !val.includes('inherit') && !val.includes('400!') &&
              !val.includes('!important') && !val.includes('text-shadow') &&
              !val.includes('font-family') && !val.includes('Helvetica');

            if (isValidKey && isValidVal) {
              // 避免重复
              if (!data.specifications[key]) {
                data.specifications[key] = val;
              }
            }
          }
        });
      }

      return data;
    });

    // 7. 查看和点击图片查看器
    log('\n🖼️  检查产品图片查看器...', 'info');

    try {
      // 尝试点击第一张图片
      const firstImage = page.locator('.el-image.image-item > .el-image__inner').first();
      if (await firstImage.isVisible()) {
        log('✅ 找到产品图片', 'success');
        log(`📊 图片数量: ${productData.images.length}`, 'info');

        // 显示前5个图片链接
        productData.images.slice(0, 5).forEach((img, index) => {
          log(`   图片${index + 1}: ${img}`, 'info');
        });

        // 点击查看大图
        // await firstImage.click();
        await sleep(1000);

        
        // 点击图片查看器遮罩
        const mask = page.locator('.el-image-viewer__mask');
        if (await mask.isVisible()) {
          log('✅ 图片查看器已打开', 'success');
          await mask.click();
          await sleep(500);
        }

        // 截图图片查看器
        await screenshot(page, 'gigab2b-image-viewer');
        log('📸 图片查看器截图已保存', 'info');
      }
    } catch (error) {
      log('⚠️  图片查看器操作跳过', 'warning');
    }

    // 8. 查看产品规格（使用更强大的抓取方法）
    log('\n📋 产品规格信息:', 'info');

    try {
      // 点击Specification标签
      const specTab = page.getByText('Specification');
      if (await specTab.isVisible()) {
        await specTab.click();
        log('✅ 已打开产品规格', 'success');
        await sleep(1000);
      }

      // 展开所有可能的规格项
      const specItems = ['Product Dimensions', 'Package Size', 'Material', 'Color', 'Weight'];
      for (const item of specItems) {
        try {
          const element = page.getByText(item, { exact: false });
          if (await element.isVisible()) {
            await element.click();
            await sleep(300);
            log(`✅ 已展开: ${item}`, 'success');
          }
        } catch (e) {
          // 规格项可能不存在，继续
        }
      }

      // 等待内容加载
      await sleep(2000);

      // 使用更强大的方法抓取规格信息
      const updatedSpecs = await page.evaluate(() => {
        const specs: Record<string, string> = {};

        // 方法1：从表格行抓取
        document.querySelectorAll('table tr, .spec-row, [class*="spec-row"]').forEach(row => {
          const cells = row.querySelectorAll('td, th, [class*="cell"]');
          if (cells.length >= 2) {
            const key = cells[0].textContent?.trim();
            const val = cells[1].textContent?.trim();
            if (key && val && !key.includes('Specification') && !specs[key]) {
              specs[key] = val;
            }
          }
        });

        // 方法2：从描述列表抓取
        document.querySelectorAll('dl dt, .description-list dt').forEach((dt, index, dts) => {
          const key = dt.textContent?.trim();
          const dd = dt.nextElementSibling;
          if (key && dd && dd.tagName === 'DD') {
            const val = dd.textContent?.trim();
            if (val && !specs[key]) {
              specs[key] = val;
            }
          }
        });

        // 方法3：从键值对容器抓取
        document.querySelectorAll('[class*="spec"], [class*="detail"], [class*="info"]').forEach(container => {
          const labels = container.querySelectorAll('[class*="label"], [class*="name"], [class*="key"], dt, label');
          const values = container.querySelectorAll('[class*="value"], [class*="data"], [class*="content"], dd, span');

          labels.forEach((label, index) => {
            const key = label.textContent?.trim();
            const value = values[index];
            if (key && value && !specs[key]) {
              const val = value.textContent?.trim();
              if (val && val !== key) {
                specs[key] = val;
              }
            }
          });
        });

        // 方法4：查找包含常见产品参数模式的文本
        const bodyText = document.body.textContent || '';
        const patterns = [
          /Dimensions[:\s]+([^\n]+)/gi,
          /Size[:\s]+([^\n]+)/gi,
          /Weight[:\s]+([^\n]+)/gi,
          /Material[:\s]+([^\n]+)/gi,
          /Color[:\s]+([^\n]+)/gi,
          /Package[:\s]+([^\n]+)/gi
        ];

        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(bodyText)) !== null) {
            const key = match[0].split(':').slice(0, 2).join(':').trim();
            const val = match[1]?.trim();
            if (key && val && !specs[key]) {
              specs[key] = val;
            }
          }
        });

        return specs;
      });

      // 合并规格信息
      Object.assign(productData.specifications, updatedSpecs);

      // 显示规格信息
      if (Object.keys(productData.specifications).length > 0) {
        log(`✅ 找到 ${Object.keys(productData.specifications).length} 个规格参数:`, 'success');
        Object.entries(productData.specifications).slice(0, 15).forEach(([key, value]) => {
          log(`   ${key}: ${value.substring(0, 80)}`, 'info');
        });
      } else {
        log('⚠️  未找到规格信息，尝试备用方法...', 'warning');

        // 备用方法：直接获取页面所有文本内容
        const pageContent = await page.evaluate(() => {
          return {
            text: document.body.textContent?.substring(0, 5000) || '',
            html: document.body.innerHTML.substring(0, 10000)
          };
        });

        // 保存页面内容用于分析
        const contentPath = 'output/gigab2b-page-content.txt';
        fs.writeFileSync(contentPath, pageContent.text, 'utf-8');
        log(`📄 页面内容已保存: ${contentPath}`, 'info');
        log('💡 您可以查看此文件来分析页面结构', 'info');
      }

      // 最终截图
      await screenshot(page, 'gigab2b-final');
      log('📸 最终截图已保存', 'info');

    } catch (error) {
      log('⚠️  规格信息获取跳过: ' + (error as Error).message, 'warning');
    }

    // 9. 保存数据为JSON
    log('\n💾 保存产品数据...', 'info');

    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const jsonPath = path.join(outputDir, 'gigab2b-product-data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(productData, null, 2), 'utf-8');

    log(`✅ 数据已保存: ${jsonPath}`, 'success');

    // 10. 保存图片链接列表
    const imagesPath = path.join(outputDir, 'gigab2b-image-links.txt');
    const imagesContent = productData.images.join('\n');
    fs.writeFileSync(imagesPath, imagesContent, 'utf-8');

    log(`✅ 图片链接已保存: ${imagesPath}`, 'success');

    // 11. 打印数据摘要
    log('\n' + '='.repeat(60), 'info');
    log('📊 数据抓取摘要', 'info');
    log('='.repeat(60), 'info');
    log(`📦 产品标题: ${productData.title || '(未找到)'}`, 'info');
    log(`💰 价格: ${productData.price || '(未找到)'}`, 'info');
    log(`📝 描述: ${productData.description?.substring(0, 100) || '(未找到)'}...`, 'info');
    log(`🖼️  图片数量: ${productData.images.length}`, 'info');
    log(`📋 规格数量: ${Object.keys(productData.specifications).length}`, 'info');
    log(`🌐 产品URL: ${productData.url}`, 'info');
    log(`⏰ 抓取时间: ${productData.timestamp}`, 'info');

    log('\n' + '='.repeat(60), 'info');
    log('🎉 产品数据抓取完成！', 'success');
    log('='.repeat(60), 'info');

    log('\n💡 提示:', 'info');
    log('   - 产品数据已保存为JSON格式', 'info');
    log('   - 图片链接已保存为TXT格式', 'info');
    log('   - 所有截图已保存到output目录', 'info');
    log('   - 浏览器保持打开，您可以继续操作', 'info');

    // 保持浏览器打开
    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 抓取失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testGigaB2B();
