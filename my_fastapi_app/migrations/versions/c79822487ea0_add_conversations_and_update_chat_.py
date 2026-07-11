"""add conversations and update chat messages

Revision ID: c79822487ea0
Revises: dfaa667e6d47
Create Date: 2026-07-11 00:46:05.124995

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c79822487ea0'
down_revision: Union[str, Sequence[str], None] = 'dfaa667e6d47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Создаём таблицу conversations
    op.create_table('conversations',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=True),
    sa.Column('title', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_conversations_id'), 'conversations', ['id'], unique=False)
    op.create_index(op.f('ix_conversations_user_id'), 'conversations', ['user_id'], unique=False)

    # Добавляем колонку conversation_id как NULLABLE (чтобы не падало на старых записях)
    op.add_column('chat_messages', sa.Column('conversation_id', sa.Integer(), nullable=True))
    
    # Меняем тип content на Text
    op.alter_column('chat_messages', 'content',
               existing_type=sa.VARCHAR(),
               type_=sa.Text(),
               existing_nullable=True)

    # Создаём foreign key
    op.create_foreign_key(None, 'chat_messages', 'conversations', ['conversation_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(None, 'chat_messages', type_='foreignkey')
    op.alter_column('chat_messages', 'content',
               existing_type=sa.Text(),
               type_=sa.VARCHAR(),
               existing_nullable=True)
    op.drop_column('chat_messages', 'conversation_id')
    op.drop_index(op.f('ix_conversations_user_id'), table_name='conversations')
    op.drop_index(op.f('ix_conversations_id'), table_name='conversations')
    op.drop_table('conversations')