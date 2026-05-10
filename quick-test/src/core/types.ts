/** 单次爬虫运行的元数据 */
export interface CrawlerRun {
  runId: string;
  source: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  startedAt: string;
  completedAt?: string;
  itemsScraped: number;
  errors: number;
  error?: string;
  params: Record<string, string>;
}

/** 统一的产品数据结构（Clean 层标准格式） */
export interface ProductRecord {
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
