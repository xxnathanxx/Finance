from app.db import Base, engine
import app.models  # garante que os models foram carregados


def main():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("✅ Tabelas recriadas com sucesso!")


if __name__ == "__main__":
    main()
