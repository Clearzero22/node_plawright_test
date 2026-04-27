import { launchPersistent, getPageFromContext, log, sleep } from './utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Amazon 产品详情完整抓取测试
 *
 * 功能：
 * 1. 访问指定的 Amazon 产品页面
 * 2. 抓取完整的产品信息（标题、价格、品牌、规格等）
 * 3. 抓取五点描述（About this item）
 * 4. 抓取产品规格参数（Product Information）
 * 5. 抓取长描述（Product Description）
 * 6. 保存为 JSON 和 TXT 格式
 */

interface CompleteProductDetails {
  url: string;
  asin: string;
  title: string;
  brand: string;
  price: string;
  colors: string[];
  bulletPoints: string[];
  productInfo: Record<string, string>;
  longDescription: string;
  specifications: {
    style?: string;
    color?: string;
    shape?: string;
    tableDesign?: string;
    styleName?: string;
    theme?: string;
    furnitureFinish?: string;
    legStyle?: string;
    topColor?: string;
    baseColor?: string;
    itemDimensions?: string;
    itemWeight?: string;
    size?: string;
    tabletopThickness?: string;
    itemWidth?: string;
    maximumLiftingHeight?: string;
    frameMaterialType?: string;
    topMaterialType?: string;
    materialType?: string;
    productCareInstructions?: string;
    isStainResistant?: string;
    modelName?: string;
    includedComponents?: string;
    modelNumber?: string;
    manufacturer?: string;
    manufacturerPartNumber?: string;
    specialFeatures?: string;
    maximumWeightRecommendation?: string;
    recommendedUsesForProduct?: string;
    indoorOutdoorUsage?: string;
    specificUsesForProduct?: string;
    toolsRecommendedForAssembly?: string;
    includesAllAssemblyTools?: string;
    baseType?: string;
    minimumRequiredDoorWidth?: string;
    tableExtensionMechanism?: string;
    isFoldable?: string;
    numberOfItems?: string;
    isCustomizable?: string;
    isResizable?: string;
  };
  rating: string;
  reviewCount: string;
  bestSellersRank: string[];
  images: string[];
  timestamp: string;
}

