# node_plawright_test

Playwright 浏览器自动化项目。

## 快速开始

```bash
npm install
npx playwright install
```

## 运行 Demo

```bash
# 使用 Playwright Chromium
npx tsx automation_demo.ts

# 使用本地 Chrome
npx tsx automation_demo_local_chrome.ts
```

## 运行测试

```bash
npx playwright test
npx playwright test --headed      # 显示浏览器窗口
npx playwright test --ui          # UI 模式
npx playwright show-report        # 查看报告
```

## 项目结构

```
├── src/           # 自动化源码（待扩展）
├── amazon_test/   # Playwright 测试用例
├── docs/          # 文档
│   ├── 01_运行自动化操作的程序内容.md
│   ├── 02_复杂网页自动化程序设计指南.md
│   └── 03_项目目录架构设计.md
├── automation_demo.ts               # Chromium Demo
├── automation_demo_local_chrome.ts  # 本地 Chrome Demo
└── playwright.config.ts             # Playwright 配置
```

## 技术栈

- [Playwright](https://playwright.dev/) — 浏览器自动化
- TypeScript
- Chromium / Firefox / WebKit

## 文档

详见 [docs/](docs/) 目录。
