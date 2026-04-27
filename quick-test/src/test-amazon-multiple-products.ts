import { launchPersistent, log, sleep } from './utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Amazon 多产品并行抓取测试
 *
 * 功能：
 * 1. 在多个标签页中同时访问不同的 Amazon 产品页面
 * 2. 并行抓取所有产品信息
 * 3. 保存为汇总 JSON 和单独 TXT 文件
 */

interface CompleteProductDetails {
  url: string;
  asin: string;
  title: string;
  brand: string;
  price: string;
  colors: string[];
  bulletPoints: string[];
  longDescription: string;
  rating: string;
  reviewCount: string;
  bestSellersRank: string[];
  images: string[];
  timestamp: string;
  productInfo: {
    style?: { [key: string]: string };
    measurements?: { [key: string]: string };
    materialsAndCare?: { [key: string]: string };
    itemDetails?: { [key: string]: string };
    userGuide?: { [key: string]: string };
    featuresAndSpecs?: { [key: string]: string };
  };
}

// 产品列表
const productUrls = [
  'https://www.amazon.com/dp/B0F281R5RC',
  'https://www.amazon.com/dp/B0F27ZPQ62',
  'https://www.amazon.com/dp/B0F3HG1LYR',
  'https://www.amazon.com/dp/B0F3HGGDZ7',
  'https://www.amazon.com/dp/B0F3HKF7ML',
  'https://www.amazon.com/dp/B0DJ25ZJZK',
  'https://www.amazon.com/dp/B0CSFJLSTW',
];

// 抓取单个产品
async function scrapeProduct(page: any, url: string): Promise<CompleteProductDetails> {
  const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
  const asin = asinMatch ? asinMatch[1] : 'Unknown';

  log(`\n📦 开始抓取 ${asin}...`, 'info');

  await page.goto(url, {
    timeout: 30000,
    waitUntil: 'domcontentloaded'
  });

  await sleep(2000);

  // 点击展开产品详情
  try {
    const seeMoreLink = page.locator('#seeMoreDetailsLink');
    if (await seeMoreLink.isVisible({ timeout: 3000 })) {
      await seeMoreLink.click();
      await sleep(1500);
    }
  } catch (e) {
    // 跳过
  }

  // 展开所有折叠区域
  try {
    const expanderHeaders = page.locator('.a-expander-header.a-expander-section-header');
    const count = await expanderHeaders.count();

    for (let i = 0; i < count; i++) {
      try {
        const header = expanderHeaders.nth(i);
        const isExpanded = await header.getAttribute('aria-expanded');
        if (isExpanded === 'false') {
          await header.click();
          await sleep(300);
        }
      } catch (e) {
        // 跳过
      }
    }
    await sleep(1000);
  } catch (e) {
    // 跳过
  }

  const productDetails = await page.evaluate(() => {
    const details: any = {
      url: window.location.href,
      asin: '',
      title: '',
      brand: '',
      price: '',
      colors: [],
      bulletPoints: [],
      productInfo: { style: {}, measurements: {}, materialsAndCare: {}, itemDetails: {}, userGuide: {}, featuresAndSpecs: {} },
      longDescription: '',
      rating: '',
      reviewCount: '',
      bestSellersRank: [],
      images: [],
      timestamp: new Date().toISOString()
    };

    const titleElement = document.querySelector('#productTitle');
    if (titleElement) details.title = titleElement.textContent?.trim() || '';

    const brandSelectors = ['#bylineInfo', '[data-feature-name="byline"]', 'tr.po-brand .po-break-word', 'a#bylineInfo'];
    for (const selector of brandSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim().replace(/Brand:\s*/i, '').replace(/Visit the.*Store/i, '').trim();
        if (text) { details.brand = text; break; }
      }
    }

    const priceElement = document.querySelector('.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice');
    if (priceElement) details.price = priceElement.textContent?.trim() || '';

    const bulletElements = document.querySelectorAll('#feature-bullets ul li, #feature-bullets span.a-list-item');
    bulletElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 10 && !text.includes('⟵')) {
        const cleanText = text.replace(/^[\s•\-–—]+/, '').trim();
        if (cleanText && !details.bulletPoints.includes(cleanText)) {
          details.bulletPoints.push(cleanText);
        }
      }
    });

    const flatProductInfo: { [key: string]: string } = {};
    const specTables = document.querySelectorAll('#productDetails_feature_div table.prodDetTable');
    specTables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        if (cells.length >= 2) {
          const key = cells[0].textContent?.trim();
          const val = cells[1].textContent?.trim();
          if (key && val && !key.includes('Details') && !key.includes('Specifications')) {
            flatProductInfo[key] = val;
          }
        }
      });
    });

    const allTables = document.querySelectorAll('.prodDetTable');
    allTables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const label = row.querySelector('.prodDetSectionEntry');
        const value = row.querySelector('.prodDetAttrValue');
        if (label && value) {
          const labelText = label.textContent?.trim();
          const valueText = value.textContent?.trim();
          if (labelText && valueText) {
            flatProductInfo[labelText] = valueText;
          }
        }
      });
    });

    const categoryMapping: { [key: string]: string } = {
      'Color': 'style', 'Shape': 'style', 'Table Design': 'style', 'Style Name': 'style',
      'Theme': 'style', 'Furniture Finish': 'style', 'Leg Style': 'style', 'Top Color': 'style', 'Base Color': 'style',
      'Item Dimensions D x W x H': 'measurements', 'Item Weight': 'measurements', 'Size': 'measurements',
      'Tabletop Thickness': 'measurements', 'Item Width': 'measurements', 'Maximum Lifting Height': 'measurements',
      'Item Dimensions': 'measurements', 'Extended Length': 'measurements',
      'Frame Material Type': 'materialsAndCare', 'Top Material Type': 'materialsAndCare',
      'Product Care Instructions': 'materialsAndCare', 'Is Stain Resistant': 'materialsAndCare', 'Material Type': 'materialsAndCare',
      'Brand Name': 'itemDetails', 'Model Name': 'itemDetails', 'Included Components': 'itemDetails',
      'Model Number': 'itemDetails', 'Special Features': 'itemDetails', 'Manufacturer': 'itemDetails',
      'Manufacturer Part Number': 'itemDetails', 'Best Sellers Rank': 'itemDetails', 'ASIN': 'itemDetails',
      'Maximum Weight Recommendation': 'userGuide', 'Recommended Uses For Product': 'userGuide',
      'Indoor/Outdoor Usage': 'userGuide', 'Specific Uses For Product': 'userGuide',
      'Tools Recommended For Assembly': 'userGuide', 'Includes All Assembly Tools': 'userGuide',
      'Base Type': 'featuresAndSpecs', 'Minimum Required Door Width': 'featuresAndSpecs',
      'Table Extension Mechanism': 'featuresAndSpecs', 'Is Foldable': 'featuresAndSpecs',
      'Number of Items': 'featuresAndSpecs', 'Tilting': 'featuresAndSpecs',
      'Is Customizable?': 'featuresAndSpecs', 'Is the item resizable?': 'featuresAndSpecs'
    };

    Object.entries(flatProductInfo).forEach(([key, value]) => {
      const category = categoryMapping[key];
      if (category && details.productInfo[category]) {
        const camelKey = key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '').replace(/\s+/g, '-');
        details.productInfo[category][camelKey] = value;
      }
    });

    const descSelectors = ['#productDescription', '#productDescription p', '[data-feature-name="productDescription"]', '#aplus', '#aplus3p'];
    for (const selector of descSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        if (text && text.length > 50) {
          details.longDescription = text;
          break;
        }
      }
    }

    const ratingElement = document.querySelector('[data-hook="average-star-rating"] .a-icon-alt, .a-icon-alt');
    if (ratingElement) {
      const ratingText = ratingElement.textContent?.trim();
      if (ratingText) details.rating = ratingText.split(' ')[0];
    }

    const reviewElement = document.querySelector('[data-hook="total-review-count"], #acrCustomerReviewText');
    if (reviewElement) details.reviewCount = reviewElement.textContent?.trim() || '';

    const imageElement = document.querySelector('#landingImage, #mainImage, .imgTagWrapper img');
    if (imageElement) {
      const src = (imageElement as HTMLImageElement).src;
      if (src && !src.includes('no-img')) details.images.push(src);
    }

    return details;
  });

  productDetails.asin = asin;
  log(`✅ ${asin} 抓取完成: ${productDetails.title?.substring(0, 50)}...`, 'success');

  return productDetails;
}

