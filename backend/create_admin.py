from __future__ import annotations

from app.database import SessionLocal
from app.models import User
from app.auth.security import hash_password


def main() -> None:
    db = SessionLocal()
    try:
        email = "admin@finance.local"
        password = "Admin#123456"
        name = "Admin"

        exists = db.query(User).filter(User.email == email).first()
        if exists:
            print("Admin já existe:", exists.email)
            return

        user = User(
            email=email,
            name=name,
            password_hash=hash_password(password),
            role="ADMIN",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        print("Admin criado com sucesso:", user.email, "role=", user.role)
    finally:
        db.close()


if __name__ == "__main__":
    main()
