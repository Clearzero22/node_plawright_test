# ChatGPT 文件上传服务 — 完整使用文档

## 概述

通过 CDP（Chrome DevTools Protocol）连接本机真实 Chrome 浏览器，实现 ChatGPT 自动化操作：文件上传、文本输入、发送消息、获取回复。

### 为什么用 CDP？

Playwright/Puppeteer 直接启动的浏览器会被 Cloudflare 识别为自动化工具，导致无限卡在"验证你是真人"。CDP 连接真实 Chrome 可以：
- 复用真实浏览器的指纹和 TLS 特征
- 复用已登录的 cookies 和会话状态
- Cloudflare 无法区分是人工操作还是自动化

---

## 前置条件

- Google Chrome 已安装
- Node.js >= 18
- 项目依赖已安装（`npm install`）

---

## 快速使用（推荐）

### 一键运行

服务会自动检测并启动 Chrome CDP，无需手动操作：

```bash
# 1. 启动 API 服务器
npm run api

# 2. 另开终端，运行 ChatGPT 上传
npm run run:chatgpt -- --file /path/to/image.png --prompt "请描述这张图片"
```

**支持的参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--file` | 文件路径（支持 png/jpg/pdf 等） | `output/gemini-cdp-result.png` |
| `--prompt` | 提示词 | `"请用中文描述这张图片的内容"` |
| `--timeout` | 等待回复超时（毫秒） | `120000` |

**示例：**
```bash
npm run run:chatgpt
npm run run:chatgpt -- --file screenshot.png --prompt "分析这个产品页面"
npm run run:chatgpt -- --file report.pdf --prompt "总结这份报告" --timeout 180000
```

---

## 手动启动流程（备选）

### 第一步：启动 Chrome（调试模式）

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.node-plawright-test/chrome-profile/automation" \
  --no-first-run --no-default-browser-check \
  "https://chatgpt.com/"
```

**参数说明：**

| 参数 | 作用 |
|------|------|
| `--remote-debugging-port=9222` | 开启 CDP 调试端口，Playwright 通过此端口连接 |
| `--user-data-dir=...` | 指定浏览器数据目录，保存登录状态 |
| `--no-first-run` | 跳过 Chrome 首次启动引导页 |
| `--no-default-browser-check` | 跳过"设为默认浏览器"提示 |
| `"https://chatgpt.com/"` | 启动时直接打开 ChatGPT |

**重要：必须用完整路径直接执行 Chrome 二进制文件，不能用 `open -a` 命令。**

原因：`open -a` 如果 Chrome 已在运行，会复用已有进程，忽略所有新参数。

### 第二步：手动登录 ChatGPT（仅首次）

1. 在打开的 Chrome 窗口中登录 ChatGPT 账号
2. 完成人机验证（如果出现）
3. 登录状态自动保存到 `automation` 目录
4. 之后无需重复登录

### 第三步：启动 API 服务器

```bash
cd /Users/clearzero22/development/ai/01_amazon_projects/node_plawright_test/quick-test
npm run api
```

验证服务器启动成功：

```bash
curl http://localhost:3456/api/health
# 期望返回: {"status":"ok","db":true,"ai":true,...}
```

### 第四步：调用 ChatGPT 服务

```bash
curl -X POST http://localhost:3456/api/chatgpt/upload \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/path/to/your/image.png",
    "prompt": "请分析这张图片的内容",
    "responseTimeout": 120000
  }'
```

**成功响应示例：**

```json
{
  "success": true,
  "prompt": "请分析这张图片的内容",
  "response": "这张图片展示了一个产品页面...",
  "fileUploaded": true,
  "filePath": "/path/to/your/image.png",
  "timestamp": "2026-04-29T20:10:20.793Z"
}
```

---

## API 接口文档

### POST /api/chatgpt/upload

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| filePath | string | ✅ | 文件绝对路径（支持 png/jpg/pdf 等） |
| prompt | string | ✅ | 提示词文本 |
| responseTimeout | number | ❌ | 等待回复超时（毫秒，默认 60000） |

> 注意：`headless` 参数在此服务中无效，始终使用真实 Chrome 窗口。

---

## 代码调用链路

```
HTTP 请求 → api-server.ts:688
                ↓
        ChatGPTFileService.upload()
                ↓
        ┌──────────────────────────────────────┐
        │ 1. ensureChromeCDP()                  │  ← 通过 WebSocket 连接 Chrome:9222
        │    获取 ws:// URL → connectOverCDP()  │
        │                                       │
        │ 2. page.goto('chatgpt.com')          │  ← 如果当前不在 ChatGPT 则导航
        │    检查是否需要登录/验证              │
        │                                       │
        │ 3. fileInput.setInputFiles(filePath)  │  ← 上传文件到输入框
        │                                       │
        │ 4. textbox.fill(prompt)              │  ← 输入提示词
        │    textbox.press('Enter')            │  ← 按回车发送
        │                                       │
        │ 5. waitForSelector('assistant')      │  ← 等待 AI 回复
        │                                       │
        │ 6. lastResponse.innerText()          │  ← 获取回复内容
        └──────────────────────────────────────┘
                ↓
        返回 JSON 结果
```

**核心文件：**
- API 入口：`src/api-server.ts`（第 688 行）
- 服务实现：`src/services/chatgpt-file-service.ts`

---

## 浏览器数据目录

所有服务统一使用：
```
~/.node-plawright-test/chrome-profile/automation
```

此目录保存：
- Chrome 配置文件
- Cookie 和登录状态
- 浏览器缓存

---

## 注意事项

1. **不要关闭 Chrome 窗口** — API 通过 CDP 远程控制它
2. **Chrome 必须带 `--remote-debugging-port=9222` 启动** — 否则 API 连不上
3. **登录状态持久化** — 除非清除 `automation` 目录，否则不用重复登录
4. **系统代理问题** — 如果你用了 `http_proxy` 代理，API 内部已通过 WebSocket URL 绕过代理访问 CDP 端口，不影响使用
5. **同时只能有一个 Chrome 实例使用该数据目录** — 多个实例会冲突

---

## 故障排除

### Chrome 启动后 API 连不上

```bash
# 检查 CDP 端口是否正常
curl --noproxy '*' http://localhost:9222/json/version
```

如果被代理拦截返回 502，说明系统代理干扰。API 内部已处理此问题。

### 页面卡在"请验证你是真人"

在 Chrome 窗口中手动完成验证，登录状态会保存。

### "文本框加载超时"

可能原因：
- ChatGPT 页面未完全加载
- 需要重新登录
- 网络连接问题

解决：在 Chrome 窗口中手动刷新 ChatGPT 页面。

### Chrome 端口被占用

```bash
# 查看 9222 端口占用
lsof -i:9222

# 关闭占用进程
lsof -ti:9222 | xargs kill -9
```

### API 服务器启动失败

```bash
# 检查 3456 端口
lsof -ti:3456 | xargs kill -9
# 重新启动
npm run api
```

---

**最后更新：** 2026-04-30
**测试环境：** macOS + Chrome 147 + Playwright + Node.js 22
