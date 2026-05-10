import { launchPersistent, getPageFromContext, log, sleep } from './utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 豆包 Amazon Listing 生成器
 *
 * 功能：
 * 1. 访问豆包网站
 * 2. 上传产品图片
 * 3. 输入竞品分析提示词
 * 4. 获取AI生成的listing
 * 5. 保存结果
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
      return data.products.slice(0, 5);
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
    return `我的产品是：${productName}\n\n我已经上传了产品图片，请参考图片中的产品设计和功能。\n\n${basePrompt}`;
  }

  return basePrompt;
}

async function testDoubaoListingGenerator() {
  log('='.repeat(60), 'info');
  log('🚀 豆包 Amazon Listing 生成器', 'info');
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
    const promptPath = path.join(outputDir, `doubao-listing-prompt-${Date.now()}.txt`);
    fs.writeFileSync(promptPath, prompt, 'utf-8');
    log(`💾 提示词已保存: ${promptPath}`, 'info');

    // 3. 启动浏览器
    const context = await launchPersistent();
    const page = await getPageFromContext(context);

    // 4. 访问豆包
    log('\n🌐 访问豆包...', 'info');
    await page.goto('https://www.doubao.com/chat', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    log('✅ 页面加载完成', 'success');
    await sleep(5000);

    // 5. 检查是否需要登录
    log('\n🔍 检查登录状态...', 'info');

    let needsLogin = false;

    try {
      const loginButton = page.getByRole('button', { name: '登录' });
      needsLogin = await loginButton.isVisible({ timeout: 3000 });
    } catch (error) {
      // 如果找不到登录按钮，说明已登录
      needsLogin = false;
    }

    if (needsLogin) {
      log('⚠️  需要登录，请在浏览器中完成登录', 'warning');
      log('💡 等待登录完成（最多60秒）...', 'info');

      // 等待登录按钮消失或超时
      try {
        await page.waitForSelector('text=发消息', { timeout: 60000 });
        log('✅ 登录成功', 'success');
        await sleep(2000);
      } catch (error) {
        log('⚠️  登录等待超时，继续尝试...', 'warning');
      }
    } else {
      log('✅ 已登录', 'success');
    }

    // 6. 上传产品图片
    log('\n📤 准备上传产品图片...', 'info');

    const imagePaths = [
      path.join(__dirname, '../../logo_script/logo.png'),
    ];

    // 自动扫描图片目录
    const imageDir = path.join(__dirname, '../../product-images');
    if (fs.existsSync(imageDir)) {
      const imageFiles = fs.readdirSync(imageDir)
        .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
        .map(f => path.join(imageDir, f));

      imagePaths.push(...imageFiles);
      log(`📁 扫描到 ${imageFiles.length} 个产品图片`, 'info');
    }

    log(`📊 总计 ${imagePaths.length} 张图片待上传`, 'info');

    let uploadedCount = 0;

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];

      if (fs.existsSync(imagePath)) {
        try {
          log(`\n上传图片 ${i + 1}/${imagePaths.length}: ${path.basename(imagePath)}`, 'info');

          // 步骤1: 点击上传按钮（第3个空按钮）
          log('  步骤1: 点击上传按钮...', 'info');
          const uploadTrigger = page.getByRole('button').filter({ hasText: /^$/ }).nth(3);
          await uploadTrigger.click();
          await sleep(1000); // 等待菜单展开

          // 步骤2: 点击"选择云盘文件上传文件或图片"
          log('  步骤2: 选择文件上传...', 'info');
          const uploadButton = page.getByRole('button').filter({ hasText: '选择云盘文件上传文件或图片' });

          // 等待上传按钮出现
          await uploadButton.waitFor({ state: 'visible', timeout: 5000 });
          log('  ✅ 找到上传按钮', 'success');

          // 点击并选择文件
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 10000 }),
            uploadButton.click()
          ]);

          await fileChooser.setFiles(imagePath);
          log(`  ✅ 图片已上传`, 'success');
          uploadedCount++;
          await sleep(2000);

        } catch (error) {
          log(`  ⚠️  上传失败: ${(error as Error).message}`, 'warning');
          log(`  详情: ${JSON.stringify(error)}`, 'info');

          // 如果失败过多，停止上传
          if (i >= 2 && uploadedCount === 0) {
            log('  ❌ 连续失败，可能上传按钮选择器有问题，跳过上传', 'error');
            break;
          }
        }
      }
    }

    log(`\n✅ 图片上传完成: ${uploadedCount} 张`, 'success');

    // 7. 输入提示词
    log('\n✍️  输入提示词...', 'info');

    try {
      const textbox = page.getByRole('textbox', { name: '发消息' });
      await textbox.waitFor({ state: 'visible', timeout: 10000 });
      log('✅ 找到输入框', 'success');

      await textbox.click();
      await sleep(500);

      await textbox.fill(prompt);
      log(`✅ 提示词已输入 (${prompt.length} 字符)`, 'success');
      await sleep(1000);
    } catch (error) {
      log('❌ 输入提示词失败: ' + (error as Error).message, 'error');
      console.error(error);
    }

    // 8. 发送消息（点击发送按钮）
    log('\n📤 发送消息...', 'info');

    try {
      // 根据录制的代码，发送按钮是第5个空按钮
      await page.getByRole('button').filter({ hasText: /^$/ }).nth(5).click();
      log('✅ 消息已发送', 'success');
    } catch (error) {
      log('❌ 发送失败: ' + (error as Error).message, 'error');
    }

    // 9. 等待回复
    log('\n⏳ 等待 AI 生成 listing (这可能需要30-60秒)...', 'info');

    try {
      // 等待回复出现（豆包的回复选择器可能不同）
      await page.waitForTimeout(60000);
      log('✅ 已等待60秒', 'success');
    } catch (error) {
      log('⚠️  等待超时', 'warning');
    }

    // 10. 复制回复内容
    log('\n📋 尝试复制生成的内容...', 'info');

    let responseText = '';

    try {
      responseText = await page.evaluate(() => {
        // 尝试多种选择器找到回复内容
        const selectors = [
          '.message-content',
          '.chat-message',
          '[data-message-content]',
          '.markdown',
          '.prose'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent?.trim();
            if (text && text.length > 100) {
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

    // 11. 保存生成的内容
    if (responseText) {
      log('\n💾 保存生成的 listing...', 'info');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

      // 保存原始回复
      const rawPath = path.join(outputDir, `doubao-listing-raw-${timestamp}.txt`);
      fs.writeFileSync(rawPath, responseText, 'utf-8');
      log(`✅ 原始内容已保存: ${rawPath}`, 'success');

      // 尝试解析JSON
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const listingData = JSON.parse(jsonMatch[0]);

          const jsonPath = path.join(outputDir, `doubao-listing-${timestamp}.json`);
          fs.writeFileSync(jsonPath, JSON.stringify(listingData, null, 2), 'utf-8');
          log(`✅ 结构化数据已保存: ${jsonPath}`, 'success');

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

    // 12. 完成
    log('\n' + '='.repeat(60), 'info');
    log('🎉 Listing 生成完成！', 'success');
    log('='.repeat(60), 'info');

    log('\n📊 上传统计:', 'info');
    log(`✅ 成功上传: ${uploadedCount} 张`, 'success');

    log('\n💡 浏览器保持打开，您可以查看和调整生成的内容', 'info');

    await new Promise(() => {});

  } catch (error: any) {
    log('\n❌ 生成失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

testDoubaoListingGenerator();
