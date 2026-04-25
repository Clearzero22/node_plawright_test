# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Playwright browser automation project** for web scraping, testing, and automated operations. The project supports two execution modes:

1. **Test Mode** - Using `@playwright/test` framework for automated testing with assertions
2. **Automation Mode** - Using `playwright` directly for scripts requiring manual browser management (scraping, batch operations)

## Environment Setup

**First-time setup:**
```bash
npm install
npx playwright install
```

This installs project dependencies and downloads browser binaries (Chromium, Firefox, WebKit).

## Running Tests

All tests are in `./amazon_test/` directory.

```bash
# Run all tests
npx playwright test

# Run with visible browser
npx playwright test --headed

# Interactive UI mode
npx playwright test --ui

# Debug mode with inspector
npx playwright test --debug

# View HTML test report
npx playwright show-report

# Run specific browser project
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Running Automation Scripts

For standalone automation scripts (e.g., `automation_demo.ts`):

```bash
npx tsx automation_demo.ts
```

## Architecture

The planned directory structure (see `docs/03_项目目录架构设计.md`):

```
src/
├── core/           # Browser management, config loading, logging
├── modules/        # Business logic modules (login, scraping, forms)
├── utils/          # Utility functions (wait, screenshot, storage)
└── main.ts         # Entry point
```

Current state: Demo scripts exist at root (`automation_demo.ts`, `automation_demo_local_chrome.ts`). Production code should move into `src/` structure following the planned architecture.

## Key Configuration

- **Test directory:** `./amazon_test/` (configured in `playwright.config.ts`)
- **Browser projects:** Chromium, Firefox, WebKit (Desktop Chrome, Desktop Firefox, Desktop Safari)
- **Reporter:** HTML (generates report in `playwright-report/`)
- **Trace:** Enabled on first retry for debugging

## Important Notes

- **Output files:** Screenshots and data exports go to `output/` (gitignored)
- **Sensitive data:** Use `.env` file for credentials (not committed to git)
- **Headless mode:** Test mode defaults to headless, automation scripts can set `headless: false` for debugging
- **Element waiting:** Playwright auto-waits for elements, but complex pages may need explicit waits (`waitForSelector`, `waitForLoadState`)
