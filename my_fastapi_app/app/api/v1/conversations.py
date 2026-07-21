from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.chat import Conversation, ChatMessage
from app.core.auth import get_current_user

router = APIRouter(tags=["conversations"])


@router.get("/")
async def get_conversations(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user)
):
    """Получить список чатов текущего пользователя (пропуская неначатые)"""
    print(f"[DEBUG] get_conversations called with user_id: {user_id}")
    try:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .options(selectinload(Conversation.messages))
            .order_by(desc(Conversation.updated_at))
        )
        convs = result.scalars().all()

        print(f"[DEBUG] Found {len(convs)} conversations for user {user_id}")
        
        chat_list = []
        for c in convs:
            user_messages = [m for m in c.messages if m.role == "user"]
            
            # Пропускаем чаты, в которых пользователь еще ничего не написал, 
            # чтобы при F5 страница загружала последний реальный диалог
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
async def create_conversation(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user)
):
    """Создать новый чат для текущего пользователя"""
    try:
        conv = Conversation(
            user_id=user_id,
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
async def get_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user)
):
    """Загрузить конкретный чат (только если принадлежит пользователю)"""
    try:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
            .options(selectinload(Conversation.messages))
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
    except HTTPException:
        raise
    except Exception as e:
        print("Ошибка загрузки чата:", str(e))
        raise HTTPException(status_code=500, detail="Ошибка сервера")


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user)
):
    """Удалить чат (только свой)"""
    try:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
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