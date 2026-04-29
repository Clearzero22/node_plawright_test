# Quick Test - 快速测试框架

浏览器自动化功能的快速开发和测试框架。

## 📁 目录结构

```
quick-test/
├── src/                    # 源代码
│   ├── utils.ts           # 通用工具函数
│   ├── generate.ts        # 批量生成测试脚本
│   ├── test-all-sequential.ts  # 串行测试所有功能
│   └── test-*.ts          # 各个功能的测试脚本
├── docs/                   # 文档
│   ├── 01_开发流程.md
│   ├── 02_测试规范.md
│   ├── 03_功能检查清单.md
│   ├── 04_问题排查指南.md
│   └── 05_代码模板.md
├── features/              # 功能文档
│   ├── chatgpt.md
│   ├── seller-sprite-cn.md
│   └── ...
├── tests/                 # 测试记录
│   └── 2024-04-26_初始功能测试.md
├── templates/             # 代码模板
│   ├── test-template.ts
│   └── feature-template.md
├── scripts/               # 工具脚本
│   └── create-feature.js
├── output/                # 输出结果
│   ├── *.png             # 截图
│   └── test-results.json # 测试结果
└── README.md
```

## 🚀 快速开始

### 1. 生成所有测试脚本

```bash
npm run generate
```

### 2. 运行单个测试

```bash
npm run test:chatgpt
npm run test:seller-cn
npm run test:xiyouzhaoci
```

### 3. 运行所有测试

```bash
npm run test:all
```

### 4. 创建新功能

```bash
node scripts/create-feature.js <feature-name> <url> [display-name]

# 示例
node scripts/create-feature.js example https://example.com "示例网站"
```

## 📖 文档

- [开发流程指南](docs/01_开发流程.md) - 完整的开发流程
- [测试规范](docs/02_测试规范.md) - 测试标准和规范
- [功能检查清单](docs/03_功能检查清单.md) - 验收标准
- [问题排查指南](docs/04_问题排查指南.md) - 常见问题解决
- [代码模板](docs/05_代码模板.md) - 代码模板库

## 🎯 可用测试

| 命令 | 功能 | 网站 |
|------|------|------|
| `npm run test:chatgpt` | ChatGPT | chatgpt.com |
| `npm run test:seller-cn` | Seller Sprite中文 | sellersprite.com/cn/ |
| `npm run test:seller-int` | Seller Sprite国际 | sellersprite.com/ |
| `npm run test:xiyouzhaoci` | xiyouzhaoci | xiyouzhaoci.com |
| `npm run test:bilibili` | Bilibili | bilibili.com |
| `npm run test:taobao` | Taobao | taobao.com |
| `npm run test:all` | 所有测试 | - |
| `npm run test:multi-pages` | 单Context多Pages | 多网站并行 |
| `npm run test:parallel-ops` | 并行操作演示 | 多网站并行操作 |

## 🔧 工具函数

- `launchPersistent()` - 启动持久化浏览器
- `connectCDP()` - 连接CDP模式
- `getPageFromContext()` - 获取页面
- `screenshot()` - 截图保存
- `checkLoginStatus()` - 检查登录状态
- `log()` - 彩色日志输出
- `sleep()` - 等待函数

## 📊 测试结果

查看最新的测试结果：

```bash
# 查看JSON结果
cat output/test-results.json

# 查看测试报告
cat tests/2024-04-26_初始功能测试.md
```

## 💾 数据持久化

**用户数据目录：**
```
C:\Users\admin\AppData\Roaming\node_plawright_test\chromium-profile
```

**特点：**
- ✅ 自动保存登录状态
- ✅ 与Electron应用共享数据
- ✅ 支持Cookie和LocalStorage
- ✅ 首次登录后自动保持

## 🛠️ 开发新功能

### 方式1：使用生成器（推荐）

```bash
node scripts/create-feature.js mysite https://example.com "我的网站"
```

### 方式2：手动创建

1. 复制模板：`cp templates/test-template.ts src/test-mysite.ts`
2. 修改配置：URL、功能名称等
3. 添加登录检测：编辑 `src/utils.ts`
4. 运行测试：`npx tsx src/test-mysite.ts`

## ✅ 验收标准

功能开发完成后应满足：

- [ ] 页面能正常访问
- [ ] 登录状态正确检测
- [ ] 数据持久化正常工作
- [ ] 截图功能正常
- [ ] 文档完整
- [ ] 测试通过

## 🐛 常见问题

### Chrome进程冲突
```bash
# 关闭所有Chrome进程
taskkill /F /IM chrome.exe
```

### 登录状态检测失败
- 检查元素选择器是否正确
- 增加等待时间
- 查看问题排查指南

### 端口被占用
```bash
# 查看9222端口占用
netstat -ano | findstr :9222
```

## 📞 获取帮助

- 查看 [问题排查指南](docs/04_问题排查指南.md)
- 查看 [代码模板](docs/05_代码模板.md)
- 查看功能文档 `features/*.md`

## 🎉 最新测试结果

**测试日期：** 2024-04-26

| 功能 | 状态 | 登录状态 | 耗时 |
|------|------|----------|------|
| ChatGPT | ✅ | 未登录 | 3.8秒 |
| Seller Sprite中文 | ✅ | 未登录 | 3.6秒 |
| Seller Sprite国际 | ✅ | 未登录 | 3.9秒 |
| xiyouzhaoci | ✅ | 未登录 | 3.6秒 |
| Bilibili | ✅ | 未登录 | 3.6秒 |
| Taobao | ✅ | 已登录 | 3.3秒 |

**成功率：** 6/6 (100%)

---

**最后更新：** 2024-04-26
**版本：** v1.0.0
