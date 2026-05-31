# 🧾 BillCore

> Universal billing system for home utility tracking and telecom operators.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.22-00ADD8?logo=go)](https://golang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://postgresql.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)](https://nextjs.org)

---

## 🗂️ Project structure

```
billcore/
├── cmd/server/              # entry point, graceful shutdown
├── internal/
│   ├── config/              # env config
│   ├── db/                  # pgx pool, migration runner
│   ├── domain/              # domain structs (no dependencies)
│   ├── migrations/
│   │   ├── embed.go         # embeds SQL files into the binary
│   │   └── sql/             # migration files
│   ├── repository/          # SQL queries
│   ├── service/             # business logic
│   └── api/                 # HTTP router, middleware, handlers
├── web/                     # Next.js 15 frontend
│   ├── app/
│   │   ├── clients/         # clients CRUD + detail view
│   │   ├── services/        # services + tariffs
│   │   ├── calculations/    # accruals management
│   │   ├── payments/        # payment history
│   │   └── _components/     # shared UI components
│   ├── lib/api.ts           # typed API client
│   └── types/index.ts       # domain types
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── README.md
```

---

## ⚙️ Tech stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Database   | PostgreSQL 16                       |
| Backend    | Go 1.22, Chi router, pgx/v5         |
| Migrations | golang-migrate                      |
| Frontend   | Next.js 15, React 19, Bootstrap 5   |

---

## 🚀 Getting started

### 1. Clone the repo

```bash
git clone https://github.com/rguziy/billcore.git
cd billcore
```

### 2. Copy env file and edit

```bash
cp .env.example .env
```

Edit `.env` with your database credentials and JWT secret:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=billcore
DB_PASSWORD=secret
DB_NAME=billcore
SERVER_PORT=8080
JWT_SECRET=change-me-in-production
```

### 3. Install golang-migrate

```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

Add Go binaries to your PATH (add to `~/.bashrc` or `~/.profile`):

```bash
export PATH=$PATH:~/go/bin
source ~/.bashrc
```

Verify:

```bash
migrate -version
```

### 4. Start PostgreSQL

```bash
make docker-up
```

Or use an existing PostgreSQL instance — just update `.env` accordingly.

### 5. Run migrations

```bash
make migrate-up
```

### 6. Start the API server

```bash
make run
```

### 7. Start the frontend

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To run API and frontend simultaneously:

```bash
make dev
```

---

## 🗃️ Database migrations

```bash
make migrate-up           # apply all pending migrations
make migrate-down         # rollback last migration
make migrate-create       # create a new migration (prompts for name)
```

### ⚠️ Dirty database state

If a migration fails midway, the database may be left in a dirty state.
You will see an error like:

```
error: Dirty database version 1. Fix and force version.
```

To recover, force the version to the last known good state and re-run:

```bash
# force version to 0 (before any migrations)
make migrate-force V=0

# or force to a specific version if some migrations already succeeded
make migrate-force V=1

# then re-apply
make migrate-up
```

To wipe the database and start fresh:

```bash
psql "postgres://billcore:secret@localhost:5432/billcore" \
  -c "DROP SCHEMA IF EXISTS billcore CASCADE;"

make migrate-force V=0
make migrate-up
```

---

## 🛠️ Makefile reference

| Command               | Description                          |
|-----------------------|--------------------------------------|
| `make run`            | Start the Go API server              |
| `make build`          | Build binary to `bin/billcore`       |
| `make test`           | Run all tests                        |
| `make migrate-up`     | Apply all pending migrations         |
| `make migrate-down`   | Rollback last migration              |
| `make migrate-force`  | Force migration version (`V=n`)      |
| `make migrate-create` | Create new migration file            |
| `make web-install`    | Install frontend dependencies        |
| `make web-dev`        | Start Next.js dev server             |
| `make web-build`      | Build frontend for production        |
| `make dev`            | Run API + frontend simultaneously    |
| `make docker-up`      | Start PostgreSQL via Docker Compose  |
| `make docker-down`    | Stop Docker Compose services         |

---

## 📄 License

MIT © 2025 [Ruslan Huzii](https://github.com/rguziy)