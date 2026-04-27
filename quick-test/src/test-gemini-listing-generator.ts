import { launchPersistent, getPageFromContext, log, sleep } from './utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Amazon Listing 生成器 - 使用竞品分析
 *
 * 功能：
 * 1. 读取爬取的竞品数据
 * 2. 构建包含竞品上下文的提示词
 * 3. 上传产品图片
 * 4. 让AI生成优化的Amazon listing
 * 5. 保存生成的listing内容
 */

interface ProductData {
  asin: string;
  title: string;
  brand: string;
  price: string;
  bulletPoints: string[];
  longDescription: string;
  productInfo: any;
  rating: string;
}

// 读取竞品数据
function loadCompetitorData(dataDir: string): ProductData[] {
  const products: ProductData[] = [];

  try {
    const files = fs.readdirSync(dataDir)
      .filter(f => f.startsWith('amazon-multiple-products-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      log('⚠️  未找到竞品数据文件', 'warning');
      return products;
    }

    const latestFile = path.join(dataDir, files[0]);
    log(`📂 读取数据文件: ${latestFile}`, 'info');

    const data = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));

    if (data.products && Array.isArray(data.products)) {
      return data.products.slice(0, 5); // 取前5个竞品
    }

  } catch (error) {
    log('⚠️  读取竞品数据失败: ' + (error as Error).message, 'warning');
  }

  return products;
}

// 构建竞品上下文提示词
function buildCompetitorContext(products: ProductData[]): string {
  if (products.length === 0) {
    return '';
  }

  let context = `以下是${products.length}个竞品的分析数据，用于生成优化的Amazon listing：

`;

  products.forEach((p, index) => {
    context += `\n===== 竞品 ${index + 1} (ASIN: ${p.asin}) =====\n`;
    context += `标题: ${p.title}\n`;
    context += `品牌: ${p.brand}\n`;
    context += `价格: ${p.price}\n`;
    context += `评分: ${p.rating || 'N/A'}\n`;

    if (p.bulletPoints && p.bulletPoints.length > 0) {
      context += `\n五点描述:\n`;
      p.bulletPoints.forEach((bp, i) => {
        context += `${i + 1}. ${bp.substring(0, 150)}...\n`;
      });
    }

    // 提取关键规格
    if (p.productInfo) {
      context += `\n关键规格:\n`;
      const categories = ['style', 'measurements', 'materialsAndCare', 'itemDetails'];
      categories.forEach(cat => {
        if (p.productInfo[cat] && Object.keys(p.productInfo[cat]).length > 0) {
          context += `  ${cat}: ${JSON.stringify(p.productInfo[cat]).substring(0, 100)}...\n`;
        }
      });
    }

    context += '\n';
  });

  return context;
}

// 生成listing提示词
function generateListingPrompt(competitorContext: string, productName?: string): string {
  const basePrompt = `你是一位专业的Amazon listing优化专家。

${competitorContext}

基于以上竞品分析，请帮我生成一个优化的Amazon listing，要求：

1. **产品标题** (150-200字符):
   - 包含核心关键词
   - 突出产品特色和优势
   - 吸引点击

2. **五点描述** (5个要点):
   - 每个要点200-300字符
   - 以大写关键词开头
   - 突出产品独特卖点
   - 包含使用场景和好处

3. **产品描述** (1000-1500字符):
   - 详细介绍产品特点
   - 强调与竞品的差异化优势
   - 包含情感化的营销语言
   - A+页面风格的格式

4. **关键词建议**:
   - Search Terms关键词
   - 后台关键词建议

5. **定价建议**: 基于竞品分析给出合理的价格区间

请以清晰的JSON格式输出，包含以下字段：
{
  "title": "产品标题",
  "bulletPoints": ["要点1", "要点2", ...],
  "description": "产品描述",
  "searchTerms": "关键词1, 关键词2, ...",
  "suggestedPrice": "价格区间",
  "competitiveAdvantages": ["优势1", "优势2", ...]
}
`;

  if (productName) {
    return `我的产品是：${productName}\n\n${basePrompt}`;
  }

  return basePrompt;
}

