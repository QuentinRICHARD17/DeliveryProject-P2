from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    pseudo: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    score_global: int
    streak: int
    last_action_date: Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class ActionBase(BaseModel):
    category: str
    description: str
    photo_url: str

class ActionCreate(ActionBase):
    pass

class Action(ActionBase):
    id: int
    author_id: int
    created_at: datetime
    upvotes: int
    downvotes: int
    status: str

    class Config:
        from_attributes = True
