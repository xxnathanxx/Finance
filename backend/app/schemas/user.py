from datetime import datetime
from pydantic import BaseModel


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True