async function testGeminiListingGenerator() {
  log('='.repeat(60), 'info');
  log('🚀 Amazon Listing 生成器 - 竞品分析版', 'info');
  log('='.repeat(60), 'info');

  try {
    // 1. 读取竞品数据
    const outputDir = path.join(__dirname, '../output');
    const competitors = loadCompetitorData(outputDir);

    if (competitors.length === 0) {
      log('❌ 没有可用的竞品数据，请先运行 test:amazon:multiple', 'error');
      process.exit(1);
    }

    log(`✅ 成功加载 ${competitors.length} 个竞品数据`, 'success');

    // 2. 构建提示词
    const competitorContext = buildCompetitorContext(competitors);
    const prompt = generateListingPrompt(competitorContext, '竹制沙发边桌');

    log('\n📝 提示词已生成', 'info');
    log(`📊 提示词长度: ${prompt.length} 字符`, 'info');

    // 保存提示词供参考
    const promptPath = path.join(outputDir, `listing-prompt-${Date.now()}.txt`);
    fs.writeFileSync(promptPath, prompt, 'utf-8');
    log(`💾 提示词已保存: ${promptPath}`, 'info');

    // 3. 启动浏览器
    const context = await launchPersistent('gemini-listing-profile');
    const page = await getPageFromContext(context);

    // 4. 访问 Gemini
    log('\n🌐 访问 Gemini...', 'info');
    await page.goto('https://gemini.google.com/app', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    log('✅ 页面加载完成', 'success');
    await sleep(3000);

    // 5. 上传产品图片（可选）
    log('\n📤 准备上传产品图片...', 'info');

    const imagePaths = [
      path.join(__dirname, '../../logo_script/logo.png'),
      // 可以添加更多图片路径
    ];

    let uploadedCount = 0;

    for (const imagePath of imagePaths) {
      if (fs.existsSync(imagePath)) {
        try {
          log(`上传图片: ${path.basename(imagePath)}`, 'info');

          const uploadButton = page.getByRole('button', { name: 'Open upload file menu' });
          await uploadButton.waitFor({ state: 'visible', timeout: 5000 });
          await uploadButton.click();
          await sleep(500);

          const fileChooser = await page.waitForEvent('filechooser', { timeout: 10000 });
          await fileChooser.setFiles(imagePath);

          log(`✅ 图片已上传`, 'success');
          uploadedCount++;
          await sleep(1500);
        } catch (error) {
          log(`⚠️  图片上传失败: ${(error as Error).message}`, 'warning');
        }
      }
    }

    log(`✅ 成功上传 ${uploadedCount} 张图片`, 'success');

    // 6. 点击输入框并输入提示词
    log('\n✍️  输入提示词...', 'info');

    try {
      const textbox = page.getByRole('textbox', { name: 'Enter a prompt for Gemini' });
      const paragraph = textbox.getByRole('paragraph');

      await paragraph.click();
      await paragraph.click();
      await sleep(500);

      // 分段输入长文本以避免超时
      const maxChunkSize = 3000;
      for (let i = 0; i < prompt.length; i += maxChunkSize) {
        const chunk = prompt.substring(i, Math.min(i + maxChunkSize, prompt.length));
        await page.keyboard.type(chunk);
        await sleep(200);
      }

      log(`✅ 提示词已输入 (${prompt.length} 字符)`, 'success');
      await sleep(1000);
    } catch (error) {
      log('❌ 输入提示词失败: ' + (error as Error).message, 'error');
    }

    // 7. 发送消息
    log('\n📤 发送消息...', 'info');

    try {
      const sendButton = page.getByRole('button', { name: 'Send message' });
      await sendButton.click();
      log('✅ 消息已发送', 'success');
    } catch (error) {
      log('❌ 发送失败: ' + (error as Error).message, 'error');
    }

    // 8. 等待回复
    log('\n⏳ 等待 AI 生成 listing (这可能需要30-60秒)...', 'info');

    try {
      await page.waitForSelector('[data-test-id="copy-button"], [data-test-id="model-verbose-text"]', {
        timeout: 90000
      });
      log('✅ 收到回复', 'success');
      await sleep(5000); // 等待完整内容生成
    } catch (error) {
      log('⚠️  等待回复超时，尝试继续...', 'warning');
    }

    // 9. 复制回复内容
    log('\n📋 复制生成的内容...', 'info');

    let responseText = '';

    try {
      const copyButton = page.locator('[data-test-id="copy-button"]').first();

      if (await copyButton.isVisible({ timeout: 5000 })) {
        await copyButton.click();
        log('✅ 已点击复制按钮', 'success');
        await sleep(1000);

        try {
          const clipboardText = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
          });
          responseText = clipboardText;
          log('✅ 已从剪贴板获取内容', 'success');
        } catch (clipboardError) {
          log('⚠️  无法访问剪贴板，尝试直接抓取内容', 'warning');
        }
      }
    } catch (error) {
      log('⚠️  复制按钮操作失败，尝试直接抓取内容', 'warning');
    }

    if (!responseText) {
      try {
        responseText = await page.evaluate(() => {
          const selectors = [
            '[data-test-id="model-verbose-text"]',
            '.response-content',
            '.model-response',
            '.markdown',
            '.prose'
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
              const text = element.textContent.trim();
              if (text.length > 100) {
                return text;
              }
            }
          }
          return '';
        });

        if (responseText) {
          log('✅ 已从页面抓取内容', 'success');
        }
      } catch (error) {
        log('❌ 抓取内容失败: ' + (error as Error).message, 'error');
      }
    }

    // 10. 保存生成的内容
    if (responseText) {
      log('\n💾 保存生成的 listing...', 'info');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

      // 保存原始回复
      const rawPath = path.join(outputDir, `listing-raw-${timestamp}.txt`);
      fs.writeFileSync(rawPath, responseText, 'utf-8');
      log(`✅ 原始内容已保存: ${rawPath}`, 'success');

      // 尝试解析JSON
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const listingData = JSON.parse(jsonMatch[0]);

          const jsonPath = path.join(outputDir, `listing-${timestamp}.json`);
          fs.writeFileSync(jsonPath, JSON.stringify(listingData, null, 2), 'utf-8');
          log(`✅ 结构化数据已保存: ${jsonPath}`, 'success');

          // 生成可读的listing文档
          const readableListing = `
AMAZON LISTING
==============

生成时间: ${new Date().toLocaleString()}
基于 ${competitors.length} 个竞品分析

产品标题
--------
${listingData.title || '未生成'}

五点描述
--------
${(listingData.bulletPoints || []).map((bp: string, i: number) => `${i + 1}. ${bp}`).join('\n\n')}

产品描述
--------
${listingData.description || '未生成'}

关键词
--------
Search Terms: ${listingData.searchTerms || '未生成'}

定价建议
--------
${listingData.suggestedPrice || '未生成'}

竞争优势
--------
${(listingData.competitiveAdvantages || []).map((adv: string, i: number) => `${i + 1}. ${adv}`).join('\n')}
`;

          const docPath = path.join(outputDir, `listing-readable-${timestamp}.txt`);
          fs.writeFileSync(docPath, readableListing, 'utf-8');
          log(`✅ 可读文档已保存: ${docPath}`, 'success');

          // 显示预览
          log('\n📄 生成内容预览:', 'info');
          log('\n📦 标题:', 'info');
          log(listingData.title?.substring(0, 100) || '未生成', 'info');
          log(`\n📋 五点描述: ${listingData.bulletPoints?.length || 0} 个`, 'info');
          if (listingData.bulletPoints) {
            listingData.bulletPoints.slice(0, 2).forEach((bp: string, i: number) => {
              log(`${i + 1}. ${bp.substring(0, 80)}...`, 'info');
            });
          }
          log(`\n💰 定价建议: ${listingData.suggestedPrice || '未生成'}`, 'info');

        } else {
          log('⚠️  回复中未找到JSON格式，已保存原始文本', 'warning');
        }
      } catch (parseError) {
        log('⚠️  JSON解析失败，已保存原始文本', 'warning');
      }

      log(`\n📊 内容长度: ${responseText.length} 字符`, 'info');
    }

    // 11. 完成
    log('\n' + '='.repeat(60), 'info');
    log('🎉 Listing 生成完成！', 'success');
    log('='.repeat(60), 'info');

    log('\n💡 浏览器保持打开，您可以查看和调整生成的内容', 'info');

    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 生成失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testGeminiListingGenerator();
