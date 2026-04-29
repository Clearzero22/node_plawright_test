# Workflow项目完整启动指南

**项目概述：**
- **前端界面：** `/Users/clearzero22/development/ai/01_amazon_projects/chatgpt_pages/implementations/dashboard/workflow-editor`
- **后端服务：** `/Users/clearzero22/development/ai/01_amazon_projects/node_plawright_test/quick-test` (端口 3456)

---

## 🚀 完整启动流程

### 1️⃣ 启动后端服务 (端口 3456)

**位置：** `/Users/clearzero22/development/ai/01_amazon_projects/node_plawright_test/quick-test`

```bash
# 进入后端目录
cd /Users/clearzero22/development/ai/01_amazon_projects/node_plawright_test/quick-test

# 启动 API 服务器
npm run api
```

**API服务包含：**
- 爬虫服务 (GigaB2B)
- AI图片识别服务
- Amazon搜索和产品抓取
- 西柚找词关键词挖掘
- 数据库管理API

**验证API运行：**
```bash
curl http://localhost:3456/api/health
```

### 2️⃣ 启动 PostgreSQL 数据库 (端口 5432)

**位置：** `/Users/clearzero22/development/ai/01_amazon_projects/node_plawright_test/quick-test`

```bash
# 启动 Docker 容器
cd /Users/clearzero22/development/ai/01_amazon_projects/node_plawright_test/quick-test
docker-compose up -d

# 检查状态
docker-compose ps
```

### 3️⃣ 启动前端界面 (端口 5173)

**位置：** `/Users/clearzero22/development/ai/01_amazon_projects/chatgpt_pages/implementations/dashboard/workflow-editor`

```bash
# 进入前端目录
cd /Users/clearzero22/development/ai/01_amazon_projects/chatgpt_pages/implementations/dashboard/workflow-editor

# 启动前端开发服务器
npm run dev
```

**访问前端界面：**
```
http://localhost:5173
```

---

## 📁 统一浏览器数据目录配置

### ⚠️ 重要原则

**所有服务必须使用统一的浏览器数据目录：**
```
~/.node-plawright-test/chrome-profile/automation
```

### 为什么需要统一目录？

1. **共享登录状态** - 所有服务共享相同的cookies和会话
2. **避免重复登录** - 登录一次，所有服务都能使用
3. **数据持久化** - 登录状态不会因为系统重启而丢失
4. **统一管理** - 集中管理所有浏览器配置和扩展

### 各服务的浏览器目录配置

| 服务 | 配置文件 | 目录路径 |
|------|----------|----------|
| 西柚找词 | `xiyouzhaociService.ts` | `~/.node-plawright-test/chrome-profile/automation` |
| Amazon搜索 | `amazon-search-service.ts` | `~/.node-plawright-test/chrome-profile/automation` |
| Amazon产品 | `amazon-product-service.ts` | `~/.node-plawright-test/chrome-profile/automation` |
| 爬虫服务 | `crawler-service.ts` | `~/.node-plawright-test/chrome-profile/automation` |
| Gemini脚本 | 所有test-gemini*.ts | `~/.node-plawright-test/chrome-profile/automation` |
| ChatGPT脚本 | 所有test-chatgpt*.ts | `~/.node-plawright-test/chrome-profile/automation` |

### 首次使用指南

**首次运行时需要手动登录一次：**

1. 运行任意一个服务或脚本
2. 在打开的浏览器中完成登录（如Google、Amazon等）
3. 登录状态会自动保存到 `automation` 目录
4. 之后所有服务都能使用这个登录状态

### 验证配置

检查服务是否使用了正确的目录：

```bash
# 检查统一目录是否存在
ls -la ~/.node-plawright-test/chrome-profile/automation

# 检查目录内容（应该包含浏览器配置文件）
ls -la ~/.node-plawright-test/chrome-profile/automation/Default/
```

---

## 📋 项目结构

### 后端服务结构
```
quick-test/
├── src/
│   ├── api-server.ts              # API服务器主入口
│   ├── services/                  # 业务服务
│   │   ├── crawler-service.ts     # 爬虫服务
│   │   ├── ai-vision-service.ts   # AI识别服务
│   │   ├── amazon-search-service.ts    # Amazon搜索
│   │   ├── amazon-product-service.ts  # Amazon产品
│   │   └── xiyouzhaociService.ts  # 西柚找词
│   └── core/
│       └── database-service.ts    # 数据库服务
├── docker-compose.yml             # PostgreSQL配置
├── package.json
└── .env                           # 环境配置
```

