from __future__ import annotations

import sys
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

# -----------------------------------------------------------------------------
# Garante que "backend/" esteja no PYTHONPATH para importar "app.*"
# (resolve ModuleNotFoundError: No module named 'app' no Windows)
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[1]  # backend/
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Agora os imports do projeto funcionam
from app.settings import settings  # noqa: E402
from app.database import Base  # noqa: E402
import app.models  # noqa: F401, E402  (carrega os models no metadata)

# -----------------------------------------------------------------------------
# Alembic config
# -----------------------------------------------------------------------------
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    # Usa a mesma URL do app (ex: postgresql+psycopg://...)
    return settings.DATABASE_URL


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(
        get_url(),
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
