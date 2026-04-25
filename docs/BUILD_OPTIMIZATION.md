# 构建与部署优化说明

## 优化内容

### 1. 构建脚本优化

**之前的问题：**
- 使用内联 Node.js 命令复制文件，难以维护和调试
- 脚本重复，违反 DRY 原则

**优化后：**
```json
{
  "scripts": {
    "build:ts": "tsc -p tsconfig.electron.json",
    "build:copy": "copyfiles electron/renderer/* dist/electron/renderer -u 1",
    "electron:dev": "npm run build:ts && npm run build:copy && electron .",
    "electron:build": "npm run build:ts && npm run build:copy && electron-builder",
    "electron:build:portable": "npm run build:ts && npm run build:copy && electron-builder --win portable",
    "prebuild": "npm run build:ts && npm run build:copy"
  }
}
```

**优点：**
- 使用 `copyfiles` 专业工具替代内联脚本
- 脚本模块化，便于维护和调试
- 添加 `prebuild` 钩子确保构建顺序正确
- 遵循 DRY 原则，消除重复代码

### 2. 图标资源配置

**添加的文件：**
- `build/icon.ico` - Windows 图标
- `build/icon.icns` - macOS 图标
- `build/icon.png` - Linux 图标

**配置更新：**
```json
{
  "build": {
    "win": {
      "icon": "build/icon.ico"
    },
    "mac": {
      "icon": "build/icon.icns"
    },
    "linux": {
      "icon": "build/icon.png"
    }
  }
}
```

### 3. 浏览器版本信息优化

**之前的问题：**
- 版本信息硬编码在 `browser-manager.ts`
- 难以维护和更新

**优化后：**
```typescript
function getBrowserInfo() {
  const revision = process.env.PLAYWRIGHT_CHROMIUM_REVISION
    ? parseInt(process.env.PLAYWRIGHT_CHROMIUM_REVISION, 10)
    : 1217;

  const version = process.env.PLAYWRIGHT_CHROMIUM_VERSION || '147.0.7727.15';

  return {
    revision,
    version,
    getUrl: () => `https://cdn.playwright.dev/builds/cft/${version}/win64/chrome-win64.zip`,
  };
}
```

**优点：**
- 支持通过环境变量配置版本
- 便于不同环境使用不同版本
- 保持向后兼容性

## 使用方法

### 开发环境
```bash
npm run electron:dev
```

### 生产构建
```bash
npm run electron:build
```

### 构建 Portable 版本
```bash
npm run electron:build:portable
```

### 单独编译 TypeScript
```bash
npm run build:ts
```

### 单独复制静态文件
```bash
npm run build:copy
```

## 环境变量配置

可通过环境变量自定义 Playwright Chromium 版本：

```bash
# Windows PowerShell
$env:PLAYWRIGHT_CHROMIUM_REVISION="1217"
$env:PLAYWRIGHT_CHROMIUM_VERSION="147.0.7727.15"

# Linux/macOS
export PLAYWRIGHT_CHROMIUM_REVISION=1217
export PLAYWRIGHT_CHROMIUM_VERSION=147.0.7727.15
```

## 构建产物

构建后的文件位于：
- `dist/` - 编译后的代码
- `release/` - 打包后的安装程序

## 注意事项

1. 首次构建前确保已安装依赖：`npm install`
2. 图标文件已从 `logo_script/` 复制到 `build/` 目录
3. 构建产物已添加到 `.gitignore`
