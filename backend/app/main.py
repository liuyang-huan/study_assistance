import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import engine, Base
from .routers import goals, roadmap, journal, questions, plans, stats, export, chat, progress, notes, upload

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
        'http://localhost:5181',
        'http://localhost:5182',
        'http://localhost:5183',
        'http://localhost:5184',
        'http://localhost:5185',
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
app.include_router(progress.router)
app.include_router(notes.router)
app.include_router(upload.router)

_uploads_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'uploads')
os.makedirs(_uploads_dir, exist_ok=True)
app.mount('/uploads', StaticFiles(directory=_uploads_dir), name='uploads')


@app.get('/api/health')
def health():
    return {'status': 'ok'}
