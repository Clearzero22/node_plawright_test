# 项目命令参考

## 项目结构

- 测试目录：`./amazon_test/`（包含 `example.spec.ts`）
- 配置文件：`playwright.config.ts`
- 浏览器配置：Chromium、Firefox、WebKit

## 可用命令

当前 `package.json` 未定义 scripts，需通过 `npx playwright` 直接运行：

| 命令 | 说明 |
|------|------|
| `npx playwright test` | 运行所有测试 |
| `npx playwright test --project=chromium` | 仅运行 Chromium 测试 |
| `npx playwright test --project=firefox` | 仅运行 Firefox 测试 |
| `npx playwright test --project=webkit` | 仅运行 WebKit 测试 |
| `npx playwright test --headed` | 带可见浏览器运行测试 |
| `npx playwright test --debug` | 调试模式运行测试 |
| `npx playwright test --ui` | UI 模式运行测试（交互式） |
| `npx playwright show-report` | 打开 HTML 测试报告 |
| `npx playwright install` | 安装浏览器二进制文件 |

## 可选：添加到 package.json scripts

为方便使用，可在 `package.json` 中添加：

```json
"scripts": {
  "test": "npx playwright test",
  "test:headed": "npx playwright test --headed",
  "test:ui": "npx playwright test --ui",
  "test:report": "npx playwright show-report"
}
```

添加后即可使用 `npm run test`、`npm run test:ui` 等命令。
