import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import engine, Base
from .routers import goals, roadmap, journal, questions, plans, stats, export, chat, progress, notes, upload, documents, global_notes, todos

# 自动建表
Base.metadata.create_all(bind=engine)

# 增量迁移：修复已有表结构
with engine.connect() as conn:
    for col, table in [('source_language', 'book_imports'),
                        ('translated_title', 'book_sections'),
                        ('translated_content', 'book_sections')]:
        try:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {col} TEXT")
        except Exception:
            pass
    for col, col_type, table in [('page_start', 'INTEGER', 'book_sections'),
                                   ('page_end', 'INTEGER', 'book_sections'),
                                   ('read_at', 'TIMESTAMP', 'book_sections')]:
        try:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
        except Exception:
            pass
    # 修复 book_sections.content 的 NOT NULL 约束（SQLite 不支持 ALTER COLUMN，需重建表）
    try:
        # 检查 content 列是否允许 NULL
        info = conn.exec_driver_sql("PRAGMA table_info('book_sections')").fetchall()
        content_col = [row for row in info if row[1] == 'content']
        if content_col and content_col[0][3] == 1:  # notnull=1 表示 NOT NULL
            conn.exec_driver_sql("""
                CREATE TABLE IF NOT EXISTS book_sections_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    book_import_id INTEGER NOT NULL REFERENCES book_imports(id) ON DELETE CASCADE,
                    goal_id INTEGER NOT NULL REFERENCES learning_goals(id) ON DELETE CASCADE,
                    section_index INTEGER NOT NULL,
                    title VARCHAR(500) NOT NULL,
                    level INTEGER DEFAULT 1,
                    page_start INTEGER,
                    page_end INTEGER,
                    content TEXT,
                    translated_title VARCHAR(500),
                    translated_content TEXT,
                    topic_day INTEGER,
                    read_at TIMESTAMP
                )
            """)
            conn.exec_driver_sql("INSERT INTO book_sections_new SELECT * FROM book_sections")
            conn.exec_driver_sql("DROP TABLE book_sections")
            conn.exec_driver_sql("ALTER TABLE book_sections_new RENAME TO book_sections")
    except Exception:
        pass
    conn.commit()

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
app.include_router(documents.router)
app.include_router(documents.import_router)
app.include_router(global_notes.router)
app.include_router(todos.router)

_uploads_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'uploads')
os.makedirs(_uploads_dir, exist_ok=True)
app.mount('/uploads', StaticFiles(directory=_uploads_dir), name='uploads')


@app.get('/api/health')
def health():
    return {'status': 'ok'}
