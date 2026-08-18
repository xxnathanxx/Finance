# Órbita

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

Os testes atuais cobrem `app/auth/security.py` (hash e verificação de senha, criação e validação de tokens JWT), além de testes de integração para categorias e transações em `backend/tests/test_categories_api.py` e `backend/tests/test_transactions_api.py`.

## App desktop (offline, sem navegador)

Existe uma versão empacotada como `.exe` (Windows) pensada pra teste local: abre numa janela nativa própria (sem precisar de navegador), com um banco SQLite embutido - sem Postgres, Docker ou internet.

Pra gerar o `.exe`:

```bash
cd frontend
npm run build

cd ../backend
xcopy /E /I ..\frontend\dist frontend_dist   # no Windows; use `cp -r ../frontend/dist frontend_dist` no Linux/macOS
pip install -r requirements-desktop.txt

pyinstaller --name OrbitaDesktop --onefile --windowed ^
  --add-data "frontend_dist;frontend_dist" ^
  --hidden-import passlib.handlers.bcrypt ^
  --hidden-import passlib.handlers.pbkdf2 ^
  desktop_app.py
```

O executável fica em `backend/dist/OrbitaDesktop.exe`. Na primeira vez que roda, ele cria sozinho o banco em `%LOCALAPPDATA%\Orbita\finance.db`, as tabelas, as categorias padrão, e um usuário admin (`admin@local.app` / `admin123456`, configurável nas variáveis de ambiente `ADMIN_EMAIL`/`ADMIN_PASSWORD` dentro de `desktop_app.py`).

### Gerando o instalador (Inno Setup)

O `.exe` acima é portátil (roda de onde estiver). Pra ter um instalador de verdade - com tela de escolha de pasta, atalho no menu iniciar, ícone opcional na área de trabalho e desinstalador registrado no Windows - use o script em `installer/OrbitaSetup.iss` com o [Inno Setup](https://jrsoftware.org/isinfo.php) (grátis):

```bash
# depois de gerar backend/dist/OrbitaDesktop.exe (passo acima)
"C:\Program Files\Inno Setup 7\ISCC.exe" installer\OrbitaSetup.iss
```

O instalador final fica em `installer/output/OrbitaSetup.exe`. Ele não pede permissão de administrador (instala em `%LOCALAPPDATA%\Programs\Orbita` por padrão, mas deixa escolher outra pasta).
