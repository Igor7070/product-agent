from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import os

SECRET_KEY = os.getenv("NEXTAUTH_SECRET")
ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)

async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    print(f"[DEBUG AUTH] Headers: {dict(request.headers)}")  # ← Покажет все заголовки
    
    if not credentials or not credentials.credentials:
        print("[DEBUG AUTH] No credentials found → using default_user")
        return "default_user"
    
    token = credentials.credentials
    print(f"[DEBUG AUTH] Token received: {token[:30]}...")  # первые 30 символов
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub") or payload.get("id") or payload.get("user_id")
        print(f"[DEBUG AUTH] Decoded user_id: {user_id}")
        return user_id or "default_user"
    except JWTError as e:
        print(f"[DEBUG AUTH] JWT Error: {str(e)}")
        return "default_user"
    except Exception as e:
        print(f"[DEBUG AUTH] Unexpected error: {str(e)}")
        return "default_user"