/**
 * ChatGPT 文件上传 — CLI 入口
 *
 * 通过 API 服务器调用 ChatGPT 服务，全流程自动化：
 *   - 自动启动 Chrome CDP（由服务层处理）
 *   - 上传文件并发送 prompt
 *   - 获取回复并输出
 *
 * 用法：
 *   npm run run:chatgpt
 *   npm run run:chatgpt -- --file /path/to/image.png --prompt "描述这张图"
 *   npm run run:chatgpt -- --file img.png --prompt "分析" --timeout 120000
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

const API_BASE = 'http://localhost:3456';
const DEFAULT_FILE = path.join(__dirname, '../output/gemini-cdp-result.png');
const DEFAULT_PROMPT = '请用中文描述这张图片的内容';

function parseArgs(): { filePath: string; prompt: string; timeout: number } {
  const args = process.argv.slice(2);
  let filePath = DEFAULT_FILE;
  let prompt = DEFAULT_PROMPT;
  let timeout = 120000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) filePath = path.resolve(args[++i]);
    if (args[i] === '--prompt' && args[i + 1]) prompt = args[++i];
    if (args[i] === '--timeout' && args[i + 1]) timeout = parseInt(args[++i], 10);
  }

  return { filePath, prompt, timeout };
}

function checkApiAlive(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${API_BASE}/api/health`, { timeout: 3000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function postUpload(body: Record<string, unknown>): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL('/api/chatgpt/upload', API_BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: body.responseTimeout as number + 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode || 500, data: JSON.parse(data) }));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  const { filePath, prompt, timeout } = parseArgs();

  console.log('=== ChatGPT File Upload (via API) ===');
  console.log(`File:   ${filePath}`);
  console.log(`Prompt: ${prompt}`);
  console.log(`Timeout: ${timeout}ms`);

  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: File not found: ${filePath}`);
    process.exit(1);
  }

  console.log('\nChecking API server...');
  const alive = await checkApiAlive();
  if (!alive) {
    console.error(`ERROR: API server not running at ${API_BASE}`);
    console.error('Start it first: npm run api');
    process.exit(1);
  }
  console.log('API server OK');

  console.log('\nSending request...');
  const startTime = Date.now();

  try {
    const { statusCode, data } = await postUpload({
      filePath,
      prompt,
      responseTimeout: timeout,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (statusCode === 200 && data.success) {
      console.log(`\n✅ Success (${elapsed}s, response ${data.response?.length || 0} chars)`);
      console.log(`   File uploaded: ${data.fileUploaded}`);
      console.log('\n' + '='.repeat(60));
      console.log('RESPONSE:');
      console.log('='.repeat(60));
      console.log(data.response || '(empty)');
      console.log('='.repeat(60));
    } else {
      console.error(`\n❌ Failed (${elapsed}s)`);
      console.error(`   Status: ${statusCode}`);
      console.error(`   Error: ${data.error || 'Unknown'}`);
      if (data.details) console.error(`   Details: ${data.details}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Request failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
