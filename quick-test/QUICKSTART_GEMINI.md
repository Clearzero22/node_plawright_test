# Gemini 文件上传自动化指南

## 📚 快速开始

这个指南演示如何自动化向 Gemini 上传文件、发送提示词并保存回复。

## 🚀 运行测试

```bash
cd quick-test
npm run test:gemini:upload
```

## 📋 功能特性

本测试脚本会自动完成以下操作：

1. ✅ 访问 Gemini 网站
2. ✅ 点击"+"号按钮打开上传菜单
3. ✅ 点击"上传文件"菜单项
4. ✅ 选择并上传本地文件
5. ✅ 输入提示词
6. ✅ 发送消息（使用回车键）
7. ✅ 等待 AI 回复
8. ✅ 复制并保存回复内容到 JSON 文件

## 🎯 成功案例

**测试结果示例：**
```
✅ 文件已上传: logo.png
✅ 消息已发送: "这个是什么？"
✅ 收到回复: "这张图片是一个结合了多种科技元素的 Logo（标志）设计..."
✅ 已保存: output/gemini-upload-2026-04-26T17-19-04.json
```

## 🔧 核心技术

### 两步上传流程

Gemini 的文件上传需要两步操作：

```typescript
// 步骤1: 点击+号按钮
const uploadButton = page.locator('uploader >> button >> .mat-mdc-button-touch-target');
await uploadButton.click();

// 步骤2: 点击"上传文件"菜单项
const uploadMenuItem = page.locator('[data-test-id="local-images-files-uploader-button"]');
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  uploadMenuItem.click()
]);
await fileChooser.setFiles(imagePath);
```

### 关键选择器

| 元素 | 选择器 |
|------|--------|
| +号按钮 | `uploader >> button >> .mat-mdc-button-touch-target` |
| 上传文件菜单 | `[data-test-id="local-images-files-uploader-button"]` |
| 文本输入框 | `getByRole('textbox', { name: '为 Gemini 输入提示' })` |
| 发送按钮 | 使用 `Enter` 键代替 |

## 📝 自定义配置

### 修改上传文件

编辑 `src/test-gemini-file-upload.ts`：

```typescript
// 修改文件路径
const imagePath = path.join(__dirname, '../../your-file.png');

// 或使用绝对路径
const imagePath = 'C:/path/to/your/file.jpg';

// 支持多种文件类型
const imagePath = 'document.pdf';         // PDF 文档
const imagePath = 'data.xlsx';            // Excel 表格
const imagePath = 'code.py';              // 代码文件
```

### 修改提示词

```typescript
// 修改这一行
const prompt = '这个是什么？';

// 自定义提示词示例
const prompt = '请分析这张图片的设计风格和色彩搭配';
const prompt = '提取这个PDF文档中的关键信息';
const prompt = '请帮我优化这段代码';
```

### 多文件上传

```typescript
// 上传多个文件
const files = [
  'image1.png',
  'image2.jpg',
  'document.pdf'
];

for (const file of files) {
  // 执行上传流程
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    uploadMenuItem.click()
  ]);
  await fileChooser.setFiles(file);
  await sleep(1000);
}
```

## 🎯 实际应用场景

### 场景1：批量图片分析

```typescript
const images = ['logo1.png', 'logo2.png', 'logo3.png'];
const results = [];

for (const img of images) {
  // 上传图片
  await uploadFile(img);
  
  // 发送分析请求
  await sendPrompt('请描述这个logo的设计特点');
  
  // 保存结果
  const response = await getResponse();
  results.push({ image: img, analysis: response });
}

// 保存所有结果
fs.writeFileSync('batch-results.json', JSON.stringify(results, null, 2));
```

### 场景2：文档问答

```typescript
// 上传文档
await uploadFile('product-catalog.pdf');

// 询问问题
const questions = [
  '这个文档的主要产品有哪些？',
  '最贵的产品价格是多少？',
  '有没有促销活动？'
];

for (const question of questions) {
  await sendPrompt(question);
  const answer = await getResponse();
  console.log(`Q: ${question}\nA: ${answer}\n`);
}
```

### 场景3：代码审查

```typescript
// 上传代码文件
await uploadFile('app.js');

// 请求代码审查
await sendPrompt('请审查这段代码，指出潜在问题和改进建议');

// 获取详细建议
const review = await getResponse();

// 保存审查报告
fs.writeFileSync('code-review.txt', review);
```

## 💡 高级用法

### 等待特定回复内容

```typescript
// 等待回复包含特定关键词
await page.waitForFunction(() => {
  const response = document.querySelector('[data-test-id="model-verbose-text"]');
  return response && response.textContent.includes('分析完成');
}, { timeout: 60000 });
```

### 提取结构化数据

```typescript
const response = await page.evaluate(() => {
  const element = document.querySelector('[data-test-id="model-verbose-text"]');
  return {
    text: element?.textContent,
    html: element?.innerHTML,
    timestamp: new Date().toISOString()
  };
});
```

### 处理网络错误

```typescript
try {
  await uploadFile(imagePath);
} catch (error) {
  if (error.message.includes('filechooser')) {
    log('文件选择器未触发，重试...', 'warning');
    await page.reload();
    await sleep(3000);
    await uploadFile(imagePath);
  }
}
```

## 📊 输出格式

脚本会生成 JSON 格式的输出文件：

```json
{
  "prompt": "这个是什么？",
  "response": "这张图片是一个结合了多种科技元素的 Logo（标志）设计...",
  "fileUploaded": true,
  "filePath": "E:\\...\\logo.png",
  "timestamp": "2026-04-26T17:19:04.000Z"
}
```

## ⚠️ 常见问题

### 问题1：找不到上传按钮

**解决方法：**
- 增加页面加载等待时间
- 确保已登录 Gemini
- 检查网络连接

```typescript
await sleep(5000); // 增加等待时间
```

### 问题2：filechooser 事件未触发

**解决方法：**
- 确保两步操作顺序正确
- 检查菜单是否完全展开
- 增加步骤间的等待时间

```typescript
await uploadButton.click();
await sleep(1000); // 等待菜单展开
const uploadMenuItem = page.locator('[data-test-id="local-images-files-uploader-button"]');
```

### 问题3：回复内容为空

**解决方法：**
- 增加等待回复的时间
- 检查是否需要重新登录
- 验证提示词是否合适

```typescript
await page.waitForSelector('[data-test-id="copy-button"]', {
  timeout: 90000 // 增加到90秒
});
```

## 🔗 相关资源

- **测试脚本：** `src/test-gemini-file-upload.ts`
- **调试脚本：** `src/debug-gemini.ts`
- **简单版本：** `src/test-gemini-simple.ts`（仅文本，无文件上传）
- **工具函数：** `src/utils.ts`
- **Playwright 文档：** https://playwright.dev/docs/input-upload

## 🎉 测试检查清单

- [ ] 浏览器能正常启动
- [ ] Gemini 页面能正常加载
- [ ] 已登录 Gemini 账号
- [ ] 文件路径正确且文件存在
- [ ] 网络连接稳定
- [ ] output 目录存在且有写权限

---

**最后更新：** 2026-04-27  
**维护者：** 开发团队  
**测试状态：** ✅ 已验证成功
