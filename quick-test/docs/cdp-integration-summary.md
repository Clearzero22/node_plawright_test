# CDP 集成 ChatGPT 服务 — 完整操作记录

## 背景

Playwright 直接启动浏览器会被 Cloudflare 反自动化检测拦截，导致 ChatGPT 页面卡在"验证你是真人"。解决方案：使用 CDP（Chrome DevTools Protocol）连接本机真实 Chrome 浏览器。

---

## 问题与解决过程

### 问题 1：Cloudflare 反自动化检测

**现象：** Playwright 启动的浏览器访问 ChatGPT 时，无限卡在"请验证你是真人"页面。

**根因：** Playwright 启动的浏览器指纹（WebDriver flag、TLS 指纹等）被 Cloudflare 识别。

**解决：** 改用 CDP 连接真实 Chrome，复用真实浏览器的指纹和登录状态。

```
Playwright launchPersistentContext()  →  被拦截 ❌
Playwright connectOverCDP()           →  绕过检测 ✅
```

### 问题 2：Chrome 147 的 CDP HTTP URL 返回 400

**现象：** `chromium.connectOverCDP('http://localhost:9222')` 报 400 错误。

**根因：** Chrome 147 拒绝 HTTP 协议的 CDP 连接，必须使用 WebSocket。

**解决：** 先请求 `/json/version` 获取 `webSocketDebuggerUrl`（`ws://`），再用它连接。

```typescript
const data = await fetchCDP('/json/version');
const browser = await chromium.connectOverCDP(data.webSocketDebuggerUrl);
```

### 问题 3：系统代理 `http_proxy` 干扰 CDP 连接

**现象：** `fetch('http://localhost:9222/json/version')` 走了系统代理（`127.0.0.1:7897`），返回 502。

**根因：** Node.js 的 `fetch()` 会读取 `http_proxy` 环境变量，请求 localhost 也被代理。

**解决：** 改用 `http.get('http://127.0.0.1:9222/...')` 直接请求，绕过代理。

```typescript
function fetchCDP(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(...); } });
    }).on('error', reject);
  });
}
```

### 问题 4：`open -a` 启动 Chrome 忽略参数

**现象：** 用 `open -a "Google Chrome" --remote-debugging-port=9222` 启动 Chrome，参数不生效。

**根因：** `open -a` 在 Chrome 已运行时会复用已有进程，忽略新参数。

**解决：** 用完整路径直接执行 Chrome 二进制文件：

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

### 问题 5：`browser.close()` 关闭了真实 Chrome

**现象：** 第一次 API 调用成功，第二次报 "Target page, context or browser has been closed"。

**根因：** `finally` 块中 `browser.close()` 会关闭 CDP 连接的真实 Chrome 浏览器。

**解决：** 改用 `disconnect()` 只断开连接，不关闭浏览器：

```typescript
// ❌ browser.close()  — 会关闭真实 Chrome
// ✅ browser.disconnect()  — 只断开连接
try { await (this.browser as any).disconnect?.(); } catch { /* ignore */ }
```

### 问题 6：获取到旧回复而非新回复

**现象：** API 返回的 response 总是上一次对话的回复，不是最新发的。

**根因：** `[data-message-author-role="assistant"]:last-of-type` 取的是页面上最后一条 assistant 消息，不区分新旧。

**解决：** 发送前记录消息数量，用 `waitForFunction` 等待新消息出现：

```typescript
const msgCountBefore = await page.evaluate(() =>
  document.querySelectorAll('[data-message-author-role="assistant"]').length
);
await textbox.press('Enter');

await page.waitForFunction(
  (before) => document.querySelectorAll('[data-message-author-role="assistant"]').length > before,
  msgCountBefore,
  { timeout: responseTimeout },
);
```

### 问题 7：回复内容被截断

**现象：** 只拿到 "这是一款竹制沙发边几/床边桌，主要信"（18 个字符）。

**根因：** `innerText()` 在 ChatGPT 还在生成回复时就执行了，内容不完整。

**解决：** 等待 stop button 消失，确认生成完毕后再获取内容：

```typescript
await page.waitForSelector('[data-testid="stop-button"]', { timeout: 5000 });
await page.waitForSelector('[data-testid="stop-button"]', { state: 'hidden', timeout: responseTimeout });
await this.sleep(2000); // 额外等待渲染完成
```

### 问题 8：Playwright locator click 在 CDP 下报 page closed

