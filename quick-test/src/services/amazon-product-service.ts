/**
 * Amazon Product Service — 抓取 Amazon 商品完整详情
 *
 * 从 test-amazon-product-complete.ts 提取的 Service 类。
 * 自管理浏览器生命周期，参照 AmazonSearchService 模式。
 */

import { chromium, type BrowserContext } from 'playwright';
import * as os from 'os';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────

export interface AmazonProductData {
  asin: string;
  title: string;
  brand: string;
  price: string;
  rating: string;
  reviewCount: string;
  bulletPoints: string[];
  longDescription: string;
  images: string[];
  specifications: Record<string, string>;
  bestSellersRank: string[];
  colors: string[];
  timestamp: string;
  url: string;
}

// ─── Category mapping for specs ───────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  'Color': 'Style', 'Shape': 'Style', 'Table Design': 'Style', 'Style Name': 'Style',
  'Theme': 'Style', 'Furniture Finish': 'Style', 'Leg Style': 'Style',
  'Top Color': 'Style', 'Base Color': 'Style',
  'Item Dimensions D x W x H': 'Measurements', 'Item Weight': 'Measurements',
  'Size': 'Measurements', 'Tabletop Thickness': 'Measurements',
  'Item Width': 'Measurements', 'Maximum Lifting Height': 'Measurements',
  'Item Dimensions': 'Measurements', 'Extended Length': 'Measurements',
  'Frame Material Type': 'Materials & Care', 'Top Material Type': 'Materials & Care',
  'Product Care Instructions': 'Materials & Care', 'Is Stain Resistant': 'Materials & Care',
  'Material Type': 'Materials & Care',
  'Brand Name': 'Item Details', 'Model Name': 'Item Details',
  'Included Components': 'Item Details', 'Model Number': 'Item Details',
  'Special Features': 'Item Details', 'Manufacturer': 'Item Details',
  'Manufacturer Part Number': 'Item Details', 'Best Sellers Rank': 'Item Details', 'ASIN': 'Item Details',
  'Maximum Weight Recommendation': 'User Guide', 'Recommended Uses For Product': 'User Guide',
  'Indoor/Outdoor Usage': 'User Guide', 'Specific Uses For Product': 'User Guide',
  'Tools Recommended For Assembly': 'User Guide', 'Includes All Assembly Tools': 'User Guide',
  'Base Type': 'Features & Specs', 'Minimum Required Door Width': 'Features & Specs',
  'Table Extension Mechanism': 'Features & Specs', 'Is Foldable': 'Features & Specs',
  'Number of Items': 'Features & Specs', 'Tilting': 'Features & Specs',
  'Is Customizable?': 'Features & Specs', 'Is the item resizable?': 'Features & Specs',
};

// ─── Service ──────────────────────────────────────────────────

export class AmazonProductService {
  private context: BrowserContext | null = null;

