# 功能名称

## 📝 功能描述
简要描述功能的作用和目标

## 🌐 URL
- 主网站：https://example.com/
- 备用URL：https://backup.example.com/

## 🔐 登录检测逻辑

### 已登录标识
- `.user-info` - 用户信息区域
- `.user-menu` - 用户菜单

### 未登录标识
- `a[href*="login"]` - 登录链接
- `.btn-login` - 登录按钮

### 检测代码
```typescript
if (url.includes('example.com')) {
  const userMenu = await page.$('.user-info, .user-menu');
  const loginButton = await page.$('a[href*="login"], .btn-login');
  return !!userMenu && !loginButton;
}
```

## 📊 开发状态

- [ ] 基础访问
- [ ] 登录检测
- [ ] 数据持久化
- [ ] 截图功能
- [ ] 高级功能1
- [ ] 高级功能2

## 🧪 测试记录

### YYYY-MM-DD 测试描述
- **测试时间：** HH:MM
- **页面标题：** 页面标题
- **登录状态：** 已登录/未登录
- **耗时：** X秒
- **截图：** output/feature-name.png
- **状态：** ✅ 通过 / ❌ 失败

### 测试环境
- 操作系统：Windows 10
- Chrome版本：147.x
- Node.js版本：v18.x
- Playwright版本：最新

## 🎯 验收标准

- [ ] 页面正常加载
- [ ] 登录状态正确检测
- [ ] 手动登录后状态持久化
- [ ] 截图正常生成
- [ ] 浏览器正常关闭

## ⚠️ 已知问题
- 列出已知问题

## 💡 使用说明

### 首次使用
1. 运行测试命令
2. 在打开的浏览器中手动登录
3. 关闭浏览器
4. 重新运行测试，应显示"已登录"

### 日常使用
- 直接运行测试即可自动登录
- 登录状态保存在用户数据目录中

## 📁 相关文件

- 测试脚本：`src/test-feature-name.ts`
- 用户数据：`C:\Users\admin\AppData\Roaming\node_plawright_test\chromium-profile`
- 截图输出：`output/feature-name.png`

## 🔗 相关功能
- 相关功能1
- 相关功能2

## 🔄 更新历史

- YYYY-MM-DD：初始版本，基础访问和登录检测
- YYYY-MM-DD：添加XXX功能

---

**最后更新：** YYYY-MM-DD
**维护者：** 开发团队
