# 个人学习助手 — 项目文档

## 项目概述

AI 驱动的个人学习助手 Web 应用。用户输入学习目标 → AI 生成学习路线 → 每日推送规划与问答 → 实时调整路线。

- **GitHub**: https://github.com/liuyang-huan/study_assistance
- **分支策略**: 功能分支开发 → 合并到 `main`

## 技术栈

| 层 | 选型 |
|---|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router v6 + axios |
| 后端 | Python 3.12 + FastAPI + SQLAlchemy + SQLite |
| AI | DeepSeek v4 API（OpenAI 兼容格式） |
| 包管理 | npm（前端）/ pip（后端） |

## 目录结构

```
├── frontend/                # React 前端
│   ├── src/
│   │   ├── components/      # 通用组件（Layout, Loading, ErrorMsg）
│   │   ├── pages/           # 页面（HomePage, GoalDetail, CreateGoal, JournalPage）
│   │   ├── services/        # API 调用封装（api.ts）
│   │   ├── types/           # TypeScript 类型
│   │   ├── App.tsx          # 路由配置
│   │   └── main.tsx         # 入口
│   └── ...
├── backend/                 # Python 后端
│   ├── app/
│   │   ├── models/          # 数据库模型
│   │   ├── routers/         # API 路由
│   │   ├── services/        # 业务逻辑（AI 调用等）
│   │   ├── schemas/         # Pydantic 请求/响应模型
│   │   ├── main.py          # FastAPI 入口
│   │   ├── config.py        # 配置管理
│   │   └── database.py      # 数据库连接
│   └── run.py               # 启动脚本
├── data/                    # SQLite 数据库文件
├── CLAUDE.md
└── README.md
```

## 开发命令

### 前端
```bash
cd frontend
npm install              # 安装依赖
npm run dev              # 启动开发服务器 (localhost:5173)
npm run build            # 生产构建
npm run preview          # 预览生产构建
```

### 后端
```bash
cd backend
pip install -r requirements.txt   # 安装依赖
python run.py                     # 启动后端 (localhost:8000)
```

API 文档自动生成于 `http://localhost:8000/docs`

## 数据库

- 使用 SQLite，数据库文件位于 `data/study_assistant.db`
- 模型定义在 `backend/app/models/` 下
- 应用启动时自动建表
- 核心表: learning_goals, roadmaps, journal_entries, daily_questions, user_answers, daily_plans

## AI 服务

- DeepSeek v4 API，兼容 OpenAI SDK 格式
- API Key 通过环境变量 `DEEPSEEK_API_KEY` 配置
- Prompt 模板集中管理在 `backend/app/services/prompt_templates.py`

## 用户偏好

- 用中文交流
- 本地运行，个人使用
- 先做 MVP，再逐步完善
