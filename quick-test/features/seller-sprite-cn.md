# Seller Sprite 中文 功能文档

## 📝 功能描述

自动化访问卖家精灵中文网站，支持登录状态持久化和基本操作。

## 🌐 URL

- 中文网站：https://www.sellersprite.com/cn/
- 国际网站：https://www.sellersprite.com/

## 🔐 登录检测逻辑

### 已登录标识
- `.user-info` - 用户信息区域
- `.user-dropdown` - 用户下拉菜单
- `[class*="user"]` - 包含user的class
- `[class*="account"]` - 包含account的class

### 未登录标识
- `a[href*="login"]` - 登录链接
- `a[href*="signin"]` - 登录链接
- `.btn-login` - 登录按钮

### 检测代码
```typescript
if (url.includes('sellersprite.com')) {
  const userMenu = await page.$('.user-dropdown, .user-info, [class*="user"], [class*="account"]');
  const loginButton = await page.$('a[href*="login"], a[href*="signin"], .btn-login');
  return !!userMenu && !loginButton;
}
```

## 📊 开发状态

- [x] 基础访问
- [x] 登录检测
- [x] 数据持久化
- [x] 截图功能
- [ ] 数据查询功能
- [ ] 报告生成
- [ ] 关键词搜索

## 🧪 测试记录

### 2024-04-26 初始测试
- **测试时间：** 18:22
- **页面标题：** 卖家精灵官网 - 170万亚马逊卖家的选品及关键词工具
- **登录状态：** 未登录
- **耗时：** 3.6秒
- **截图：** output/seller-sprite-cn.png
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
1. 运行测试：`npm run test:seller-cn`
2. 在打开的浏览器中手动登录卖家精灵
3. 关闭浏览器
4. 重新运行测试，应显示"已登录"

### 日常使用
- 直接运行测试即可自动登录
- 登录状态保存在用户数据目录中

## 📁 相关文件

- 测试脚本：`src/test-seller-sprite-cn.ts`
- 用户数据：`C:\Users\admin\AppData\Roaming\node_plawright_test\chromium-profile`
- 截图输出：`output/seller-sprite-cn.png`

## 🔗 相关功能

- Seller Sprite国际版：`seller-sprite-int.md`
- xiyouzhaoci：`xiyouzhaoci.md`

## 🔄 更新历史

- 2024-04-26：初始版本，基础访问和登录检测
- 待更新：添加数据查询功能

---

**最后更新：** 2024-04-26
**维护者：** 开发团队
