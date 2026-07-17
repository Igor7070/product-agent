from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List
from app.core.database import get_db
from app.models.chat import Conversation, ChatMessage

# Здесь НЕ должно быть prefix!
router = APIRouter(tags=["conversations"])

@router.get("/")
async def get_conversations(db: AsyncSession = Depends(get_db)):
    """Получить список чатов (только с сообщениями от пользователя)"""
    try:
        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .order_by(desc(Conversation.updated_at))
        )
        convs = result.scalars().all()
        
        chat_list = []
        for c in convs:
            user_messages = [m for m in c.messages if m.role == "user"]
            if not user_messages:
                continue

            title = c.title
            if title.startswith("Новый чат") and user_messages:
                first_msg = user_messages[0].content.strip()
                title = (first_msg[:35] + "...") if len(first_msg) > 35 else first_msg

            chat_list.append({
                "id": c.id,
                "title": title,
                "last_message": (user_messages[-1].content[:80] + "...") if user_messages else "",
                "updated_at": c.updated_at.isoformat() if c.updated_at else None
            })
        
        return chat_list
    except Exception as e:
        print("Ошибка получения списка чатов:", str(e))
        return []


@router.post("/")
async def create_conversation(db: AsyncSession = Depends(get_db)):
    """Создать новый чат"""
    try:
        conv = Conversation(
            title="Новый чат с Анной",
            state={"step": 0, "data": {}}
        )
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
            "state": conv.state or {"step": 0, "data": {}},
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


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить чат"""
    try:
        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conv = result.scalar_one_or_none()
        
        if not conv:
            raise HTTPException(status_code=404, detail="Чат не найден")

        await db.delete(conv)
        await db.commit()

        return {"status": "success", "message": "Чат удалён"}
    except Exception as e:
        await db.rollback()
        print("Ошибка удаления чата:", str(e))
        raise HTTPException(status_code=500, detail="Не удалось удалить чат")