# 个人学习助手

AI 驱动的个人学习助手工具。输入任意学习目标，AI 自动规划学习路线，每日推送问题和规划，通过你的回答和学习记录实时调整学习计划。

## 功能

- **学习目标管理**：创建和管理学习目标（微积分、弹钢琴、求职等）
- **AI 学习路线**：输入目标，AI 自动生成详细的分阶段学习路线
- **每日规划**：AI 根据当前进度生成今日/明日学习任务
- **每日问答**：AI 推送问题，评估你的回答，判断实际水平
- **学习日志**：记录每日学习内容和心得
- **动态调整**：AI 根据你的表现自动调整后续学习路线

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS |
| 后端 | Python 3.12 + FastAPI |
| 数据库 | SQLite + SQLAlchemy |
| AI API | DeepSeek v4 |

## 快速开始

### 1. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置 API Key

在 `backend/.env` 中设置：

```
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

### 3. 启动后端

```bash
cd backend
python run.py
```

后端运行在 `http://localhost:8000`，API 文档在 `http://localhost:8000/docs`

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5173`

## 项目结构

```
├── frontend/          # React 前端
├── backend/           # Python FastAPI 后端
├── data/              # SQLite 数据库文件
├── .gitignore
└── README.md
```
