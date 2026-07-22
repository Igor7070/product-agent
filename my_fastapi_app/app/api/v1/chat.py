import os
import shutil
import base64
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.chat import Conversation, ChatMessage
from app.core.auth import get_current_user
from app.services.ai_agent import run_stylist_agent

router = APIRouter(tags=["chat"])

class ChatResponse(BaseModel):
    role: str
    content: str
    images: Optional[List[str]] = None

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def encode_image_to_base64(file_path: str) -> str:
    """Вспомогательная функция для перевода изображения в base64 для OpenAI Vision"""
    with open(file_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


@router.post("/")
async def chat_with_stylist(
    message: str = Form(""),
    conversation_id: str = Form("default"),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user)
):
    print(f"[DEBUG] chat_with_stylist called with user_id: {user_id}, conv_id: {conversation_id}")
    user_msg = message.strip()

    try:
        conv_id = int(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный conversation_id")

    # 1. Проверяем существование диалога и права доступа
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.user_id == user_id
        )
    )
    conv = result.scalar_one_or_none()

    if not conv:
        raise HTTPException(status_code=404, detail="Чат не найден или не принадлежит вам")

    # 2. Сохраняем загруженные файлы на диск
    saved_image_paths: List[str] = []
    base64_images: List[str] = []

    if files:
        for file in files:
            if file.filename:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{timestamp}_{file.filename}"
                file_path = os.path.join(UPLOAD_DIR, filename)
                
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                
                saved_image_paths.append(f"/uploads/{filename}")
                
                # Подготавливаем base64 для передачи в AI Vision
                b64_str = encode_image_to_base64(file_path)
                base64_images.append(b64_str)

    # 3. Достаем историю сообщений из базы данных для формирования контекста
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conv_id)
        .order_by(ChatMessage.created_at.asc())
    )
    db_messages = history_result.scalars().all()

    # Формируем список сообщений в формате OpenAI API
    messages_history = []
    for msg in db_messages:
        messages_history.append({
            "role": msg.role,
            "content": msg.content
        })

    # 4. Формируем новое сообщение от пользователя (с поддержкой Vision для фото)
    if base64_images:
        user_content = []
        if user_msg:
            user_content.append({"type": "text", "text": user_msg})
        else:
            user_content.append({"type": "text", "text": "Оцени эти фото и учти их в подборе."})

        for b64 in base64_images:
            user_content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"}
            })
        
        messages_history.append({"role": "user", "content": user_content})
    else:
        messages_history.append({"role": "user", "content": user_msg if user_msg else "Привет!"})

    # 5. Вызываем AI-агента Анну
    ai_response_text = await run_stylist_agent(messages_history)

    # 6. Сохраняем новое сообщение пользователя и ответ Анны в PostgreSQL
    user_msg_db = ChatMessage(
        conversation_id=conv_id,
        user_id=user_id,
        role="user",
        content=user_msg if user_msg else "[Прикреплено изображение]",
        images=saved_image_paths if saved_image_paths else None
    )
    db.add(user_msg_db)

    assistant_msg_db = ChatMessage(
        conversation_id=conv_id,
        user_id=user_id,
        role="assistant",
        content=ai_response_text,
        images=None
    )
    db.add(assistant_msg_db)

    # Обновляем время активности чата
    conv.updated_at = datetime.utcnow()

    await db.commit()

    # 7. Возвращаем ответ клиенту
    return ChatResponse(
        role="assistant", 
        content=ai_response_text,
        images=saved_image_paths if saved_image_paths else None
    )