  async scrape(input: { asin?: string; url?: string; headless?: boolean }): Promise<AmazonProductData> {
    const { asin: inputAsin, url: inputUrl, headless = true } = input;

    // Resolve ASIN and URL
    let asin = inputAsin || '';
    let url = inputUrl || '';

    if (asin && !url) {
      url = `https://www.amazon.com/dp/${asin}`;
    }
    if (url && !asin) {
      const match = url.match(/\/dp\/([A-Z0-9]{10})/);
      asin = match ? match[1] : '';
    }
    if (!url) throw new Error('必须提供 asin 或 url');

    // Launch browser
    const userDataDir = path.join(os.tmpdir(), 'amazon-product-profile');
    // ⚠️ 重要：统一使用共享的浏览器数据目录
    const sharedUserDataDir = path.join(os.homedir(), '.node-plawright-test', 'chrome-profile', 'automation');
    this.context = await chromium.launchPersistentContext(sharedUserDataDir, {
      headless,
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
    });

    const page = this.context.pages()[0] || await this.context.newPage();

    // Navigate
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Expand product details
    try {
      const seeMoreLink = page.locator('#seeMoreDetailsLink');
      if (await seeMoreLink.isVisible({ timeout: 3000 })) {
        await seeMoreLink.click();
        await page.waitForTimeout(1500);
      }
    } catch {}

    // Expand all collapsed sections
    try {
      const expanders = page.locator('.a-expander-header.a-expander-section-header');
      const count = await expanders.count();
      for (let i = 0; i < count; i++) {
        try {
          const header = expanders.nth(i);
          if (await header.isVisible() && (await header.getAttribute('aria-expanded')) === 'false') {
            await header.click();
            await page.waitForTimeout(400);
          }
        } catch {}
      }
      await page.waitForTimeout(1500);
    } catch {}

    // Extract data
    const raw = await page.evaluate(() => {
      const data: any = { url: window.location.href, colors: [], bulletPoints: [], bestSellersRank: [], images: [] };

      // Title
      const titleEl = document.querySelector('#productTitle');
      data.title = titleEl?.textContent?.trim() || '';

      // Brand
      for (const sel of ['#bylineInfo', '[data-feature-name="byline"]', 'tr.po-brand .po-break-word']) {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.textContent?.trim().replace(/Brand:\s*/i, '').replace(/Visit the.*Store/i, '').trim();
          if (t) { data.brand = t; break; }
        }
      }

      // Price
      const priceEl = document.querySelector('.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice');
      data.price = priceEl?.textContent?.trim() || '';

      // Colors
      document.querySelectorAll('#variation_color_name li, #variation_color_name .swatchItem').forEach(el => {
        const ct = el.textContent?.trim();
        const pt = el.querySelector('.a-offscreen')?.textContent?.trim();
        if (ct) data.colors.push(pt ? `${ct} - ${pt}` : ct);
      });

      // Bullet points
      document.querySelectorAll('#feature-bullets ul li, #feature-bullets span.a-list-item').forEach(el => {
        const t = el.textContent?.trim();
        if (t && t.length > 10 && !t.includes('⟵')) {
          const clean = t.replace(/^[\s•\-–—]+/, '').trim();
          if (clean && !data.bulletPoints.includes(clean)) data.bulletPoints.push(clean);
        }
      });

      // Flat specs from tables
      const flatSpecs: Record<string, string> = {};
      document.querySelectorAll('#productDetails_feature_div table.prodDetTable, .prodDetTable').forEach(table => {
        table.querySelectorAll('tr').forEach(row => {
          const cells = row.querySelectorAll('th, td');
          if (cells.length >= 2) {
            const k = cells[0].textContent?.trim();
            const v = cells[1].textContent?.trim();
            if (k && v && !k.includes('Details') && !k.includes('Specifications')) flatSpecs[k] = v;
          }
          const label = row.querySelector('.prodDetSectionEntry');
          const value = row.querySelector('.prodDetAttrValue');
          if (label && value) {
            const k = label.textContent?.trim();
            const v = value.textContent?.trim();
            if (k && v) flatSpecs[k] = v;
          }
        });
      });
      data.flatSpecs = flatSpecs;

      // Long description
      for (const sel of ['#productDescription', '#productDescription p', '[data-feature-name="productDescription"]', '#aplus', '#aplus3p']) {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.textContent?.trim();
          if (t && t.length > 50) { data.longDescription = t; break; }
        }
      }

      // Rating
      const ratingEl = document.querySelector('[data-hook="average-star-rating"] .a-icon-alt, .a-icon-alt');
      if (ratingEl) {
        const rt = ratingEl.textContent?.trim();
        if (rt) data.rating = rt.split(' ')[0];
      }

      // Review count
      const revEl = document.querySelector('[data-hook="total-review-count"], #acrCustomerReviewText');
      data.reviewCount = revEl?.textContent?.trim() || '';

      // Best sellers rank
      for (const sel of ['#productDetails_detailBullets_sections_1 span', '#detailBullets_feature_div span']) {
        document.querySelectorAll(sel).forEach(el => {
          const t = el.textContent?.trim();
          if (t && t.includes('#') && t.includes('in') && !data.bestSellersRank.includes(t)) {
            data.bestSellersRank.push(t);
          }
        });
      }

      // Main image
      const imgEl = document.querySelector('#landingImage, #mainImage, .imgTagWrapper img');
      if (imgEl) {
        const src = (imgEl as HTMLImageElement).src;
        if (src && !src.includes('no-img')) data.images.push(src);
      }

      return data;
    });

    // Build specifications (flattened with category prefix)
    const flatSpecs = (raw.flatSpecs || {}) as Record<string, string>;
    const specifications: Record<string, string> = {};
    for (const [key, value] of Object.entries(flatSpecs)) {
      const category = CATEGORY_MAP[key];
      specifications[category ? `${category}.${key}` : key] = value;
    }

    return {
      asin,
      url: (raw.url as string) || url,
      title: (raw.title as string) || '',
      brand: (raw.brand as string) || '',
      price: (raw.price as string) || '',
      rating: (raw.rating as string) || '',
      reviewCount: (raw.reviewCount as string) || '',
      bulletPoints: (raw.bulletPoints as string[]) || [],
      longDescription: (raw.longDescription as string) || '',
      images: (raw.images as string[]) || [],
      specifications,
      bestSellersRank: (raw.bestSellersRank as string[]) || [],
      colors: (raw.colors as string[]) || [],
      timestamp: new Date().toISOString(),
    };
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
  }
}
