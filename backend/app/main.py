from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import goals, roadmap, journal, questions, plans, stats, export, chat

# 自动建表
Base.metadata.create_all(bind=engine)

app = FastAPI(title='个人学习助手 API', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
        'http://localhost:5177',
        'http://localhost:5178',
        'http://localhost:5179',
        'http://localhost:5180',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(goals.router)
app.include_router(roadmap.router)
app.include_router(journal.router)
app.include_router(questions.router)
app.include_router(plans.router)
app.include_router(stats.router)
app.include_router(export.router)
app.include_router(chat.router)


@app.get('/api/health')
def health():
    return {'status': 'ok'}
