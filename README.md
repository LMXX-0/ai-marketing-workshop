# AI 出海营销工坊（ai-marketing-workshop）

多模态 AI 跨境电商智能出海营销系统。运营上传商品图 → AI 识别外观与卖点 → 生成多语言多渠道文案（SSE 流式）→ 生成海外场景主图 → 一键导出 ZIP 营销包 → Token 消耗看板。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3 + Vite + Element Plus + Pinia + ECharts |
| 后端 | Node.js + Express（SSE 流式） |
| 数据库 | MongoDB + Mongoose |
| AI | 阿里云百炼：Qwen-VL（识图）、Qwen-Plus（文案）、通义万相（生图） |

## 目录结构

```text
ai-marketing-workshop/
├─ client/                  # 前端
│  ├─ src/{api,components,views,stores,router,utils}
│  ├─ .env.development
│  └─ .env.production
├─ server/                  # 后端
│  ├─ src/{config,routes,controllers,services,models,middlewares,utils}
│  ├─ uploads/            # 上传与生成的图片（不进 Git）
│  ├─ .env                # 密钥（不进 Git）
│  └─ .env.example
├─ docs/                    # 需求规格、API 规划与作业文档
├─ .gitignore
└─ README.md
```

> 各分层目录（`components`、`stores`、`utils`、`middlewares`、`services` 等）后续作业才会填充代码，现用 `.gitkeep` 占位，避免空目录被 Git 丢弃。

## 快速开始

1. 启动 MongoDB（本机服务、Docker 或 Atlas 云库三选一），把连接串写入 `server/.env` 的 `MONGO_URI`。
2. 启动后端：

   ```bash
   cd server
   npm install
   npm run dev
   ```

   终端出现 `[db] MongoDB 已连接` 与 `[server] http://localhost:3000` 即成功，浏览器访问 `http://localhost:3000/api/health` 应返回 `{"code":0,...}`。

3. 启动前端（另开一个终端）：

   ```bash
   cd client
   npm install
   npm run dev
   ```

   打开 `http://localhost:5173`，页面顶部出现“后端连接成功”即前后端联调通过。

## 环境变量

`server/.env`（不提交，只提交 `.env.example`）：

```text
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/aimarketing
CORS_ORIGIN=http://localhost:5173
DASHSCOPE_API_KEY=
```

`client/.env.development`：

```text
VITE_API_BASE=http://localhost:3000
```

> 生产环境前后端同域，`VITE_API_BASE` 留空，由 Nginx 反向代理 `/api`。
