import { launchPersistent, getPageFromContext, log, sleep } from './utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Amazon 产品详情抓取测试
 *
 * 功能：
 * 1. 访问指定的 Amazon 产品页面
 * 2. 抓取产品标题
 * 3. 抓取五点描述（Bullet Points）
 * 4. 抓取长描述（Product Description）
 * 5. 保存为 JSON 和 TXT 格式
 */

interface ProductDetails {
  url: string;
  asin: string;
  title: string;
  bulletPoints: string[];
  longDescription: string;
  price: string;
  rating: string;
  reviewCount: string;
  images: string[];
  timestamp: string;
}

async function testAmazonProduct() {
  log('='.repeat(60), 'info');
  log('🚀 Amazon 产品详情抓取测试', 'info');
  log('='.repeat(60), 'info');

  try {
    const context = await launchPersistent();
    const page = await getPageFromContext(context);

    // 指定要抓取的产品链接
    const productUrl = 'https://www.amazon.com/dp/B0F281R5RC';

    // 从 URL 中提取 ASIN
    const asinMatch = productUrl.match(/\/dp\/([A-Z0-9]{10})/);
    const asin = asinMatch ? asinMatch[1] : 'Unknown';

    log(`\n📦 产品 ASIN: ${asin}`, 'info');
    log(`🔗 产品链接: ${productUrl}`, 'info');

    // 访问产品页面
    log('\n🌐 访问产品页面...', 'info');
    await page.goto(productUrl, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    log('✅ 产品页面加载完成', 'success');
    await sleep(3000);

    // 抓取产品详细信息
    log('\n📊 开始抓取产品详情...', 'info');

    const productDetails: ProductDetails = await page.evaluate(() => {
      const details: ProductDetails = {
        url: window.location.href,
        asin: '',
        title: '',
        bulletPoints: [],
        longDescription: '',
        price: '',
        rating: '',
        reviewCount: '',
        images: [],
        timestamp: new Date().toISOString()
      };

      // 1. 抓取产品标题
      const titleSelectors = [
        '#productTitle',
        '#title h1',
        'h1.a-size-large',
        '[data-feature-name="title"] h1'
      ];

      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          details.title = element.textContent.trim();
          break;
        }
      }

      // 2. 抓取五点描述（Bullet Points）
      const bulletSelectors = [
        '#feature-bullets ul li',
        '#feature-bullets span.a-list-item',
        '[data-feature-name="bullets"] ul li',
        '#productDetails li'
      ];

      for (const selector of bulletSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 10 && !text.includes('⟵')) {
              // 清理文本
              const cleanText = text.replace(/^[\s•\-–—]+/, '').trim();
              if (cleanText && !details.bulletPoints.includes(cleanText)) {
                details.bulletPoints.push(cleanText);
              }
            }
          });
          if (details.bulletPoints.length >= 3) break;
        }
      }

      // 3. 抓取长描述
      const descriptionSelectors = [
        '#productDescription',
        '#productDescription p',
        '[data-feature-name="productDescription"]',
        '#feature-bullets-above',
        '#aplus',
        '#aplus3p'
      ];

      for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim();
          if (text && text.length > 50) {
            details.longDescription = text;
            break;
          }
        }
      }

      // 如果上面没找到，尝试从 iframe 中获取
      if (!details.longDescription) {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          try {
            const iframeDoc = (iframe as HTMLIFrameElement).contentDocument;
            if (iframeDoc) {
              const text = iframeDoc.body?.textContent?.trim();
              if (text && text.length > 50 && !details.longDescription) {
                details.longDescription = text;
              }
            }
          } catch (e) {
            // 跨域iframe无法访问
          }
        });
      }

      // 4. 抓取价格
      const priceSelectors = [
        '.a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '[data-feature-name="price"] .a-offscreen',
        '.a-price-whole'
      ];

      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          details.price = element.textContent.trim();
          break;
        }
      }

      // 5. 抓取评分
      const ratingSelector = '[data-hook="average-star-rating"] .a-icon-alt, .a-icon-alt';
      const ratingElement = document.querySelector(ratingSelector);
      if (ratingElement) {
        const ratingText = ratingElement.textContent?.trim();
        if (ratingText) {
          details.rating = ratingText.split(' ')[0];
        }
      }

      // 6. 抓取评论数
      const reviewCountSelector = '[data-hook="total-review-count"], #acrCustomerReviewText';
      const reviewElement = document.querySelector(reviewCountSelector);
      if (reviewElement) {
        details.reviewCount = reviewElement.textContent?.trim() || '';
      }

      // 7. 抓取主图
      const imageSelectors = [
        '#landingImage',
        '#mainImage',
        '.imgTagWrapper img',
        '[data-feature-name="heroImage"] img'
      ];

      for (const selector of imageSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const src = (element as HTMLImageElement).src;
          if (src && !src.includes('no-img')) {
            details.images.push(src);
            break;
          }
        }
      }

      return details;
    });

    // 提取 ASIN
    productDetails.asin = asin;

    // 显示抓取结果
    log('\n✅ 产品详情抓取完成', 'success');

    log(`\n📦 产品标题:`, 'info');
    log(productDetails.title || '(未找到)', 'info');

    log(`\n💰 价格: ${productDetails.price || '(未找到)'}`, 'info');
    log(`⭐ 评分: ${productDetails.rating || '(未找到)'}`, 'info');
    log(`📝 评论数: ${productDetails.reviewCount || '(未找到)'}`, 'info');

    log(`\n📋 五点描述 (${productDetails.bulletPoints.length} 个):`, 'info');
    productDetails.bulletPoints.forEach((point, index) => {
      log(`${index + 1}. ${point.substring(0, 80)}...`, 'info');
    });

    log(`\n📄 长描述 (${productDetails.longDescription.length} 字符):`, 'info');
    log(productDetails.longDescription.substring(0, 200) + '...', 'info');

    // 保存到文件
    log('\n💾 保存产品详情...', 'info');

    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

    // 保存为 JSON
    const jsonPath = path.join(outputDir, `amazon-product-${asin}-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(productDetails, null, 2), 'utf-8');
    log(`✅ JSON已保存: ${jsonPath}`, 'success');

    // 保存为易读的 TXT
    const txtContent = `
Amazon 产品详情
================

ASIN: ${productDetails.asin}
链接: ${productDetails.url}
抓取时间: ${productDetails.timestamp}

产品标题
--------
${productDetails.title}

价格: ${productDetails.price}
评分: ${productDetails.rating}
评论数: ${productDetails.reviewCount}

五点描述
--------
${productDetails.bulletPoints.map((point, i) => `${i + 1}. ${point}`).join('\n\n')}

长描述
--------
${productDetails.longDescription}
`;

    const txtPath = path.join(outputDir, `amazon-product-${asin}-${timestamp}.txt`);
    fs.writeFileSync(txtPath, txtContent, 'utf-8');
    log(`✅ TXT已保存: ${txtPath}`, 'success');

    // 截图
    const screenshotPath = path.join(outputDir, `amazon-product-${asin}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log(`📸 截图已保存: ${screenshotPath}`, 'info');

    // 总结
    log('\n' + '='.repeat(60), 'info');
    log('🎉 抓取完成！', 'success');
    log('='.repeat(60), 'info');

    log('\n📊 抓取统计:', 'info');
    log(`✅ 标题: ${productDetails.title ? '已获取' : '未找到'}`, 'success');
    log(`✅ 五点描述: ${productDetails.bulletPoints.length} 个`, 'success');
    log(`✅ 长描述: ${productDetails.longDescription.length > 0 ? '已获取' : '未找到'}`, 'success');
    log(`✅ 价格: ${productDetails.price || '未找到'}`, 'info');
    log(`✅ 评分: ${productDetails.rating || '未找到'}`, 'info');

    log('\n💡 文件位置:', 'info');
    log(`📄 JSON: ${jsonPath}`, 'info');
    log(`📝 TXT: ${txtPath}`, 'info');
    log(`📸 截图: ${screenshotPath}`, 'info');

    log('\n💡 浏览器保持打开，您可以查看产品页面', 'info');

    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 抓取失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testAmazonProduct();
