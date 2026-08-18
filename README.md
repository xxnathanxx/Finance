# Finance

Aplicação de controle financeiro com backend em FastAPI e frontend em React + TypeScript (Vite).

## Estrutura do projeto

- `backend/` — API em FastAPI (autenticação, categorias, transações e relatórios), com migrações via Alembic.
- `frontend/` — Interface em React + TypeScript, construída com Vite.
- `docker-compose.yml` — Sobe um banco PostgreSQL local para desenvolvimento.

## Pré-requisitos

- Python 3.11+
- Node.js 18+
- Docker (para o banco de dados) ou uma instância PostgreSQL própria

## Rodando o banco de dados

```bash
docker compose up -d
```

Isso sobe um PostgreSQL em `localhost:5432` com o banco `finance` (usuário/senha `finance` / `finance123`, definidos em `docker-compose.yml`).

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # no Windows; use `source .venv/bin/activate` no Linux/macOS
pip install -r requirements.txt

# crie um arquivo .env em backend/ com as variáveis:
# DATABASE_URL=postgresql://finance:finance123@localhost:5432/finance
# JWT_SECRET_KEY=uma-chave-secreta-com-pelo-menos-16-caracteres

python create_tables.py
uvicorn app.main:app --reload
```

A API sobe em `http://localhost:8000`. Um endpoint de health check está disponível em `GET /health`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend sobe em `http://localhost:5173` e já está configurado (via CORS no backend) para consumir a API local.

## Testes

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

Os testes atuais cobrem `app/auth/security.py` (hash e verificação de senha, criação e validação de tokens JWT).