### 前端界面结构
```
workflow-editor/
├── src/
│   ├── App.tsx                    # 根组件
│   ├── components/                # UI组件
│   ├── pages/                     # 页面组件
│   ├── engine/                    # 工作流引擎
│   └── plugins/                   # 节点插件
├── backend/                       # 前端的后端服务
│   ├── server.ts                  # Hono服务器
│   ├── api/                       # API路由
│   └── services/                  # 业务逻辑
├── package.json
└── vite.config.ts                 # Vite配置
```

---

## 🔌 API 端点

### 健康检查
- `GET /api/health` - 服务健康状态

### 爬虫服务
- `POST /api/crawl/gigab2b` - 执行 GigaB2B 爬虫
- `GET /api/runs` - 运行记录列表
- `GET /api/runs/:id` - 单次运行详情

### AI 服务
- `POST /api/ai/recognize` - AI 图片识别
- `POST /api/ai/compare` - AI 多图对比
- `GET /api/ai/templates` - 预设提示词模板
- `GET /api/ai/results` - 查询 AI 识别结果

### Amazon 服务
- `POST /api/search/amazon` - Amazon 竞品搜索
- `POST /api/scrape/amazon-product` - Amazon 产品详情抓取

### 西柚找词服务
- `POST /api/keywords/xiyouzhaoci` - 西柚找词关键词挖掘

### 数据库服务
- `GET /api/db/stats` - 数据库统计
- `GET /api/db/runs` - 运行记录
- `GET /api/db/products` - 产品数据
- `GET /api/db/ai-results` - AI识别结果

---

## 🛠️ 故障排除

### 端口冲突解决
```bash
# 查找占用3456端口的进程
lsof -ti:3456 | xargs kill -9

# 查找占用5173端口的进程
lsof -ti:5173 | xargs kill -9

# 查找占用5432端口的进程
docker-compose down
```

### 登录状态丢失
```bash
# 检查统一目录是否存在
ls -la ~/.node-plawright-test/chrome-profile/automation

# 如果不存在，重新运行任意服务并登录
cd /Users/clearzero22/development/ai/01_amazon_projects/node_plawright_test/quick-test
npm run test:gemini:simple
```

### 数据库连接问题
```bash
# 重启 PostgreSQL
docker-compose restart

# 查看数据库日志
docker-compose logs postgres
```

### 依赖安装问题
```bash
# 后端依赖
cd /Users/clearzero22/development/ai/01_amazon_projects/node_plawright_test/quick-test
npm install

# 前端依赖
cd /Users/clearzero22/development/ai/01_amazon_projects/chatgpt_pages/implementations/dashboard/workflow-editor
npm install
```

---

## 🔐 环境配置

### 后端 (.env)
```bash
PORT=3456
DATABASE_URL=postgresql://crawler:crawler_pass@localhost:5432/crawler_db
DASHSCOPE_API_KEY=your_api_key_here
```

### 前端 (.env.local)
```bash
VITE_API_BASE_URL=http://localhost:3456/api
VITE_PLAN_WS_URL=ws://localhost:8080/plan-updates
```

---

## 📊 验证服务状态

### 检查所有服务
```bash
# 检查后端API
curl http://localhost:3456/api/health

# 检查数据库
docker-compose ps

# 检查前端
curl http://localhost:5173
```

### 预期响应
```json
{
  "status": "ok",
  "db": true,
  "ai": true,
  "timestamp": "2026-04-30T..."
}
```

---

## 💡 使用提示

1. **启动顺序很重要：** 数据库 → 后端API → 前端界面
2. **端口默认值：** 数据库(5432)、后端(3456)、前端(5173)
3. **日志查看：** 各服务的日志会显示在对应的终端窗口
4. **开发模式：** 前端支持热重载，修改代码后自动刷新
5. **统一目录：** 所有服务必须使用 `~/.node-plawright-test/chrome-profile/automation`

---

## 🚨 重要注意事项

### 浏览器数据目录管理

**❌ 错误做法：**
```typescript
// 不要使用临时目录
const userDataDir = '/tmp/some-profile';
const userDataDir = './.chrome-data';
```

**✅ 正确做法：**
```typescript
// 必须使用统一的共享目录
import { homedir } from 'os';
import { join } from 'path';

const userDataDir = join(homedir(), '.node-plawright-test', 'chrome-profile', 'automation');
```

### 新服务配置检查清单

添加新的浏览器服务时，必须确保：

1. ✅ 使用 `~/.node-plawright-test/chrome-profile/automation` 目录
2. ✅ 在CLAUDE.md中记录服务配置
3. ✅ 测试登录状态共享功能
4. ✅ 验证与其他服务的兼容性

---

**最后更新：** 2026-04-30
**维护者：** Claude Code Assistant
**重要原则：** 所有浏览器服务必须统一使用 `~/.node-plawright-test/chrome-profile/automation` 目录
