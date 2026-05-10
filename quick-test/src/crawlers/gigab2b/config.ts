/** GigaB2B 爬虫配置 */
export interface GigaB2BConfig {
  productUrl: string;
}

/** 提取出的 staging 数据结构（保留原始格式） */
export interface GigaB2BStaging {
  url: string;
  title: string;
  price: string;
  description: string;
  images: string[];
  specifications: Record<string, string>;
  scrapedAt: string;
}

/** 清洗后 clean 数据结构（入库就绪） */
export interface GigaB2BClean {
  source: string;
  runId: string;
  url: string;
  externalId: string;
  title: string;
  price?: string;
  currency?: string;
  description?: string;
  images: string[];
  specifications: Record<string, string>;
  scrapedAt: string;
}
