这里是一份可以直接复制运行的完整 Node.js 代码（单文件）：

```javascript
// recognize.js
// 运行前执行: npm init -y && npm install openai
// 调用方式: node recognize.js

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ========== 配置 ==========
const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY, // 设置环境变量: export DASHSCOPE_API_KEY=sk-xxx
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

const MODEL = 'qwen-vl-plus'; // 可换: qwen-vl-max | qwen-vl-ocr-latest

// ========== 工具函数: 本地图片转 Base64 ==========
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function imageToBase64(imagePath) {
  const absolutePath = path.resolve(__dirname, imagePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }
  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(absolutePath).slice(1) || 'png';
  return `data:image/${ext};base64,${buffer.toString('base64')}`;
}

// ========== 核心调用 ==========
async function recognize(imageInput, prompt = '请详细描述这张图片的内容') {
  // 自动判断是 URL 还是本地路径
  const imageUrl = imageInput.startsWith('http')
    ? imageInput
    : imageToBase64(imageInput);

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    return completion.choices[0].message.content;
  } catch (err) {
    console.error('API 调用失败:', err.message);
    throw err;
  }
}

// ========== 使用示例 ==========
(async () => {
  // 示例 1: 识别网络图片
  // const result = await recognize('https://example.com/image.jpg');

  // 示例 2: 识别本地图片 (相对路径或绝对路径)
  const result = await recognize('./test.png', '提取图中所有文字');
  
  console.log('识别结果:\n', result);
})();
```

---

### 快速开始

```bash
# 1. 初始化并安装依赖
npm init -y
npm install openai

# 2. 设置 API Key
export DASHSCOPE_API_KEY=sk-your-key-here   # Linux/macOS
# set DASHSCOPE_API_KEY=sk-your-key-here    # Windows CMD

# 3. 运行
node recognize.js
```

---

### 多图批量识别（电商竞品图对比）

```javascript
async function recognizeMultiple(imagePaths, prompt) {
  const content = await Promise.all(
    imagePaths.map(async (img) => ({
      type: 'image_url',
      image_url: { url: imageToBase64(img) },
    }))
  );
  
  content.push({ type: 'text', text: prompt });

  const res = await client.chat.completions.create({
    model: 'qwen-vl-max',
    messages: [{ role: 'user', content }],
  });
  
  return res.choices[0].message.content;
}

// 使用: 传入多张竞品图让模型分析差异
// recognizeMultiple(['./product-a.jpg', './product-b.jpg'], '对比这两款产品的卖点差异');
```

---

### 纯 HTTP 版本（不装 `openai` 包）

如果你不想引入依赖，直接用 Node.js 内置 `fetch`（Node 18+）：

```javascript
async function callQwenVL(base64Image, prompt) {
  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'qwen-vl-plus',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: base64Image } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });
  
  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}
```

**关键注意点**：本地图片必须转 Base64 且带 `data:image/png;base64,` 前缀，视觉模型不支持直接传文件路径。