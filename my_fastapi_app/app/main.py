from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(
    title="Product Search AI Agent",
    version="0.1.0",
    description="AI агент — персональный стилист"
)

# ==================== CORS (обновлено для Vercel + Railway) ====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",           # все проекты на Vercel
        "https://product-agent-silk.vercel.app",   # твой конкретный домен
        "https://product-agent-dnutb9v22-igor707070.vercel.app",
        "https://perfect-flexibility-production-2fbc.up.railway.app",  # бэкенд
        "*"                               # временно оставляем для удобства
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== РОУТЕРЫ ====================
from app.api.v1.search import router as search_router
from app.api.v1.chat import router as chat_router
from app.api.v1.conversations import router as conversations_router

app.include_router(search_router, prefix="/search", tags=["search"])
app.include_router(chat_router, prefix="/chat", tags=["chat"])
app.include_router(conversations_router, prefix="/conversations", tags=["conversations"])

# ==================== STATIC FILES (фото) ====================
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ==================== БАЗОВЫЕ ЭНДПОИНТЫ ====================
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

# ==================== ЗАПУСК (только для локальной разработки) ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)