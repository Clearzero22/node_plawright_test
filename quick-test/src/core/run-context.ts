import * as fs from 'fs';
import * as path from 'path';
import { CrawlerRun } from './types';

const RUNS_DIR = path.join(process.cwd(), 'output', 'runs');

export class RunContext {
  readonly run: CrawlerRun;
  readonly dirs: {
    root: string;
    raw: string;
    staging: string;
    clean: string;
    screenshots: string;
    
  };

  private constructor(run: CrawlerRun) {
    this.run = run;
    const root = path.join(RUNS_DIR, run.runId);
    this.dirs = {
      root,
      raw: path.join(root, 'raw'),
      staging: path.join(root, 'staging'),
      clean: path.join(root, 'clean'),
      screenshots: path.join(root, 'screenshots'),
    };
  }

  /** 创建一个新的运行上下文 */
  static async create(
    source: string,
    params: Record<string, string> = {}
  ): Promise<RunContext> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const hash = Math.random().toString(36).slice(2, 8);
    const runId = `${source}-${dateStr}-${hash}`;

    const run: CrawlerRun = {
      runId,
      source,
      status: 'running',
      startedAt: now.toISOString(),
      itemsScraped: 0,
      errors: 0,
      params,
    };

    const ctx = new RunContext(run);
    ctx._ensureDirs();
    ctx._saveRunMeta();
    return ctx;
  }

  // ─── 目录管理 ───

  private _ensureDirs() {
    for (const dir of Object.values(this.dirs)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private _saveRunMeta() {
    const metaPath = path.join(this.dirs.root, 'run.json');
    fs.writeFileSync(metaPath, JSON.stringify(this.run, null, 2), 'utf-8');
  }

  // ─── 数据保存 ───

  /** 保存原始数据（HTML / API 响应） */
  async saveRaw(filename: string, data: string | Buffer): Promise<string> {
    const filePath = path.join(this.dirs.raw, filename);
    fs.writeFileSync(filePath, data);
    return filePath;
  }

  /** 保存解析后数据（staging 层） */
  async saveStaging(filename: string, data: unknown): Promise<string> {
    const filePath = path.join(this.dirs.staging, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }

  /** 保存清洗后数据（clean 层，入库就绪） */
  async saveClean(filename: string, data: unknown): Promise<string> {
    const filePath = path.join(this.dirs.clean, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }

  /** 保存截图 */
  async saveScreenshot(filename: string, buffer: Buffer): Promise<string> {
    const filePath = path.join(this.dirs.screenshots, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  // ─── 运行状态 ───

  incrementItems(count: number = 1) {
    this.run.itemsScraped += count;
    this._saveRunMeta();
  }

  incrementErrors(count: number = 1) {
    this.run.errors += count;
    this._saveRunMeta();
  }

  async complete(
    status: 'completed' | 'failed' | 'partial' = 'completed',
    error?: string
  ) {
    this.run.status = status;
    this.run.completedAt = new Date().toISOString();
    if (error) this.run.error = error;
    this._saveRunMeta();
  }

  // ─── 查询 ───

  /** 根据 runId 恢复已存在的运行上下文 */
  static async getRun(runId: string): Promise<RunContext | null> {
    const metaPath = path.join(RUNS_DIR, runId, 'run.json');
    if (!fs.existsSync(metaPath)) return null;
    const run = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as CrawlerRun;
    return new RunContext(run);
  }

  /** 列出所有运行记录 */
  static listRuns(): CrawlerRun[] {
    if (!fs.existsSync(RUNS_DIR)) return [];
    return fs.readdirSync(RUNS_DIR)
      .map(dir => {
        const metaPath = path.join(RUNS_DIR, dir, 'run.json');
        if (!fs.existsSync(metaPath)) return null;
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as CrawlerRun;
      })
      .filter((r): r is CrawlerRun => r !== null);
  }
}
