import asyncio
from app.core.database import AsyncSessionLocal
from app.models.chat import ChatMessage
from sqlalchemy import select

async def check_messages():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ChatMessage).order_by(ChatMessage.created_at.desc()).limit(10)
        )
        messages = result.scalars().all()
        
        print(f"\nНайдено сообщений: {len(messages)}\n")
        for msg in messages:
            print(f"[{msg.created_at}] {msg.role.upper()}: {msg.content[:100]}...")
            if msg.images:
                print(f"   Фото: {msg.images}")

asyncio.run(check_messages())