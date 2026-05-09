# 个人学习助手 — 项目文档

## 项目概述

AI 驱动的个人学习助手 Web 应用。用户输入学习目标 → AI 生成学习路线 → 每日推送规划与问答 → 实时调整路线。

- **GitHub**: https://github.com/liuyang-huan/study_assistance
- **分支策略**: 功能分支开发 → 合并到 `main`

## 技术栈

| 层 | 选型 |
|---|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router v6 + axios |
| 动画 | framer-motion (页面过渡/弹窗动画) |
| 图标 | lucide-react (统一图标库) |
| 后端 | Python 3.12 + FastAPI + SQLAlchemy + SQLite |
| AI | DeepSeek v4 API（OpenAI 兼容格式） |
| 包管理 | npm（前端）/ pip（后端） |

## 环境准备

### 前置条件
- Node.js 20+
- Python 3.12+
- Git

### 后端配置
```bash
cd backend
cp .env.example .env   # 编辑 .env 填入 DEEPSEEK_API_KEY
pip install -r requirements.txt
```

`.env` 文件格式：
```
DEEPSEEK_API_KEY=sk-xxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DATABASE_URL=sqlite:///../data/study_assistant.db
```

### 前端配置
```bash
cd frontend
npm install
```

## 开发命令

```bash
# 后端 (localhost:8000)
cd backend && python run.py

# 前端 (localhost:5173)
cd frontend && npm run dev

# 前端构建
cd frontend && npm run build
```

API 文档自动生成于 `http://localhost:8000/docs`

## 手机端访问（Cloudflare Tunnel）

本地开发时，可通过 Cloudflare Tunnel 将前端暴露到公网，手机浏览器直接访问。

### 前置条件
- 安装 cloudflared（Windows: `winget install Cloudflare.cloudflared`）

### 启动 Tunnel
```bash
# 1. 确保前后端都在运行（localhost:5173 和 localhost:8000）

# 2. 启动 tunnel（Windows，cloudflared 在 winget 安装路径下）
"C:\Users\<用户名>\AppData\Local\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe" tunnel --url http://localhost:5173

# 3. 终端会输出一个 https://xxx.trycloudflare.com 地址，手机浏览器打开即可
```

### 关键配置

| 配置项 | 文件 | 说明 |
|--------|------|------|
| `allowedHosts: ['.trycloudflare.com']` | `frontend/vite.config.ts` | 允许 tunnel 域名访问，否则 Vite 返回 403 |
| `baseURL: '/api'` | `frontend/src/services/api.ts` | 相对路径，经 Vite proxy 转发到后端，避免手机端 localhost 指向错误 |
| `server.proxy.'/api'` → `localhost:8000` | `frontend/vite.config.ts` | Vite 代理 API 请求到后端 |

### PWA 安装
应用已配置 `vite-plugin-pwa`，手机浏览器打开后可添加到主屏幕：
- **Android**: Chrome 菜单 → "添加到主屏幕"
- **iOS**: Safari 分享按钮 → "添加到主屏幕"

PWA 配置在 `frontend/vite.config.ts` 的 `VitePWA` 插件中，包含离线缓存策略：
- API 请求：NetworkFirst，缓存 50 条，24h 过期
- 图片资源：CacheFirst，缓存 30 张，30 天过期

### Tunnel 注意事项
- 免费 Tunnel 无固定域名，每次重启 cloudflared 会生成新的随机 URL
- Tunnel 进程关闭后 URL 立即失效
- 仅供开发调试使用，生产环境需部署到服务器

## 目录结构

```
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx            # 全局布局（导航栏 + 页面过渡动画）
│   │   │   ├── StatsPanel.tsx        # 学习统计可视化组件
│   │   │   ├── LearningModal.tsx     # 沉浸式学习弹窗（3栏：大纲+内容+计时器/笔记）
│   │   │   └── KnowledgeGraph.tsx    # 知识图谱 SVG 可视化
│   │   ├── pages/
│   │   │   ├── HomePage.tsx          # / — 目标列表 + 内联创建
│   │   │   ├── CreateGoal.tsx        # /goals/new — 独立创建表单
│   │   │   ├── GoalDetail.tsx        # /goals/:id — 主仪表盘
│   │   │   └── HistoryPage.tsx       # /goals/:id/history — 日志+问答历史
│   │   ├── services/api.ts           # axios 封装，所有 API 调用
│   │   ├── types/index.ts            # TypeScript 类型定义
│   │   ├── App.tsx                   # 路由配置
│   │   ├── index.css                 # 全局样式（动画/玻璃态/渐变/滚动条）
│   │   └── main.tsx                  # 入口
│   ├── vite.config.ts
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── models/                   # 数据库模型 (goal, roadmap, journal, plan, question)
│   │   ├── routers/                  # API 路由 (goals, roadmap, journal, questions, plans, stats)
│   │   ├── services/
│   │   │   ├── ai_service.py         # DeepSeek API 调用封装 (chat, chat_json)
│   │   │   └── prompt_templates.py   # AI 提示词模板
│   │   ├── schemas/api.py            # Pydantic 请求/响应模型
│   │   ├── main.py                   # FastAPI 入口 + CORS 配置
│   │   ├── config.py                 # 环境变量加载
│   │   └── database.py              # SQLAlchemy 引擎与会话
│   ├── requirements.txt
│   └── run.py                        # uvicorn 启动脚本
├── data/                             # SQLite 数据库（gitignore）
├── CLAUDE.md
└── README.md
```

