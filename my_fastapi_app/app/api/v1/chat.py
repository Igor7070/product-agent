from fastapi import APIRouter, UploadFile, File, Form, Depends
from pydantic import BaseModel
from typing import List, Optional
import shutil
import os
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.chat import ChatMessage

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatResponse(BaseModel):
    role: str
    content: str
    images: Optional[List[str]] = None

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Сессии по conversation_id (чтобы каждый чат был независимым)
active_sessions = {}

def get_or_create_session(conversation_id: str):
    if conversation_id not in active_sessions:
        active_sessions[conversation_id] = {
            "step": 0,
            "data": {}
        }
    return active_sessions[conversation_id]


@router.post("/")
async def chat_with_stylist(
    message: str = Form(""),
    conversation_id: str = Form("default"),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db)
):
    user_id = "default_user"
    user_msg = message.strip()

    # Получаем сессию для конкретного чата
    session = get_or_create_session(conversation_id)
    saved_image_paths = []

    # Сохранение фото
    if files:
        for file in files:
            if file.filename:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{timestamp}_{file.filename}"
                file_path = os.path.join(UPLOAD_DIR, filename)
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                saved_image_paths.append(f"/uploads/{filename}")

    # === Логика диалога ===
    step = session["step"]
    data = session["data"]
    response = ""

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
        response = "Поняла. Расскажи о своей фигуре: рост, размер одежды, особенности..."
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
        elif any(word in user_msg.lower() for word in ["пропустить", "нет", "skip", "не надо"]):
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

    # === Сохранение в базу данных ===
    user_msg_db = ChatMessage(
        user_id=user_id,
        role="user",
        content=user_msg,
        images=saved_image_paths
    )
    db.add(user_msg_db)

    assistant_msg_db = ChatMessage(
        user_id=user_id,
        role="assistant",
        content=response,
        images=None
    )
    db.add(assistant_msg_db)

    await db.commit()

    return ChatResponse(
        role="assistant", 
        content=response,
        images=saved_image_paths if saved_image_paths else None
    )