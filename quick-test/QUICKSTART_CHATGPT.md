# ChatGPT 文件上传自动化指南

## 📚 快速开始

这个指南演示如何自动化向 ChatGPT 上传文件并发送消息。

## 🚀 运行测试

```bash
cd quick-test
npm run test:chatgpt:upload
```

## 📋 功能特性

本测试脚本会自动完成以下操作：

1. ✅ 访问 ChatGPT 网站
2. ✅ 直接上传本地文件（无需手动点击按钮）
3. ✅ 输入文本消息
4. ✅ 点击发送按钮
5. ✅ 保持浏览器打开查看回复

## 🔧 核心技术

### 直接文件上传

**传统方法问题：**
- 需要点击附件按钮
- 需要选择上传类型
- 依赖 UI 元素，容易失败

**自动化解决方案：**
```typescript
// 方法1：通过隐藏的文件输入框
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(filePath);
```

### 文件选择器事件

```typescript
// 方法2：使用 FileChooser 事件
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.getByTestId('composer-plus-btn').click()
]);
await fileChooser.setFiles(imagePath);
```

## 📝 自定义配置

### 修改上传文件

编辑 `src/test-chatgpt-upload.ts`：

```typescript
// 修改文件路径
const imagePath = path.join(__dirname, '../../your-file.png');

// 或者使用绝对路径
const imagePath = 'C:/path/to/your/file.jpg';

// 或者使用 URL（支持的网络图片）
const imageUrl = 'https://example.com/image.jpg';
```

### 修改发送消息

```typescript
// 修改这一行
await textbox.fill('你的自定义消息');

// 或者多行消息
await textbox.fill('第一行\n第二行\n第三行');
```

### 支持的文件类型

```typescript
// 图片文件
const imagePath = 'logo.png';           // PNG
const imagePath = 'photo.jpg';          // JPEG
const imagePath = 'image.gif';          // GIF

// 文档文件
const docPath = 'document.pdf';         // PDF
const docPath = 'data.xlsx';            // Excel
const docPath = 'code.py';              // 代码文件

// 多文件上传
await fileInput.setInputFiles([
  'file1.jpg',
  'file2.png',
  'document.pdf'
]);
```

## 🎯 实际应用场景

### 场景1：批量分析图片

```typescript
const images = [
  'image1.png',
  'image2.png',
  'image3.png'
];

for (const img of images) {
  // 上传图片
  await fileInput.setInputFiles(img);
  await sleep(1000);

  // 发送分析请求
  await textbox.fill('请分析这张图片');
  await sendButton.click();

  // 等待回复
  await sleep(5000);
}
```

### 场景2：代码审查助手

```typescript
// 上传代码文件
await fileInput.setInputFiles('app.js');

// 发送审查请求
await textbox.fill('请帮我审查这段代码，找出潜在问题和改进建议');
await sendButton.click();
```

### 场景3：文档翻译

```typescript
// 上传文档
await fileInput.setInputFiles('document.pdf');

// 发送翻译请求
await textbox.fill('请将这个文档翻译成英文，保持原有格式');
await sendButton.click();
```

## 💡 高级用法

### 自动等待文件上传完成

```typescript
// 等待文件预览出现
await page.waitForSelector('.preview-thumbnail', { timeout: 5000 });
log('✅ 文件上传完成', 'success');
```

### 验证文件是否上传成功

```typescript
// 检查文件名显示
const fileName = page.locator('.file-name');
if (await fileName.isVisible()) {
  log('✅ 文件已成功上传', 'success');
}
```

### 处理网络文件

```typescript
// 下载网络文件后再上传
const https = require('https');
const fs = require('fs');

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(filepath);
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      } else {
        reject(new Error(`Failed to download: ${url}`));
      }
    });
  });
}

// 使用
const imageUrl = 'https://example.com/image.png';
const localPath = '/tmp/downloaded.png';
await downloadFile(imageUrl, localPath);
await fileInput.setInputFiles(localPath);
```

## ⚠️ 常见问题

### 问题1：文件路径找不到

**解决方法：**
```typescript
// 使用绝对路径
const imagePath = 'C:\\full\\path\\to\\file.png';

// 或者使用 path.resolve
const imagePath = path.resolve(__dirname, '../../file.png');
```

### 问题2：文件太大上传失败

**解决方法：**
```typescript
// 压缩图片
const sharp = require('sharp');
await sharp(inputPath)
  .resize(1024, 1024, { fit: 'inside' })
  .jpeg({ quality: 80 })
  .toFile(outputPath);

// 然后上传压缩后的文件
await fileInput.setInputFiles(outputPath);
```

### 问题3：ChatGPT 未登录

**解决方法：**
```typescript
// 使用持久化浏览器
const context = await launchPersistent();

// 首次运行会打开浏览器，手动登录一次
// 之后会保存登录状态
```

## 📊 完整示例

```typescript
import { launchPersistent, getPageFromContext, log, sleep } from './utils';
import * as path from 'path';

async function chatGPTWithFile() {
  const context = await launchPersistent();
  const page = await getPageFromContext(context);

  // 访问 ChatGPT
  await page.goto('https://chatgpt.com/');
  await sleep(3000);

  // 上传文件
  const imagePath = path.join(__dirname, '../../logo.png');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(imagePath);

  // 输入消息
  const textbox = page.getByRole('textbox', { name: 'Chat with ChatGPT' });
  await textbox.fill('这是什么？');
  await sleep(1000);

  // 发送
  await page.getByTestId('send-button').click();

  // 保持打开
  await new Promise(() => {});
}
```

## 🔗 相关资源

- **测试脚本：** `src/test-chatgpt-upload.ts`
- **工具函数：** `src/utils.ts`
- **Playwright 文档：** https://playwright.dev/docs/input-upload

---

**最后更新：** 2026-04-27
**维护者：** 开发团队
