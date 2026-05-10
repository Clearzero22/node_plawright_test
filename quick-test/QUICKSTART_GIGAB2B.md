# GigaB2B 产品数据抓取指南

## 📚 快速开始

这个指南演示如何使用我们的quick-test框架来抓取GigaB2B网站的产品数据。

## 🚀 运行测试

```bash
cd quick-test
npm run test:gigab2b
```

## 📋 功能特性

本测试脚本会自动完成以下操作：

1. ✅ 访问GigaB2B首页
2. ✅ 搜索"Couch"产品
3. ✅ 打开指定产品页面
4. ✅ 抓取产品标题、价格、描述
5. ✅ 提取所有产品图片链接
6. ✅ 抓取产品规格信息
7. ✅ 保存数据为JSON格式
8. ✅ 保存图片链接列表
9. ✅ 生成多个截图

## 📊 输出文件

运行测试后，以下文件会生成在`output/`目录：

### 1. 产品数据 (JSON)
**文件：** `gigab2b-product-data.json`

```json
{
  "url": "https://www.gigab2b.com/index.php?route=product/product&product_id=747431",
  "title": "产品标题",
  "price": "$99.99",
  "description": "产品描述...",
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "specifications": {
    "Product Dimensions": "100x200x300cm",
    "Package Size": "110x210x310cm"
  },
  "timestamp": "2024-04-26T19:30:00.000Z"
}
```

### 2. 图片链接列表 (TXT)
**文件：** `gigab2b-image-links.txt`

```
https://example.com/image1.jpg
https://example.com/image2.jpg
https://example.com/image3.jpg
```

### 3. 截图文件
- `gigab2b-product-page.png` - 产品页面截图
- `gigab2b-image-viewer.png` - 图片查看器截图
- `gigab2b-final.png` - 最终页面截图

## 🔧 自定义抓取

### 修改产品URL

编辑`src/test-gigab2b.ts`：

```typescript
// 修改这一行
const productUrl = 'https://www.gigab2b.com/index.php?route=product/product&product_id=YOUR_PRODUCT_ID';
```

### 修改搜索关键词

```typescript
// 修改搜索关键词
const couchOption = page.getByText('YOUR_KEYWORD');
```

### 添加更多数据字段

在`page.evaluate()`函数中添加：

```typescript
// 抓取品牌信息
const brandElement = document.querySelector('.brand, [class*="brand"]');
if (brandElement) {
  data.brand = brandElement.textContent?.trim() || '';
}

// 抓取库存信息
const stockElement = document.querySelector('.stock, [class*="stock"]');
if (stockElement) {
  data.stock = stockElement.textContent?.trim() || '';
}
```

## 🎯 抓取策略

### 图片链接抓取

脚本使用多种策略抓取图片：

1. **从img标签抓取**
   ```javascript
   document.querySelectorAll('img').forEach(img => {
     const src = img.src || img.dataset.src;
     if (src && (src.includes('product') || src.includes('image'))) {
       images.push(src);
     }
   });
   ```

2. **从图库容器抓取**
   ```javascript
   document.querySelectorAll('.el-image.image-item').forEach(item => {
     const img = item.querySelector('img');
     // 获取图片链接
   });
   ```

3. **去重处理**
   ```javascript
   if (!images.includes(src)) {
     images.push(src);
   }
   ```

### 规格信息抓取

规格信息从多个来源抓取：

```javascript
const selectors = [
  '.specification-item',
  '[class*="spec-item"]',
  '.product-spec-item',
  'tr'
];
```

## 💡 高级用法

### 批量抓取多个产品

```typescript
const productIds = ['747431', '747432', '747433'];
const products = [];

for (const id of productIds) {
  const url = `https://www.gigab2b.com/index.php?route=product/product&product_id=${id}`;
  await page.goto(url);
  
  const data = await extractProductData(page);
  products.push(data);
}

// 保存所有产品数据
fs.writeFileSync('all-products.json', JSON.stringify(products, null, 2));
```

### 下载产品图片

```typescript
const https = require('https');
const http = require('http');

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(filepath);
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', (err) => reject(err));
      } else {
        reject(new Error(`Failed to download: ${url}`));
      }
    });
  });
}

// 下载所有图片
for (let i = 0; i < productData.images.length; i++) {
  const url = productData.images[i];
  const filepath = `images/product-${i}.jpg`;
  await downloadImage(url, filepath);
  console.log(`Downloaded: ${filepath}`);
}
```

### 并发抓取多个页面

```typescript
const urls = [
  'https://www.gigab2b.com/product1',
  'https://www.gigab2b.com/product2',
  'https://www.gigab2b.com/product3'
];

// 创建多个页面
const pages = await Promise.all(
  urls.map(() => context.newPage())
);

// 并发访问
await Promise.all(
  pages.map((page, index) => page.goto(urls[index]))
);

// 并发抓取数据
const products = await Promise.all(
  pages.map(page => page.evaluate(() => extractProductData()))
);
```

## ⚠️ 常见问题

### 问题1：元素找不到

**解决方法：**
```typescript
// 增加等待时间
await page.waitForSelector('.selector', { timeout: 10000 });

// 或者等待页面稳定
await page.waitForLoadState('networkidle');
```

### 问题2：图片链接不完整

**解决方法：**
```typescript
// 处理相对路径
if (src.startsWith('/')) {
  src = new URL(src, 'https://www.gigab2b.com').href;
}

// 处理data-src
const imgSrc = img.src || img.dataset.src || img.dataset.original;
```

### 问题3：规格信息抓取不全

**解决方法：**
```typescript
// 点击展开所有规格
const specItems = await page.$$('.spec-item');
for (const item of specItems) {
  await item.click();
  await sleep(100);
}
```

## 📝 最佳实践

1. **错误处理**
   ```typescript
   try {
     await page.click('.button');
   } catch (error) {
     console.log('按钮点击失败，使用备用方法');
     await page.evaluate(() => document.querySelector('.button').click());
   }
   ```

2. **性能优化**
   ```typescript
   // 禁用图片加载以提升速度
   await page.route('**/*.{png,jpg,jpeg}', route => route.abort());
   ```

3. **数据验证**
   ```typescript
   if (!productData.title) {
     log('⚠️ 未能抓取产品标题', 'warning');
   }
   ```

## 🔗 相关资源

- **测试脚本：** `src/test-gigab2b.ts`
- **工具函数：** `src/utils.ts`
- **开发文档：** `docs/01_开发流程.md`
- **问题排查：** `docs/04_问题排查指南.md`

## 🎉 下一步

1. 运行测试：`npm run test:gigab2b`
2. 查看输出文件：`output/`
3. 自定义抓取逻辑
4. 扩展功能以适应你的需求

---

**最后更新：** 2024-04-26
**维护者：** 开发团队
