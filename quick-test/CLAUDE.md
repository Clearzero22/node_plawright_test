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

## 📋 项目结构

### 后端服务结构
```
quick-test/
├── src/
│   ├── api-server.ts              # API服务器主入口
│   ├── services/                  # 业务服务
│   │   ├── crawler-service.ts
│   │   ├── ai-vision-service.ts
│   │   └── amazon-search-service.ts
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

---

**最后更新：** 2026-04-30
**维护者：** Claude Code Assistant
