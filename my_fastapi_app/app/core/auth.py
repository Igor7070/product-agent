from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

security = HTTPBearer(auto_error=False)

async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials or not credentials.credentials:
        print("[DEBUG AUTH] No credentials found -> 401 Unauthorized")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Необходима авторизация"
        )
    
    token = credentials.credentials
    print(f"[DEBUG AUTH] Token received: {token[:25]}...")
    
    try:
        # Извлекаем данные из Google ID Token (sub — это уникальный ID пользователя в Google)
        payload = jwt.get_unverified_claims(token)
        user_id = payload.get("sub") or payload.get("email")
        
        print(f"[DEBUG AUTH] Decoded user_id: {user_id}")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Не удалось получить ID пользователя из токена"
            )
            
        return user_id

    except JWTError as e:
        print(f"[DEBUG AUTH] JWT Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Невалидный токен авторизации"
        )
    except Exception as e:
        print(f"[DEBUG AUTH] Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Ошибка при проверке токена"
        )