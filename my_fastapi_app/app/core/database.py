import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Получаем DATABASE_URL из переменных окружения (Railway)
DATABASE_URL = os.getenv("DATABASE_URL")

# === КРИТИЧНО ДЛЯ ASYNC ===
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    # Преобразуем в asyncpg
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    ASYNC_DATABASE_URL = DATABASE_URL

# Создаём async engine
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,           # Поставь True только если нужна отладка
    future=True,
    pool_pre_ping=True,   # Помогает держать соединение живым на Railway
)

# Сессия
AsyncSessionLocal = sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session