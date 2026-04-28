import { Pool, PoolConfig } from 'pg';
import { CrawlerRun, ProductRecord } from './types';

const DEFAULT_CONFIG: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'crawler_db',
  user: process.env.DB_USER || 'crawler',
  password: process.env.DB_PASS || 'crawler_pass',
};

export class DatabaseService {
  private pool: Pool;

  constructor(config: PoolConfig = DEFAULT_CONFIG) {
    this.pool = new Pool(config);
  }

  async connect(): Promise<void> {
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  // ─── Runs ─────────────────────────────────────────────────

  async insertRun(run: CrawlerRun): Promise<void> {
    await this.pool.query(
      `INSERT INTO crawler_runs (run_id, source, status, started_at, items_scraped, errors, params)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (run_id) DO UPDATE SET
         status = EXCLUDED.status,
         completed_at = $8::timestamptz,
         items_scraped = EXCLUDED.items_scraped,
         errors = EXCLUDED.errors,
         error = $9`,
      [
        run.runId,
        run.source,
        run.status,
        run.startedAt,
        run.itemsScraped,
        run.errors,
        JSON.stringify(run.params),
        run.completedAt || null,
        run.error || null,
      ]
    );
  }

  async updateRun(run: CrawlerRun): Promise<void> {
    await this.pool.query(
      `UPDATE crawler_runs
       SET status = $2, completed_at = $3, items_scraped = $4, errors = $5, error = $6
       WHERE run_id = $1`,
      [run.runId, run.status, run.completedAt || null, run.itemsScraped, run.errors, run.error || null]
    );
  }

  async listRuns(limit: number = 20): Promise<CrawlerRun[]> {
    const result = await this.pool.query(
      'SELECT * FROM crawler_runs ORDER BY started_at DESC LIMIT $1',
      [limit]
    );
    return result.rows.map(this._mapRun);
  }

  async getRun(runId: string): Promise<CrawlerRun | null> {
    const result = await this.pool.query('SELECT * FROM crawler_runs WHERE run_id = $1', [runId]);
    return result.rows.length ? this._mapRun(result.rows[0]) : null;
  }

  // ─── Raw 层 ────────────────────────────────────────────────

  async insertRaw(runId: string, url: string, content: string): Promise<number> {
    const result = await this.pool.query(
      'INSERT INTO raw_data (run_id, url, content) VALUES ($1, $2, $3) RETURNING id',
      [runId, url, content]
    );
    return result.rows[0].id;
  }

  async getRawByRun(runId: string) {
    const result = await this.pool.query(
      'SELECT * FROM raw_data WHERE run_id = $1 ORDER BY fetched_at',
      [runId]
    );
    return result.rows;
  }

  // ─── Staging 层 ────────────────────────────────────────────

  async insertStaging(runId: string, source: string, data: unknown): Promise<number> {
    const result = await this.pool.query(
      'INSERT INTO staging_data (run_id, source, data) VALUES ($1, $2, $3::jsonb) RETURNING id',
      [runId, source, JSON.stringify(data)]
    );
    return result.rows[0].id;
  }

  async getStagingByRun(runId: string) {
    const result = await this.pool.query(
      'SELECT * FROM staging_data WHERE run_id = $1 ORDER BY parsed_at',
      [runId]
    );
    return result.rows;
  }

  // ─── Clean 层 ──────────────────────────────────────────────

  async upsertProduct(record: ProductRecord): Promise<number> {
    const result = await this.pool.query(
      `INSERT INTO clean_products (run_id, source, url, external_id, title, price, currency, description, images, specifications, scraped_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
       ON CONFLICT (source, external_id) DO UPDATE SET
         run_id = EXCLUDED.run_id,
         url = EXCLUDED.url,
         title = EXCLUDED.title,
         price = EXCLUDED.price,
         currency = EXCLUDED.currency,
         description = EXCLUDED.description,
         images = EXCLUDED.images,
         specifications = EXCLUDED.specifications,
         scraped_at = EXCLUDED.scraped_at
       RETURNING id`,
      [
        record.runId,
        record.source,
        record.url,
        record.externalId,
        record.title,
        record.price || null,
        record.currency || null,
        record.description || null,
        record.images,       // pg 自动把 JS 数组转成 PG array 格式
        JSON.stringify(record.specifications),
        record.scrapedAt,
      ]
    );
    return result.rows[0].id;
  }

  async getProducts(source?: string, limit: number = 20): Promise<ProductRecord[]> {
    let query = 'SELECT * FROM clean_products';
    const params: any[] = [];
    if (source) {
      query += ' WHERE source = $1';
      params.push(source);
    }
    query += ' ORDER BY ingested_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await this.pool.query(query, params);
    return result.rows.map(this._mapProduct);
  }

  // ─── 映射 ──────────────────────────────────────────────────

  private _mapRun(row: any): CrawlerRun {
    return {
      runId: row.run_id,
      source: row.source,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      itemsScraped: row.items_scraped,
      errors: row.errors,
      error: row.error || undefined,
      params: row.params || {},
    };
  }

  private _mapProduct(row: any): ProductRecord {
    return {
      source: row.source,
      runId: row.run_id,
      url: row.url,
      externalId: row.external_id,
      title: row.title || '',
      price: row.price ? String(row.price) : undefined,
      currency: row.currency || undefined,
      description: row.description || undefined,
      images: row.images || [],
      specifications: row.specifications || {},
      scrapedAt: row.scraped_at,
    };
  }

  // ─── AI Recognition Results ─────────────────────────────────

  async insertAiResult(params: {
    runId?: string;
    nodeId: string;
    imageUrl?: string;
    templateId?: string;
    prompt?: string;
    result: string;
    model?: string;
    status?: 'success' | 'failed';
    error?: string;
  }): Promise<number> {
    const res = await this.pool.query(
      `INSERT INTO ai_recognition_results (run_id, node_id, image_url, template_id, prompt, result, model, status, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        params.runId || null,
        params.nodeId,
        params.imageUrl || null,
        params.templateId || null,
        params.prompt || null,
        params.result,
        params.model || null,
        params.status || 'success',
        params.error || null,
      ],
    );
    return res.rows[0].id;
  }

  async getAiResults(runId: string): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT id, run_id, node_id, image_url, template_id, prompt, result, model, status, error, recognized_at
       FROM ai_recognition_results
       WHERE run_id = $1
       ORDER BY id`,
      [runId],
    );
    return res.rows;
  }
}
