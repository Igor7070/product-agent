from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List
from app.core.database import get_db
from app.models.chat import Conversation, ChatMessage

router = APIRouter(prefix="/conversations", tags=["conversations"])

@router.get("/")
async def get_conversations(db: AsyncSession = Depends(get_db)):
    """Получить список всех чатов"""
    try:
        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .order_by(desc(Conversation.updated_at))
        )
        convs = result.scalars().all()
        
        return [
            {
                "id": c.id,
                "title": c.title or f"Чат #{c.id}",
                "last_message": (c.messages[-1].content[:100] + "...") if c.messages else "Новый чат",
                "updated_at": c.updated_at.isoformat() if c.updated_at else None
            } for c in convs
        ]
    except Exception as e:
        print("Ошибка получения списка чатов:", str(e))
        return []


@router.post("/")
async def create_conversation(db: AsyncSession = Depends(get_db)):
    """Создать новый чат"""
    try:
        conv = Conversation(title="Новый чат с Анной")
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
        return {"id": conv.id, "title": conv.title}
    except Exception as e:
        print("Ошибка создания чата:", str(e))
        raise HTTPException(status_code=500, detail="Не удалось создать чат")


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: int, db: AsyncSession = Depends(get_db)):
    """Загрузить чат по ID"""
    try:
        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conversation_id)
        )
        conv = result.scalar_one_or_none()
        
        if not conv:
            raise HTTPException(status_code=404, detail="Чат не найден")
        
        messages_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.created_at)
        )
        
        return {
            "id": conv.id,
            "title": conv.title,
            "messages": [
                {
                    "role": m.role,
                    "content": m.content,
                    "images": m.images
                } for m in messages_result.scalars().all()
            ]
        }
    except Exception as e:
        print("Ошибка загрузки чата:", str(e))
        raise HTTPException(status_code=500, detail=str(e))