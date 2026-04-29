/**
 * GigaB2B CLI 入口
 *
 * 用法：
 *   npx tsx src/scripts/run-gigab2b.ts                        ← 默认 headless + DB（可用时）
 *   npx tsx src/scripts/run-gigab2b.ts --no-db                ← 只存本地文件
 *   npx tsx src/scripts/run-gigab2b.ts --no-headless          ← 显示浏览器窗口
 *   npx tsx src/scripts/run-gigab2b.ts --url=<product_url>
 *
 * 这是最薄的一层：解析 CLI 参数 → 调用服务层 → 输出结果
 * 不包含任何爬虫逻辑或存储逻辑
 */

import { CrawlerService } from '../services/crawler-service';
import { DatabaseService } from '../core/database-service';
import * as os from 'os';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const useDB = !args.includes('--no-db');
  const headless = !args.includes('--no-headless');

  const url = args.find(a => a.startsWith('--url='))?.split('=')[1]
    || 'https://www.gigab2b.com/index.php?route=product/product&product_id=747431';

  console.log('='.repeat(60));
  console.log('GigaB2B 爬虫');
  console.log(`  URL:      ${url}`);
  console.log(`  Headless: ${headless}`);
  console.log(`  Database: ${useDB}`);
  console.log('='.repeat(60));

  const service = new CrawlerService();
  const options: any = {
    saveFiles: true,
    headless,
    userDataDir: path.join(os.tmpdir(), 'crawler-chrome-profile'),
  };

  if (useDB) {
    try {
      const db = new DatabaseService();
      await db.connect();
      options.db = db;
      console.log('  ✅ PostgreSQL 已连接\n');
    } catch {
      console.log('  ⚠️  PostgreSQL 不可用，仅保存到本地文件');
      console.log('     (docker-compose up -d 启动数据库)\n');
    }
  }

  console.log('开始抓取...\n');
  const result = await service.runGigaB2B(url, options);

  console.log('\n' + '='.repeat(60));
  console.log('结果');
  console.log('='.repeat(60));
  console.log(`  Run ID:   ${result.runId}`);
  console.log(`  状态:     ${result.status}`);
  console.log(`  抓取项:   ${result.itemsScraped}`);

  if (result.clean) {
    console.log(`  产品:     ${result.clean.title}`);
    console.log(`  价格:     ${result.clean.price || 'N/A'} ${result.clean.currency || ''}`);
    console.log(`  图片:     ${result.clean.images.length} 张`);
    console.log(`  规格:     ${Object.keys(result.clean.specifications).length} 个`);
  }

  if (result.error) {
    console.log(`  错误:     ${result.error}`);
  }

  if (options.db) {
    await options.db.disconnect();
  }

  process.exit(result.status === 'completed' ? 0 : 1);
}

main().catch(err => {
  console.error('脚本失败:', err);
  process.exit(1);
});
