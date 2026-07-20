"""add user_id to conversations and chat_messages

Revision ID: 40be82fc1a1a
Revises: 86eb72c12a1b
Create Date: 2026-07-20 21:04:34.938659
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '40be82fc1a1a'
down_revision = '86eb72c12a1b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade schema."""
    # Колонки user_id уже существуют — ничего не делаем
    print("Колонки user_id уже существуют. Миграция пропущена.")
    pass


def downgrade() -> None:
    """Downgrade schema."""
    # Ничего не откатываем, т.к. колонки были добавлены вручную
    pass
