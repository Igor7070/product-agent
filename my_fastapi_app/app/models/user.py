from sqlalchemy import Column, Integer, String, JSON
from app.models.base import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    preferred_style = Column(String, nullable=True)
    budget = Column(String, nullable=True)
    measurements = Column(String, nullable=True)
    brands = Column(String, nullable=True)
    colors = Column(String, nullable=True)
    data = Column(JSON, nullable=True)