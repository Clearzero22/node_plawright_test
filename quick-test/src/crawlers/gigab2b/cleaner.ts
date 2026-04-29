import { GigaB2BStaging, GigaB2BClean } from './config';

/**
 * GigaB2B 数据清洗器
 *
 * 职责仅限于：接收 staging 数据 → 返回 clean 数据
 * 纯函数，不涉及 I/O、浏览器、数据库
 */
export class GigaB2BCleaner {
  constructor(
    public readonly source: string,
    public readonly runId: string,
  ) {}

  clean(staging: GigaB2BStaging): GigaB2BClean {
    const externalId = this._extractExternalId(staging.url);
    const cleaned = this._cleanPrice(staging.price);

    return {
      source: this.source,
      runId: this.runId,
      url: staging.url,
      externalId,
      title: staging.title.replace(/\s+/g, ' ').trim(),
      price: cleaned.price,
      currency: cleaned.currency,
      description: staging.description.trim() || undefined,
      images: staging.images,
      specifications: staging.specifications,
      scrapedAt: staging.scrapedAt,
    };
  }

  private _extractExternalId(url: string): string {
    const match = url.match(/product_id=(\d+)/);
    return match ? match[1] : 'unknown';
  }

  private _cleanPrice(raw: string): { price?: string; currency?: string } {
    const cleaned = raw
      .replace(/Login To See Price.*/gi, '')
      .replace(/[^0-9.]/g, '')
      .trim();

    if (!cleaned) return {};
    return { price: cleaned, currency: 'USD' };
  }
}

export const createCleaner = (source: string, runId: string) =>
  new GigaB2BCleaner(source, runId);
