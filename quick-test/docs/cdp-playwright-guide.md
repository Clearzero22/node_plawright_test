# CDP + Playwright 操作指南

## CDP 是什么

CDP（Chrome DevTools Protocol）是 Chrome 浏览器的原生调试协议，提供数百个底层操作能力。通过 CDP 可以远程控制 Chrome 浏览器的所有行为。

## CDP vs Playwright

| | Playwright | CDP |
|--|-----------|-----|
| **是什么** | 浏览器自动化框架 | Chrome 原生调试协议 |
| **谁启动浏览器** | Playwright 自己启动 | 连接已有的 Chrome |
| **浏览器指纹** | 自动化标记可被检测 | 与真实用户一致 |
| **反检测** | 容易被 Cloudflare 识别 | 无法被区分 |

Playwright 内置了 CDP 支持，`chromium.connectOverCDP()` 就是 Playwright 提供的 API。连接后完全使用 Playwright API 操作。

```
Playwright 自己启动：   chromium.launch()           → browser → page.xxx()
CDP 连接已有 Chrome：  chromium.connectOverCDP(wsUrl) → browser → page.xxx()
                                                        完全相同的 API
```

---

## CDP 使用方式

### 方式 1：手动启动 Chrome + 代码连接

```bash
# 终端 1：启动 Chrome 调试模式
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-cdp-profile"
```

```typescript
import { chromium } from 'playwright';

// 获取 WebSocket URL
const resp = await fetch('http://127.0.0.1:9222/json/version');
const data = await resp.json();
const wsUrl = data.webSocketDebuggerUrl; // ws://localhost:9222/devtools/browser/xxx

// 连接
const browser = await chromium.connectOverCDP(wsUrl);
const context = browser.contexts()[0];
const page = context.pages()[0];

// 之后和 Playwright 一样用
await page.goto('https://chatgpt.com');
await page.fill('textarea', 'hello');
await page.press('textarea', 'Enter');
```

### 方式 2：代码自动启动 Chrome（推荐）

```typescript
import { chromium } from 'playwright';
import { spawn } from 'child_process';

let browser;
try {
  // 先尝试连接已有 Chrome
  const resp = await fetch('http://127.0.0.1:9222/json/version');
  const data = await resp.json();
  browser = await chromium.connectOverCDP(data.webSocketDebuggerUrl);
} catch {
  // 没有运行中，自动启动
  spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--remote-debugging-port=9222',
    '--user-data-dir=/path/to/profile',
    '--no-first-run',
  ], { detached: true, stdio: 'ignore' });

  await sleep(3000);
  const resp = await fetch('http://127.0.0.1:9222/json/version');
  const data = await resp.json();
  browser = await chromium.connectOverCDP(data.webSocketDebuggerUrl);
}
```

### 关键参数说明

```
--remote-debugging-port=9222                    开启调试端口
--user-data-dir=/path                           浏览器数据目录（cookies、登录状态）
--no-first-run                                   跳过首次启动引导
--disable-blink-features=AutomationControlled   隐藏自动化标记
```

### 注意事项

1. 不能同时用同一个 user-data-dir 启动多个 Chrome
2. 必须用 Chrome 二进制路径启动，不能用 `open -a`
3. 用完要 `disconnect()` 而非 `close()` — 否则真实 Chrome 会被关掉
4. 系统代理问题 — 用 `http.get('http://127.0.0.1:9222/...')` 而非 `fetch()`
5. 登录一次即可 — cookies 保存在 user-data-dir，下次自动登录

---

## CDP 操作功能大全

### 页面操作

```typescript
const page = browser.contexts()[0].pages()[0];

await page.goto('https://example.com');     // 导航
await page.goBack();                         // 后退
await page.goForward();                      // 前进
await page.reload();                         // 刷新
await page.url();                            // 获取当前 URL
await page.title();                          // 获取标题
```

### DOM 交互

```typescript
await page.click('#btn');                    // 点击
await page.fill('input', 'hello');           // 填写输入框
await page.type('textarea', 'text', { delay: 50 }); // 模拟逐字输入
await page.press('input', 'Enter');          // 按键
await page.selectOption('select', 'value');  // 下拉选择
await page.check('#checkbox');               // 勾选
await page.uncheck('#checkbox');             // 取消勾选
await page.setInputFiles('input[type=file]', '/path/to/file.png'); // 上传文件
await page.hover('.menu');                   // 鼠标悬停
await page.dragAndDrop('#source', '#target'); // 拖拽
```

### 等待

```typescript
await page.waitForSelector('.result');                          // 等待元素出现
await page.waitForSelector('.loading', { state: 'hidden' });   // 等待消失
await page.waitForSelector('.btn', { state: 'visible' });      // 等待可见
await page.waitForSelector('.btn', { state: 'attached' });     // 等待挂载到 DOM
await page.waitForURL('https://chatgpt.com/**');               // 等待 URL 变化
await page.waitForFunction(() => document.querySelectorAll('.item').length > 5); // 等待条件
await page.waitForTimeout(3000);                                // 固定等待（不推荐多用）
await page.waitForLoadState('networkidle');                     // 等待网络空闲
```

### 内容获取

