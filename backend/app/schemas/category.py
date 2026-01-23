from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    group: str = Field(default="Geral", max_length=40)


class CategoryResponse(BaseModel):
    id: int
    name: str
    group: str

    class Config:
        from_attributes = True
