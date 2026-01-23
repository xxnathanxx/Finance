from __future__ import annotations

from sqlalchemy import text

from app.database import SessionLocal


def main() -> None:
    db = SessionLocal()
    try:
        value = db.execute(text("select 1")).scalar()
        print("DB OK -> select 1 =", value)
    finally:
        db.close()


if __name__ == "__main__":
    main()