async function testAmazonProductComplete() {
  log('='.repeat(60), 'info');
  log('🚀 Amazon 产品详情完整抓取测试', 'info');
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

    // 点击 "See more product details" 链接展开详细信息
    log('\n📋 点击展开产品详情...', 'info');

    try {
      const seeMoreLink = page.locator('#seeMoreDetailsLink');
      if (await seeMoreLink.isVisible({ timeout: 5000 })) {
        await seeMoreLink.click();
        log('✅ 已点击展开产品详情', 'success');
        await sleep(2000);
      }
    } catch (error) {
      log('⚠️  展开操作跳过', 'warning');
    }

    // 点击所有折叠展开按钮（Style, Measurements, Materials & Care 等）
    log('\n📂 点击所有折叠区域展开详情...', 'info');

    try {
      // 查找所有展开按钮
      const expanderHeaders = page.locator('.a-expander-header.a-expander-section-header');

      const count = await expanderHeaders.count();
      log(`找到 ${count} 个折叠区域`, 'info');

      for (let i = 0; i < count; i++) {
        try {
          const header = expanderHeaders.nth(i);
          const isVisible = await header.isVisible();
          const isExpanded = await header.getAttribute('aria-expanded');

          if (isVisible && isExpanded === 'false') {
            await header.click();
            await sleep(500); // 等待内容展开
            log(`✅ 已展开区域 ${i + 1}`, 'success');
          }
        } catch (e) {
          // 跳过无法点击的区域
        }
      }

      log('✅ 所有折叠区域已展开', 'success');
      await sleep(2000); // 等待所有内容完全加载

    } catch (error) {
      log('⚠️  展开折叠区域时出错，继续抓取...', 'warning');
    }

    // 抓取完整产品信息
    log('\n📊 开始抓取完整产品详情...', 'info');

    const productDetails: CompleteProductDetails = await page.evaluate(() => {
      const details: CompleteProductDetails = {
        url: window.location.href,
        asin: '',
        title: '',
        brand: '',
        price: '',
        colors: [],
        bulletPoints: [],
        productInfo: {},
        longDescription: '',
        specifications: {},
        rating: '',
        reviewCount: '',
        bestSellersRank: [],
        images: [],
        timestamp: new Date().toISOString()
      };

      // 1. 抓取产品标题
      const titleElement = document.querySelector('#productTitle');
      if (titleElement) {
        details.title = titleElement.textContent?.trim() || '';
      }

      // 2. 抓取品牌
      const brandSelectors = [
        '#bylineInfo',
        '[data-feature-name="byline"]',
        'tr.po-brand .po-break-word',
        'a#bylineInfo'
      ];
      for (const selector of brandSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim().replace(/Brand:\s*/i, '').replace(/Visit the.*Store/i, '').trim();
          if (text) {
            details.brand = text;
            break;
          }
        }
      }

      // 3. 抓取价格
      const priceElement = document.querySelector('.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice');
      if (priceElement) {
        details.price = priceElement.textContent?.trim() || '';
      }

      // 4. 抓取所有颜色选项
      const colorElements = document.querySelectorAll('#variation_color_name li, #variation_color_name .swatchItem');
      colorElements.forEach(el => {
        const colorText = el.textContent?.trim();
        const priceText = el.querySelector('.a-offscreen')?.textContent?.trim();
        if (colorText) {
          details.colors.push(priceText ? `${colorText} - ${priceText}` : colorText);
        }
      });

      // 5. 抓取五点描述（About this item）
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

      // 6. 抓取产品规格参数（Product Information 表格）
      const specTable = document.querySelector('#productDetails_techSpec_section_1, #productDetails_detailBullets_sections_1');
      if (specTable) {
        const rows = specTable.querySelectorAll('tr, .prodDetSectionEntry');
        rows.forEach(row => {
          const label = row.querySelector('th, .prodDetSectionEntryLabel')?.textContent?.trim();
          const value = row.querySelector('td, .prodDetSectionEntryValue')?.textContent?.trim();
          if (label && value) {
            details.productInfo[label] = value;
          }
        });
      }

      // 抓取详细规格（Product information, Measurements, Materials & Care 等）
      const detailSections = document.querySelectorAll('[data-feature-name="productDetails"] table, .techSpecSection table, #productDetails_db_tables');
      detailSections.forEach(section => {
        const rows = section.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const key = cells[0].textContent?.trim();
            const val = cells[1].textContent?.trim();
            if (key && val && !key.includes('Details') && !key.includes('Specifications')) {
              details.productInfo[key] = val;
            }
          }
        });
      });

      // 映射到特定字段
      const fieldMapping: Record<string, keyof CompleteProductDetails['specifications']> = {
        'Style': 'style',
        'Color': 'color',
        'Shape': 'shape',
        'Table Design': 'tableDesign',
        'Style Name': 'styleName',
        'Theme': 'theme',
        'Furniture Finish': 'furnitureFinish',
        'Leg Style': 'legStyle',
        'Top Color': 'topColor',
        'Base Color': 'baseColor',
        'Item Dimensions D x W x H': 'itemDimensions',
        'Item Weight': 'itemWeight',
        'Size': 'size',
        'Tabletop Thickness': 'tabletopThickness',
        'Item Width': 'itemWidth',
        'Maximum Lifting Height': 'maximumLiftingHeight',
        'Frame Material Type': 'frameMaterialType',
        'Top Material Type': 'topMaterialType',
        'Material Type': 'materialType',
        'Product Care Instructions': 'productCareInstructions',
        'Is Stain Resistant': 'isStainResistant',
        'Model Name': 'modelName',
        'Included Components': 'includedComponents',
        'Model Number': 'modelNumber',
        'Manufacturer': 'manufacturer',
        'Manufacturer Part Number': 'manufacturerPartNumber',
        'Special Features': 'specialFeatures',
        'Maximum Weight Recommendation': 'maximumWeightRecommendation',
        'Recommended Uses For Product': 'recommendedUsesForProduct',
        'Indoor/Outdoor Usage': 'indoorOutdoorUsage',
        'Specific Uses For Product': 'specificUsesForProduct',
        'Tools Recommended For Assembly': 'toolsRecommendedForAssembly',
        'Includes All Assembly Tools': 'includesAllAssemblyTools',
        'Base Type': 'baseType',
        'Minimum Required Door Width': 'minimumRequiredDoorWidth',
        'Table Extension Mechanism': 'tableExtensionMechanism',
        'Is Foldable': 'isFoldable',
        'Number of Items': 'numberOfItems',
        'Is Customizable?': 'isCustomizable',
        'Is the item resizable?': 'isResizable'
      };

      Object.entries(fieldMapping).forEach(([key, field]) => {
        if (details.productInfo[key]) {
          details.specifications[field] = details.productInfo[key];
        }
      });

      // 7. 抓取长描述
      const descSelectors = [
        '#productDescription',
        '#productDescription p',
        '[data-feature-name="productDescription"]',
        '#aplus',
        '#aplus3p'
      ];

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

      // 8. 抓取评分和评论数
      const ratingElement = document.querySelector('[data-hook="average-star-rating"] .a-icon-alt, .a-icon-alt');
      if (ratingElement) {
        const ratingText = ratingElement.textContent?.trim();
        if (ratingText) {
          details.rating = ratingText.split(' ')[0];
        }
      }

      const reviewElement = document.querySelector('[data-hook="total-review-count"], #acrCustomerReviewText');
      if (reviewElement) {
        details.reviewCount = reviewElement.textContent?.trim() || '';
      }

      // 9. 抓取 Best Sellers Rank
      const rankSelectors = [
        '#productDetails_detailBullets_sections_1 span',
        '#detailBullets_feature_div span',
        '[data-feature-name="productDetails"] span'
      ];

      for (const selector of rankSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.includes('#') && text.includes('in')) {
            if (!details.bestSellersRank.includes(text)) {
              details.bestSellersRank.push(text);
            }
          }
        });
      }

      // 10. 抓取主图
      const imageElement = document.querySelector('#landingImage, #mainImage, .imgTagWrapper img');
      if (imageElement) {
        const src = (imageElement as HTMLImageElement).src;
        if (src && !src.includes('no-img')) {
          details.images.push(src);
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

    log(`\n🏷️  品牌: ${productDetails.brand || '(未找到)'}`, 'info');
    log(`💰 价格: ${productDetails.price || '(未找到)'}`, 'info');
    log(`⭐ 评分: ${productDetails.rating || '(未找到)'}`, 'info');
    log(`📝 评论数: ${productDetails.reviewCount || '(未找到)'}`, 'info');

    if (productDetails.colors.length > 0) {
      log(`\n🎨 可选颜色 (${productDetails.colors.length}):`, 'info');
      productDetails.colors.forEach(color => log(`  - ${color}`, 'info'));
    }

    log(`\n📋 五点描述 (${productDetails.bulletPoints.length} 个):`, 'info');
    productDetails.bulletPoints.forEach((point, index) => {
      log(`${index + 1}. ${point}`, 'info');
    });

    log(`\n📐 规格参数:`, 'info');
    Object.entries(productDetails.specifications).forEach(([key, value]) => {
      if (value) log(`  ${key}: ${value}`, 'info');
    });

    if (productDetails.bestSellersRank.length > 0) {
      log(`\n🏆 销售排名:`, 'info');
      productDetails.bestSellersRank.forEach(rank => log(`  ${rank}`, 'info'));
    }

    log(`\n📄 长描述 (${productDetails.longDescription.length} 字符):`, 'info');
    log(productDetails.longDescription.substring(0, 300) + '...', 'info');

    // 保存到文件
    log('\n💾 保存产品详情...', 'info');

    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

    // 保存为 JSON
    const jsonPath = path.join(outputDir, `amazon-product-complete-${asin}-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(productDetails, null, 2), 'utf-8');
    log(`✅ JSON已保存: ${jsonPath}`, 'success');

    // 保存为易读的 TXT
    let txtContent = `
Amazon 产品完整详情
==================

ASIN: ${productDetails.asin}
链接: ${productDetails.url}
抓取时间: ${productDetails.timestamp}

基础信息
--------
产品标题: ${productDetails.title}
品牌: ${productDetails.brand}
价格: ${productDetails.price}
评分: ${productDetails.rating}
评论数: ${productDetails.reviewCount}
`;

    if (productDetails.colors.length > 0) {
      txtContent += `\n可选颜色\n--------\n${productDetails.colors.map(c => `- ${c}`).join('\n')}\n`;
    }

    txtContent += `
五点描述 (About this item)
--------
${productDetails.bulletPoints.map((point, i) => `${i + 1}. ${point}`).join('\n\n')}

产品规格参数
--------
${Object.entries(productDetails.specifications).map(([key, value]) => `${key}: ${value}`).join('\n')}

所有产品信息
--------
${Object.entries(productDetails.productInfo).map(([key, value]) => `${key}: ${value}`).join('\n')}
`;

    if (productDetails.bestSellersRank.length > 0) {
      txtContent += `\n销售排名\n--------\n${productDetails.bestSellersRank.join('\n')}\n`;
    }

    txtContent += `
长描述 (Product Description)
--------
${productDetails.longDescription}
`;

    const txtPath = path.join(outputDir, `amazon-product-complete-${asin}-${timestamp}.txt`);
    fs.writeFileSync(txtPath, txtContent, 'utf-8');
    log(`✅ TXT已保存: ${txtPath}`, 'success');

    // 总结
    log('\n' + '='.repeat(60), 'info');
    log('🎉 抓取完成！', 'success');
    log('='.repeat(60), 'info');

    log('\n📊 抓取统计:', 'info');
    log(`✅ 标题: ${productDetails.title ? '已获取' : '未找到'}`, 'success');
    log(`✅ 品牌: ${productDetails.brand || '未找到'}`, 'success');
    log(`✅ 颜色选项: ${productDetails.colors.length} 个`, 'success');
    log(`✅ 五点描述: ${productDetails.bulletPoints.length} 个`, 'success');
    log(`✅ 规格参数: ${Object.keys(productDetails.specifications).length} 个`, 'success');
    log(`✅ 长描述: ${productDetails.longDescription.length > 0 ? '已获取' : '未找到'}`, 'success');

    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 抓取失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testAmazonProductComplete();
