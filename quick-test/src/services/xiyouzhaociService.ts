// backend/services/xiyouzhaociService.ts
/**
 * 西柚找词爬虫服务
 * 从 xiyouzhaoci.com 抓取 Amazon 商品关键词数据
 */

import { chromium, type Page } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// 统一使用共享的浏览器数据目录
const DATA_DIR = join(homedir(), '.node-plawright-test', 'chrome-profile', 'file-upload');
const CSV_OUTPUT_DIR = './output/keywords';

interface ScrapedKeyword {
  rank: number;
  keyword: string;
  searchVolume: string | null;
  searchVolumeTrend: string | null;
  trafficShare: string | null;
  rankingPosition: string | null;
  difficulty: string | null;
  clickRate: string | null;
  conversionRate: string | null;
}

interface XiyouzhaociResult {
  asin: string;
  keywords: ScrapedKeyword[];
  totalKeywords: number;
  csvPath: string;
}

/**
 * Parse CSV line with quoted fields support
 */
function parseCsvLine(line: string): ScrapedKeyword | null {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());

  // Skip if too few fields or no keyword
  if (fields.length < 2 || !fields[1]) return null;

  // Extract search volume and trend
  const svParts = (fields[2] || '').split(' ');
  const searchVolume = svParts[0] || null;
  const searchVolumeTrend = svParts[1] || null;

  return {
    rank: parseInt(fields[0], 10) || 0,
    keyword: fields[1],
    searchVolume,
    searchVolumeTrend,
    trafficShare: fields[3] || null,
    rankingPosition: fields[7] || null,
    difficulty: fields[13] || null,
    clickRate: fields[15] || null,
    conversionRate: fields[16] || null,
  };
}

/**
 * Extract table data from page
 */
async function extractTableData(page: Page): Promise<string> {
  return page.evaluate(() => {
    const rows = document.querySelectorAll(
      'table tbody tr, .el-table__body-wrapper tr, .x-table-body tr',
    );
    if (rows.length === 0) return '';

    const lines: string[] = [];
    for (const row of rows) {
      const cells = row.querySelectorAll('td, .cell');
      if (cells.length === 0) continue;
      const texts = Array.from(cells)
        .map((c) => c.textContent?.trim() ?? '')
        .filter(Boolean);
      if (texts.length > 0) {
        lines.push(
          texts.map((t) => `"${t.replace(/"/g, '""')}"`).join(','),
        );
      }
    }
    return lines.join('\n');
  });
}

/**
 * Scrape keywords for a single ASIN
 */
async function scrapeAsin(
  page: Page,
  asin: string,
): Promise<{ keywords: ScrapedKeyword[]; csvData: string }> {
  try {
    console.log(`[${asin}] Navigating to xiyouzhaoci.com...`);
    // ⚠️ 重要：移除 waitUntil: 'networkidle'，使用默认的 'load' 策略
    await page.goto('https://www.xiyouzhaoci.com/asin');
    console.log(`[${asin}] Page loaded: ${await page.title()}`);

    // Wait for page load
    await page.waitForTimeout(5000);

    // Find ASIN input and enter ASIN
    console.log(`[${asin}] Looking for ASIN input field...`);
    const asinInput = page.locator('input[placeholder*="子ASIN"]');
    await asinInput.waitFor({ state: 'visible', timeout: 10000 });
    await asinInput.click();
    await asinInput.fill('');
    await asinInput.type(asin, { delay: 100 });
    await asinInput.press('Enter');
    console.log(`[${asin}] ASIN submitted, waiting for results...`);

    // Wait for search results - 减少等待时间，与工作版本保持一致
    await page.waitForTimeout(2000);

    // Check if there are any results
    const noResults = await page.locator('text=搜索无结果').isVisible().catch(() => false);
    if (noResults) {
      console.log(`[${asin}] No results found for this ASIN`);
      return { keywords: [], csvData: '' };
    }

    // Scroll to find and click "select all" checkbox
    console.log(`[${asin}] Looking for select-all checkbox...`);
    const checkBlock = page.locator('.check_block').first();
    for (let i = 0; i < 20; i++) {
      if (await checkBlock.isVisible({ timeout: 500 }).catch(() => false)) {
        console.log(`[${asin}] Found checkbox after ${i} scrolls`);
        break;
      }
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(500);
    }

    await checkBlock.waitFor({ state: 'visible', timeout: 10000 });
    await checkBlock.click();
    console.log(`[${asin}] Selected all rows`);
    await page.waitForTimeout(2000);

    // Extract table data
    console.log(`[${asin}] Extracting table data...`);
    const tableData = await extractTableData(page);
    console.log(`[${asin}] Extracted ${tableData.split('\n').length} lines from table`);

    // Parse CSV
    const keywords: ScrapedKeyword[] = [];
    const lines = tableData.trim().split('\n');

    for (const line of lines) {
      const parsed = parseCsvLine(line);
      if (parsed && parsed.keyword && !parsed.keyword.includes('月')) {
        // Filter out header rows like "1月,1月,2月..."
        keywords.push(parsed);
      }
    }

    console.log(`[${asin}] Parsed ${keywords.length} valid keywords`);
    return { keywords, csvData: tableData };
  } catch (error) {
    console.error(`[${asin}] Error during scraping:`, error);
    return { keywords: [], csvData: '' };
  }
}

/**
 * Main service function to scrape keywords for an ASIN
 */
export async function scrapeXiyouzhaociKeywords(
  asin: string,
  options: {
    headless?: boolean;
    maxKeywords?: number;
    saveCsv?: boolean;
  } = {},
): Promise<XiyouzhaociResult> {
  const {
    headless = true,
    maxKeywords = 50,
    saveCsv = true,
  } = options;

  console.log(`[Xiyouzhaoci] Starting scrape for ASIN: ${asin}`);
  console.log(`[Xiyouzhaoci] Using shared browser profile: ${DATA_DIR}`);

  const context = await chromium.launchPersistentContext(DATA_DIR, {
    headless,
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  });

  try {
    const page = await context.newPage();
    const { keywords, csvData } = await scrapeAsin(page, asin);
    await page.close();

    // Limit keywords
    const limitedKeywords = keywords.slice(0, maxKeywords);

    // Save CSV if requested
    let csvPath = '';
    if (saveCsv && csvData) {
      const filename = `keywords-${asin}-${Date.now()}.csv`;
      csvPath = join(CSV_OUTPUT_DIR, filename);
      writeFileSync(csvPath, csvData, 'utf-8');
      console.log(`[Xiyouzhaoci] CSV saved: ${csvPath}`);
    }

    console.log(`[Xiyouzhaoci] Scraped ${limitedKeywords.length} keywords`);

    return {
      asin,
      keywords: limitedKeywords,
      totalKeywords: limitedKeywords.length,
      csvPath,
    };
  } finally {
    await context.close();
  }
}