## API 端点速查

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET/POST | `/api/goals` | 目标列表 / 创建（触发 AI 生成路线+规划） |
| GET/PUT/DELETE | `/api/goals/{id}` | 目标详情 / 更新 / 删除 |
| GET/POST | `/api/goals/{id}/roadmap` | 获取 / 生成路线 |
| GET/POST | `/api/goals/{id}/plans` | 获取 / 生成每日规划 |
| PUT | `/api/plans/{id}/complete` | 标记规划完成 |
| GET/POST | `/api/goals/{id}/journal` | 获取 / 保存日志 |
| GET | `/api/goals/{id}/journal/history` | 日志历史 |
| GET/POST | `/api/goals/{id}/questions` | 获取 / 生成问答 |
| POST | `/api/questions/{id}/answer` | 提交答案（触发 AI 评估） |
| GET | `/api/goals/{id}/questions/history` | 问答历史 |
| GET | `/api/goals/{id}/stats` | 学习统计 |
| GET | `/api/goals/{id}/knowledge-graph` | 知识图谱数据 |

## 数据库

- SQLite，文件 `data/study_assistant.db`（已 gitignore）
- 应用启动时自动建表，无需手动迁移
- 6 张核心表: `learning_goals`, `roadmaps`, `journal_entries`, `daily_questions`, `user_answers`, `daily_plans`

## AI 服务

- 使用 DeepSeek v4，OpenAI 兼容 SDK 格式
- API Key 通过 `.env` 文件配置
- `backend/app/services/prompt_templates.py` 中管理 5 种提示词模板：
  - `generate_roadmap` — 学习路线（阶段/主题/资源/练习）
  - `generate_daily_plan` — 每日规划（任务 + 详细学习材料）
  - `generate_questions` — 每日测验题
  - `evaluate_answer` — AI 评分评估
  - `adjust_roadmap` — 路线自适应调整
- `chat_json()` 内置 JSON 提取 + 一次重试机制
- API 超时设为 60 秒

## 常见问题排查

### 前端 API 连接失败
- 确认后端 `python run.py` 在运行（`http://localhost:8000/api/health`）
- 前端 `api.ts` 使用相对路径 `/api`，通过 Vite proxy 转发到后端（见 `vite.config.ts` 的 `server.proxy` 配置）

### AI 路线/规划生成失败
- 检查 `backend/.env` 中 `DEEPSEEK_API_KEY` 是否有效
- 查看后端终端日志（已加 `logger.exception` 输出 AI 调用错误）
- AI 调用超时为 60 秒，复杂路线可能需要等待

### 规划没有学习材料
- 旧规划不含 `materials` 字段，点「重新生成」即可
- 新创建的规划默认包含完整学习材料（概述/概念/内容/示例/练习）
- 如果重新生成后仍无材料：清理 `__pycache__` 后重启后端

### 修改代码后不生效
```bash
# 清理 Python 缓存
rm -rf backend/app/__pycache__
rm -rf backend/app/*/__pycache__
# 重启后端
```

## Claude Code 工具链

本项目使用以下 Claude Code skills 辅助开发：

| Skill | 用途 | 使用场景 |
|-------|------|---------|
| `simplify` | 代码审查：复用性/质量/效率 | 每轮开发完成后运行 |
| `fewer-permission-prompts` | 分析常用命令，减少权限弹窗 | 项目初始化时配置 |
| `review` | PR 合并前的代码审查 | 功能分支合并前 |
| `security-review` | 安全审查（API key 泄漏、CORS 等） | 合并前检查 |

推荐前端 UI 工具：
- **shadcn/ui** — React + Tailwind 组件库，按需复制源码，与此项目栈完美契合

## 用户偏好

- 用中文交流
- 本地运行，个人使用
- 减少确认，自主推进（但 git push 等高风险操作需确认）
- 每阶段开发完后合并到 main
- 先做 MVP，再逐步完善功能