**现象：** `page.locator('[data-testid="copy-turn-action-button"]').click()` 报 "Target page, context or browser has been closed"。

**根因：** CDP 模式下 Playwright locator 操作不稳定。

**解决：** 改用 `page.evaluate()` 在浏览器上下文中直接操作 DOM：

```typescript
responseText = await page.evaluate(async () => {
  const copyBtns = document.querySelectorAll('[data-testid="copy-turn-action-button"]');
  if (copyBtns.length === 0) return '';
  const lastBtn = copyBtns[copyBtns.length - 1] as HTMLElement;
  lastBtn.click();
  await new Promise(r => setTimeout(r, 500));
  return await navigator.clipboard.readText();
});
```

---

## 最终架构

```
用户/CLI/API 调用
       ↓
ChatGPTFileService.upload()
       ↓
┌─────────────────────────────────────────────┐
│ 1. fetchCDP('/json/version')                │  ← http.get 绕过代理
│    获取 ws:// URL                            │
│                                             │
│ 2. chromium.connectOverCDP(wsUrl)           │  ← WebSocket 连接真实 Chrome
│                                             │
│ 3. page.goto('chatgpt.com')                 │  ← 导航（如需要）
│                                             │
│ 4. fileInput.setInputFiles(filePath)        │  ← 上传文件
│                                             │
│ 5. 记录 msgCountBefore                      │  ← 发送前快照
│    textbox.fill(prompt)                     │
│    textbox.press('Enter')                   │
│                                             │
│ 6. waitForFunction(msgCount > before)       │  ← 等待新回复出现
│    waitForSelector(stop-button, hidden)     │  ← 等待生成完毕
│                                             │
│ 7. page.evaluate → 点击复制按钮 → clipboard │  ← 获取完整 Markdown
│    fallback: textContent                    │
│                                             │
│ 8. fs.writeFileSync('output/xxx.md')        │  ← 保存到文件
│                                             │
│ 9. browser.disconnect()                     │  ← 只断开连接
└─────────────────────────────────────────────┘
```

---

## 涉及的文件

| 文件 | 说明 |
|------|------|
| `src/services/chatgpt-file-service.ts` | 核心服务，CDP 连接 + 上传 + 获取回复 + 保存 |
| `src/api-server.ts` | API 路由 `POST /api/chatgpt/upload` |
| `src/run-chatgpt.ts` | CLI 入口，调用 API（薄包装） |
| `package.json` | 添加 `run:chatgpt` 脚本 |
| `docs/chatgpt-service-guide.md` | 使用文档 |

---

## 提交记录

| Commit | 说明 |
|--------|------|
| `d75cae8` | CDP 连接真实 Chrome 替代 Playwright 启动 |
| `4573cb6` | http.get 绕过代理、stop button 等待、disconnect 修复 |
| `c27efe8` | 复制按钮获取 Markdown、消息计数确保新回复、自动保存 |

---

## 使用方式

### API 调用

```bash
# 启动 API 服务器
npm run api

# 调用接口
curl -X POST http://localhost:3456/api/chatgpt/upload \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/path/to/image.png", "prompt": "描述这张图片"}'
```

### CLI 调用

```bash
npm run run:chatgpt -- --file output/image.png --prompt "描述这张图片"
```

### 返回示例

```json
{
  "success": true,
  "prompt": "描述这张图片",
  "response": "## 产品信息\n\n* **名称**：...\n* **价格**：...",
  "fileUploaded": true,
  "filePath": "/path/to/image.png",
  "savedPath": "output/chatgpt-response-1777494918826.md",
  "timestamp": "2026-04-29T20:35:18.826Z"
}
```

---

## 关键经验总结

1. **CDP 优于 Playwright 启动** — 对 Cloudflare 等反自动化检测更友好
2. **用 `http.get` 而非 `fetch`** — Node.js `fetch` 受 `http_proxy` 影响
3. **`disconnect()` 而非 `close()`** — CDP 连接的真实 Chrome 不能关
4. **用 `page.evaluate` 而非 locator** — CDP 下 locator 操作不稳定
5. **消息计数防旧回复** — 确保获取的是本次对话的新回复
6. **stop button 判断生成完毕** — 比 sleep 更可靠
7. **复制按钮获取完整 Markdown** — textContent 只有纯文本

---

**最后更新：** 2026-04-30
**测试环境：** macOS + Chrome 147 + Playwright + Node.js 22
