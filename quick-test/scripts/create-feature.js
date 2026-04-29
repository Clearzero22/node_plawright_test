#!/usr/bin/env node

/**
 * 创建新功能脚本
 *
 * 使用方法：
 * node scripts/create-feature.js <feature-name> <url>
 *
 * 示例：
 * node scripts/create-feature.js example https://example.com
 */

const fs = require('fs');
const path = require('path');

// 获取命令行参数
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('❌ 错误：缺少参数');
  console.log('用法: node create-feature.js <feature-name> <url>');
  console.log('示例: node create-feature.js example https://example.com');
  process.exit(1);
}

const featureName = args[0];
const url = args[1];
const displayName = args[2] || featureName;

console.log(`🚀 创建新功能: ${featureName}`);
console.log(`📌 URL: ${url}`);

// 1. 创建测试脚本
const testScript = `import { launchPersistent, getPageFromContext, log, sleep, checkLoginStatus, screenshot } from './utils';

async function test() {
  log('🚀 开始测试 ${displayName}...', 'info');

  try {
    const context = await launchPersistent();
    log('✅ 浏览器已启动（持久化模式）', 'success');

    const page = await getPageFromContext(context);

    log('🌐 正在打开 ${url}...', 'info');
    await page.goto('${url}', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    const title = await page.title();
    log('📄 页面标题: "' + (title || '(空)') + '"', 'info');

    await sleep(2000);

    const isLoggedIn = await checkLoginStatus(page, '${url}');
    if (isLoggedIn) {
      log('✅ 登录状态: 已登录', 'success');
    } else {
      log('⚠️  登录状态: 未登录', 'warning');
    }

    await screenshot(page, '${featureName}');
    log('📸 截图已保存: output/${featureName}.png', 'info');

    log('✅ ${displayName} 测试完成！', 'success');
    log('💡 浏览器保持打开状态，您可以继续操作', 'info');

    await new Promise(() => {});

  } catch (error: any) {
    log('❌ 测试失败: ' + error.message, 'error');
    process.exit(1);
  }
}

test();
`;

// 2. 创建功能文档
const featureDoc = `# ${displayName} 功能文档

## 📝 功能描述
自动化访问${displayName}网站，支持登录状态持久化和基本操作。

## 🌐 URL
- 主网站：${url}

## 🔐 登录检测逻辑

### 已登录标识
- TODO: 添加已登录标识

### 未登录标识
- TODO: 添加未登录标识

### 检测代码
\`\`\`typescript
if (url.includes('${url}')) {
  // TODO: 添加检测逻辑
  return false;
}
\`\`\`

## 📊 开发状态

- [x] 基础访问
- [ ] 登录检测
- [ ] 数据持久化
- [ ] 截图功能

## 🧪 测试记录

### 初始测试
- **测试时间：** 待测试
- **页面标题：** 待测试
- **登录状态：** 待测试
- **状态：** 待测试

## 🎯 验收标准

- [ ] 页面正常加载
- [ ] 登录状态正确检测
- [ ] 手动登录后状态持久化
- [ ] 截图正常生成

## ⚠️ 已知问题
目前无已知问题。

## 💡 使用说明

### 首次使用
1. 运行测试：\`npm run test:${featureName}\`
2. 在打开的浏览器中手动登录
3. 关闭浏览器
4. 重新运行测试，应显示"已登录"

### 日常使用
- 直接运行测试即可自动登录

## 📁 相关文件

- 测试脚本：\`src/test-${featureName}.ts\`
- 用户数据：\`C:\\Users\\admin\\AppData\\Roaming\\node_plawright_test\\chromium-profile\`
- 截图输出：\`output/${featureName}.png\`

## 🔄 更新历史

- ${new Date().toISOString().split('T')[0]}：初始版本

---

**最后更新：** ${new Date().toISOString().split('T')[0]}
**维护者：** 开发团队
`;

// 创建文件
const files = [
  { path: `src/test-${featureName}.ts`, content: testScript },
  { path: `features/${featureName}.md`, content: featureDoc }
];

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file.path);
  fs.writeFileSync(filePath, file.content);
  console.log(`✅ 已创建: ${file.path}`);
});

// 更新package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = require(packageJsonPath);

const scriptName = `test:${featureName}`;
if (!packageJson.scripts[scriptName]) {
  packageJson.scripts[scriptName] = `tsx src/test-${featureName}.ts`;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(`✅ 已更新: package.json (添加 ${scriptName} 脚本)`);
}

// 更新generate.ts
const generatePath = path.join(__dirname, '..', 'src', 'generate.ts');
let generateContent = fs.readFileSync(generatePath, 'utf8');

// 检查是否已存在
if (!generateContent.includes(`'${featureName}'`)) {
  // 找到sites数组的位置
  const sitesStart = generateContent.indexOf('const sites: Site[] = [');
  const sitesEnd = generateContent.indexOf('];', sitesStart);

  if (sitesStart !== -1 && sitesEnd !== -1) {
    const newSite = `  { name: '${featureName}', url: '${url}', displayName: '${displayName}' },`;

    // 在数组最后一个元素前添加新元素
    const insertPos = generateContent.lastIndexOf('];', sitesEnd);
    generateContent =
      generateContent.slice(0, insertPos) +
      newSite +
      '\n' +
      generateContent.slice(insertPos);

    fs.writeFileSync(generatePath, generateContent);
    console.log(`✅ 已更新: src/generate.ts (添加 ${featureName} 配置)`);
  }
}

console.log('\n🎉 功能创建完成！');
console.log('\n📝 下一步操作：');
console.log(`1. 编辑 src/utils.ts 添加 ${displayName} 的登录检测逻辑`);
console.log(`2. 运行测试: npm run test:${featureName}`);
console.log(`3. 在浏览器中手动登录`);
console.log(`4. 更新 features/${featureName}.md 文档`);
