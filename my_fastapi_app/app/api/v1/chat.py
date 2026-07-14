from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import shutil
import os
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.chat import Conversation, ChatMessage

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatResponse(BaseModel):
    role: str
    content: str
    images: Optional[List[str]] = None

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/")
async def chat_with_stylist(
    message: str = Form(""),
    conversation_id: str = Form("default"),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db)
):
    user_id = "default_user"
    user_msg = message.strip()

    try:
        conv_id = int(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный conversation_id")

    # Получаем conversation
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id)
    )
    conv = result.scalar_one_or_none()

    if not conv:
        raise HTTPException(status_code=404, detail="Чат не найден")

    # === ВОССТАНОВЛЕНИЕ СОСТОЯНИЯ ===
    print(f"[DEBUG] Загружено состояние для чата {conv_id}: {conv.state}")  # ← отладка

    session = dict(conv.state) if conv.state else {"step": 0, "data": {}}
    saved_image_paths = []

    if files:
        for file in files:
            if file.filename:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{timestamp}_{file.filename}"
                file_path = os.path.join(UPLOAD_DIR, filename)
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                saved_image_paths.append(f"/uploads/{filename}")

    step = session.get("step", 0)
    data = session.get("data", {})
    response = ""

    print(f"[DEBUG] Текущий шаг перед обработкой: {step}")  # ← отладка

    # === ЛОГИКА ДИАЛОГА ===
    if step == 0:
        name = user_msg if user_msg else "друг"
        data["name"] = name
        response = f"Приятно познакомиться, {name}! Давай начнём. Какой стиль одежды тебе ближе всего? (casual, smart casual, спортивный, элегантный, streetwear и т.д.)"
        session["step"] = 1

    elif step == 1:
        data["preferred_style"] = user_msg
        response = "Отлично! Какой у тебя примерно бюджет на одну вещь ($)?"
        session["step"] = 2

    elif step == 2:
        data["budget"] = user_msg
        response = "Поняла. Расскажи о своей фигуре: рост, размер одежды, особенности, что хочешь подчеркнуть или скрыть?"
        session["step"] = 3

    elif step == 3:
        data["measurements"] = user_msg
        response = "Спасибо! Есть любимые бренды или магазины?"
        session["step"] = 4

    elif step == 4:
        data["brands"] = user_msg
        response = "Отлично. Хочешь прислать фото лица/фигуры? (можно несколько)"
        session["step"] = 5

    elif step == 5:
        if saved_image_paths:
            response = f"Фото успешно загружено ({len(saved_image_paths)} шт.)! Спасибо."
        elif any(word in (user_msg or "").lower() for word in ["пропустить", "нет", "skip", "не надо"]):
            response = "Хорошо, продолжим без фото."
        else:
            response = "Жду твои фото!"
        response += " Какие цвета ты особенно любишь носить, а какие стараешься избегать?"
        session["step"] = 6

    elif step == 6:
        data["colors"] = user_msg
        name = data.get("name", "друг")
        response = f"Спасибо, {name}! Я собрала всю информацию.\n\nГотов посмотреть рекомендации?"
        session["step"] = 7

    else:
        response = "Поняла. Что делаем дальше?"

    # === СОХРАНЕНИЕ СОСТОЯНИЯ ===
    conv.state = session
    conv.updated_at = datetime.utcnow()

    print(f"[DEBUG] Сохраняем новое состояние: step={session.get('step')}")  # ← отладка

    # Сохранение сообщений
    user_msg_db = ChatMessage(
        conversation_id=conv_id,
        user_id=user_id,
        role="user",
        content=user_msg,
        images=saved_image_paths
    )
    db.add(user_msg_db)

    assistant_msg_db = ChatMessage(
        conversation_id=conv_id,
        user_id=user_id,
        role="assistant",
        content=response,
        images=None
    )
    db.add(assistant_msg_db)

    await db.commit()
    await db.refresh(conv)  # обновляем объект после commit

    return ChatResponse(
        role="assistant", 
        content=response,
        images=saved_image_paths if saved_image_paths else None
    )