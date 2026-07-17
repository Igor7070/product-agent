import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# ====================== ИМПОРТЫ ======================
from app.core.config import settings  # или где у тебя DATABASE_URL
from app.models.base import Base

# ====================== ALEMBIC CONFIG ======================
config = context.config

# Логирование
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# ====================== OFFLINE MODE ======================
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# ====================== ONLINE MODE (ASYNC) ======================
async def run_async_migrations():
    # Важно: преобразуем URL под asyncpg
    database_url = settings.DATABASE_URL if hasattr(settings, 'DATABASE_URL') else os.getenv("DATABASE_URL")
    
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    connectable = create_async_engine(
        database_url,
        poolclass=pool.NullPool,
        echo=False,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    asyncio.run(run_async_migrations())


# ====================== ЗАПУСК ======================
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