async function testAmazonMultipleProducts() {
  log('='.repeat(60), 'info');
  log('🚀 Amazon 多产品并行抓取测试', 'info');
  log('='.repeat(60), 'info');

  try {
    const context = await launchPersistent('amazon-multi-test-profile');

    log(`\n📋 准备抓取 ${productUrls.length} 个产品`, 'info');

    // 创建所有页面的Promise
    const scrapePromises = productUrls.map(async (url) => {
      const page = await context.newPage();
      return await scrapeProduct(page, url);
    });

    // 并行执行所有抓取
    log('\n🔄 开始并行抓取...\n', 'info');
    const results = await Promise.all(scrapePromises);

    log('\n✅ 所有产品抓取完成！', 'success');

    // 保存结果
    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

    // 保存汇总 JSON
    const summaryPath = path.join(outputDir, `amazon-multiple-products-${timestamp}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify({
      totalProducts: results.length,
      timestamp: new Date().toISOString(),
      products: results
    }, null, 2), 'utf-8');
    log(`\n✅ 汇总JSON已保存: ${summaryPath}`, 'success');

    // 保存单独的 TXT 文件
    results.forEach(product => {
      const txtContent = `
Amazon 产品详情
================

ASIN: ${product.asin}
链接: ${product.url}
抓取时间: ${product.timestamp}

产品标题
--------
${product.title}

品牌: ${product.brand}
价格: ${product.price}
评分: ${product.rating}

五点描述
--------
${product.bulletPoints.map((point, i) => `${i + 1}. ${point}`).join('\n\n')}

长描述
--------
${product.longDescription}
`;
      const txtPath = path.join(outputDir, `amazon-${product.asin}-${timestamp}.txt`);
      fs.writeFileSync(txtPath, txtContent, 'utf-8');
    });

    log(`✅ 已保存 ${results.length} 个 TXT 文件`, 'success');

    // 统计
    log('\n📊 抓取统计:', 'info');
    results.forEach(p => {
      log(`  ${p.asin}: ${p.title?.substring(0, 40)}... (${p.bulletPoints.length} bullet points)`, 'info');
    });

    log('\n💡 浏览器保持打开，您可以查看所有产品页面', 'info');

    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 抓取失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testAmazonMultipleProducts();