```typescript
await page.textContent('.title');           // 获取文本
await page.innerHTML('.content');           // 获取 HTML
await page.getAttribute('a', 'href');       // 获取属性
await page.inputValue('input');             // 获取输入框的值
await page.isChecked('#checkbox');          // 获取勾选状态
await page.isVisible('.element');           // 判断是否可见
await page.isEnabled('#submit');            // 判断是否可用
await page.screenshot({ path: 'screenshot.png' }); // 截图
await page.pdf({ path: 'page.pdf' });       // 导出 PDF

// 在浏览器上下文执行 JS
const data = await page.evaluate(() => {
  return {
    title: document.title,
    items: document.querySelectorAll('.item').length,
  };
});
```

### 多标签页管理

```typescript
const context = browser.contexts()[0];

const page1 = context.pages()[0];           // 获取已有标签页
const page2 = await context.newPage();       // 新建标签页
const page3 = await context.newPage();

await page2.goto('https://google.com');
await page3.goto('https://github.com');

// 切换标签页
await page2.bringToFront();

await page2.close();                         // 关闭标签页
```

### Cookie / 存储

```typescript
const context = browser.contexts()[0];

const cookies = await context.cookies();                 // 读取 cookies
await context.addCookies([{
  name: 'token',
  value: 'xxx',
  domain: '.example.com',
  path: '/'
}]); // 设置
await context.clearCookies();                              // 清除

// localStorage / sessionStorage
await page.evaluate(() => {
  localStorage.setItem('key', 'value');
  return localStorage.getItem('key');
});
```

### 网络拦截

```typescript
// 拦截并修改请求
await page.route('**/api/**', async route => {
  const url = route.request().url();
  console.log('请求:', url);

  const response = await route.fetch();
  const body = await response.text();
  console.log('响应:', body);

  // 修改后放行
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ mock: true }),
  });
});

// 屏蔽图片/字体等资源加载
await page.route('**/*.{png,jpg,svg,woff2}', route => route.abort());
```

### 键盘鼠标

```typescript
await page.mouse.click(100, 200);           // 坐标点击
await page.mouse.dblclick(100, 200);        // 双击
await page.mouse.move(100, 200);            // 移动
await page.mouse.down();                    // 按下
await page.mouse.up();                      // 释放
await page.mouse.wheel(0, 500);             // 滚动

await page.keyboard.press('Control+C');     // 组合键
await page.keyboard.press('Enter');
await page.keyboard.type('Hello World');    // 直接输入
await page.keyboard.down('Shift');
await page.keyboard.up('Shift');
```

### 文件下载

```typescript
const download = await Promise.all([
  page.waitForEvent('download'),            // 等待下载事件
  page.click('#download-btn'),              // 触发下载
]);
const path = await download[0].path();      // 获取下载文件路径
await download[0].saveAs('/target/path');   // 另存为
```

### iframe 操作

```typescript
const frame = page.frameLocator('#iframe-id');
await frame.locator('.btn').click();        // 在 iframe 内操作
const text = await frame.locator('.content').textContent();
```

### 对话框处理

```typescript
// 自动处理弹窗
page.on('dialog', async dialog => {
  console.log(dialog.message());           // 获取弹窗内容
  await dialog.accept();                   // 点确定
  // await dialog.dismiss();               // 点取消
  // await dialog.accept('输入值');         // prompt 输入
});
await page.click('#trigger-alert');
```

### CDP 底层能力（Playwright API 不直接暴露的）

通过 `page.context().newCDPSession()` 可以直接发送 CDP 命令：

```typescript
const cdp = await page.context().newCDPSession(page);

// 获取性能指标
const metrics = await cdp.send('Performance.getMetrics');

// 监听网络请求（底层）
cdp.on('Network.requestWillBeSent', (e) => console.log(e.request.url));
cdp.on('Network.responseReceived', (e) => console.log(e.response.url));

// 截取 console 输出
cdp.on('Runtime.consoleAPICalled', (e) => console.log(e.args));

// 覆盖地理位置
await cdp.send('Emulation.setGeolocationOverride', {
  latitude: 39.9,
  longitude: 116.4,
});

// 设置设备模式（模拟手机）
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 375,
  height: 812,
  deviceScaleFactor: 3,
  mobile: true,
});

// 截取 DOM 变化
cdp.on('DOM.childNodeInserted', (e) => console.log('DOM 变化:', e));

// 获取页面资源树
const resources = await cdp.send('Page.getResourceTree');

// 清除浏览器缓存
await cdp.send('Network.clearBrowserCache');

// 设置 User-Agent
await cdp.send('Network.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (iPhone...)',
});
```

---

## 适用场景

| 场景 | 推荐方式 |
|------|----------|
| 测试 Web 应用 | Playwright launch（完全控制） |
| 爬普通网站 | Playwright launch |
| 爬需要登录的网站 | CDP 连接（复用登录态） |
| 绕过 Cloudflare/反爬 | CDP 连接（真实指纹） |
| 调试线上页面 | CDP 连接（不重启浏览器） |
| 批量操作已登录账号 | CDP 连接 |

---

**最后更新：** 2026-04-30
**测试环境：** macOS + Chrome 147 + Playwright + Node.js 22
