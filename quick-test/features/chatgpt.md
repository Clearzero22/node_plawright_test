# ChatGPT 功能文档

## 📝 功能描述

自动化访问ChatGPT网站，支持登录状态持久化和基本操作。

## 🌐 URL

- 主网站：https://chatgpt.com/
- 备用URL：https://chat.openai.com/

## 🔐 登录检测逻辑

### 已登录标识
- `[data-testid="profile-button"]` - 用户头像按钮
- `.avatar` - 头像元素

### 未登录标识
- `[data-testid="login-button"]` - 登录按钮
- `a[href*="/login"]` - 登录链接

### 检测代码
```typescript
if (url.includes('chatgpt.com')) {
  const avatar = await page.$('[data-testid="profile-button"], .avatar');
  const loginButton = await page.$('[data-testid="login-button"], a[href*="/login"]');
  return !!avatar && !loginButton;
}
```

## 📊 开发状态

- [x] 基础访问
- [x] 登录检测
- [x] 数据持久化
- [x] 截图功能
- [ ] 消息发送
- [ ] 历史记录获取
- [ ] 文件上传

## 🧪 测试记录

### 2024-04-26 初始测试
- **测试时间：** 18:19
- **页面标题：** ChatGPT
- **登录状态：** 未登录
- **耗时：** 3.8秒
- **截图：** output/chatgpt.png
- **状态：** ✅ 通过

### 测试环境
- 操作系统：Windows 10
- Chrome版本：147.0.7727.102
- Node.js版本：v18.x
- Playwright版本：最新

## 🎯 验收标准

- [ ] 页面正常加载
- [ ] 登录状态正确检测
- [ ] 手动登录后状态持久化
- [ ] 截图正常生成
- [ ] 浏览器正常关闭

## ⚠️ 已知问题

目前无已知问题。

## 💡 使用说明

### 首次使用
1. 运行测试：`npm run test:chatgpt`
2. 在打开的浏览器中手动登录ChatGPT
3. 关闭浏览器
4. 重新运行测试，应显示"已登录"

### 日常使用
- 直接运行测试即可自动登录
- 登录状态保存在用户数据目录中

## 📁 相关文件

- 测试脚本：`src/test-chatgpt.ts`
- 用户数据：`C:\Users\admin\AppData\Roaming\node_plawright_test\chromium-profile`
- 截图输出：`output/chatgpt.png`

## 🔄 更新历史

- 2024-04-26：初始版本，基础访问和登录检测
- 待更新：添加消息发送功能

---

**最后更新：** 2024-04-26
**维护者：** 开发团队
