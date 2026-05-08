from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={'check_same_thread': False},
    poolclass=None,  # SQLite 文件级连接池无需额外池
)

@event.listens_for(engine, 'connect')
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """启用 SQLite 外键 + WAL 模式提升并发性能"""
    cursor = dbapi_connection.cursor()
    cursor.execute('PRAGMA foreign_keys = ON')
    cursor.execute('PRAGMA journal_mode = WAL')
    cursor.execute('PRAGMA busy_timeout = 5000')
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
