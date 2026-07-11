from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import uvicorn
import os

load_dotenv()

app = FastAPI(
    title="Product Search AI Agent",
    version="0.1.0",
    description="AI агент — персональный стилист"
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры
from app.api.v1.search import router as search_router
from app.api.v1.chat import router as chat_router
from app.api.v1.conversations import router as conversations_router

app.include_router(search_router)
app.include_router(chat_router)
app.include_router(conversations_router)   # ← только один раз!

# Монтируем папку uploads
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
async def root():
    return {
        "message": "AI Product Search Agent работает!",
        "status": "ok",
        "version": "0.1.0"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Запуск сервера
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )