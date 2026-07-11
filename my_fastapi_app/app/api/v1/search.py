from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/search", tags=["search"])

class SearchRequest(BaseModel):
    query: str
    price_min: Optional[int] = None
    price_max: Optional[int] = None
    style: Optional[str] = None

class SearchResponse(BaseModel):
    status: str
    query: str
    results_count: int
    message: str

@router.post("/")
async def search_products(request: SearchRequest):
    """Простой поиск товаров"""
    # Пока просто заглушка
    if not request.query:
        raise HTTPException(status_code=400, detail="Запрос не может быть пустым")
    
    return SearchResponse(
        status="success",
        query=request.query,
        results_count=0,  # пока 0, позже будет настоящий поиск
        message=f"Поиск по запросу '{request.query}' запущен. Пока результатов нет."
    )