from datetime import date, datetime
from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    date: date
    description: str = Field(min_length=2, max_length=140)
    type: str = Field(pattern="^(INCOME|EXPENSE)$")
    amount: float

    status: str = Field(default="PAID", pattern="^(PAID|PENDING)$")
    payment_method: str = Field(default="PIX", pattern="^(PIX|DEBIT|CREDIT|CASH)$")
    is_recurring: bool = False

    installment_current: int | None = None
    installment_total: int | None = None

    month_ref: str = Field(pattern=r"^\d{4}-\d{2}$")  # YYYY-MM
    category_id: int | None = None


class TransactionResponse(BaseModel):
    id: int
    user_id: int

    date: date
    description: str
    type: str
    amount: float
    status: str
    payment_method: str
    is_recurring: bool

    installment_current: int | None
    installment_total: int | None
    month_ref: str
    category_id: int | None

    created_at: datetime

    class Config:
        from_attributes = True
