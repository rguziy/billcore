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
├── cmd/server/              # Go entry point — serves API + embedded Next.js static files
│   └── web/out/             # Placeholder (replaced by make web-build or Docker)
├── internal/
│   ├── config/              # Env config
│   ├── db/                  # pgx pool, migration runner
│   ├── domain/              # Domain structs (no dependencies)
│   ├── migrations/
│   │   ├── embed.go         # Embeds SQL files into binary
│   │   └── sql/             # Migration files (000001…)
│   ├── repository/          # SQL queries
│   ├── service/             # Business logic
│   └── api/                 # HTTP router, middleware, handlers
├── web/                     # Next.js 15 frontend (static export)
│   ├── app/                 # App router pages
│   ├── lib/                 # API client, auth helpers
│   └── types/               # Domain TypeScript types
├── VERSION                  # Single source of version (e.g. v0.1.0)
├── Dockerfile               # Multi-stage: Node → Go → Alpine
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## ⚙️ Tech stack

| Layer      | Technology                                |
|------------|-------------------------------------------|
| Database   | PostgreSQL 16                             |
| Backend    | Go 1.22, Chi router, pgx/v5, bcrypt       |
| Migrations | golang-migrate (embedded in binary)       |
| Frontend   | Next.js 15 (static export), Bootstrap 5  |
| Auth       | JWT (HS256), role-based (admin/manager/operator) |

---

## 👥 Roles

| Feature                        | Operator | Manager | Admin |
|-------------------------------|----------|---------|-------|
| Clients, Locations, Subscriptions, Calculations | ✅ | ✅ | ✅ |
| Statistics                    | ❌       | ✅      | ✅    |
| Services, Tariffs (CRUD)      | 👁 read  | ✅      | ✅    |
| Periods (open/close)          | 👁 read  | ✅      | ✅    |
| Users (CRUD)                  | ❌       | ❌      | ✅    |

Default pages after login: **Operator** → `/clients`, **Manager** → `/statistics`, **Admin** → `/users`

---

## 🚀 Getting started (local development)

### 1. Clone

```bash
git clone https://github.com/rguziy/billcore.git
cd billcore
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit DB credentials and JWT_SECRET (use: openssl rand -hex 32)

cp web/.env.local.example web/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 3. Install golang-migrate

```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
export PATH=$PATH:~/go/bin
```

### 4. Start PostgreSQL

```bash
make docker-up
```

### 5. Run migrations

```bash
make migrate-up
```

### 6. Start API + frontend (two terminals or simultaneously)

```bash
# Option A: simultaneously
make dev

# Option B: separately
make run          # Go API on :8080
make web-dev      # Next.js on :3000
```

Open [http://localhost:3000](http://localhost:3000)

Default credentials: `admin / admin`, `manager / manager`

---


## 🎮 Demo data

Want to explore BillCore with realistic data? Load the demo dataset:

```bash
# Make sure PostgreSQL is running and migrations applied
make demo-data
```

This creates **5 clients**, **10 services**, **3 billing periods** (Jan–Mar 2025 with partial payments), locations, subscriptions and calculations — ready to explore.

See the **[User Guide](docs/USER_GUIDE.md)** for a step-by-step walkthrough of all features using the demo data.

---
## 🐳 Docker (production)

### Build image

```bash
make docker-build
# builds billcore:v0.1.0 and billcore:latest
```

This creates a **single image** containing:
- Go binary (API + migrations)
- Next.js static files (embedded via `go:embed`)

Everything runs on **one port (:8080)**.

### Run with Docker Compose

```bash
# Copy and edit .env
cp .env.example .env

make docker-up
```

Open [http://localhost:8080](http://localhost:8080)

---

## 📦 Versioning & release

Version is stored in `VERSION` file and propagated to:
- Go binary (`-ldflags "-X main.Version=..."`)
- Next.js build (`NEXT_PUBLIC_VERSION`)
- Docker image tag

### Create a release

```bash
make release V=v0.2.0
# Updates VERSION, package.json, commits, tags

git push && git push --tags
```

---

## 🗃️ Migrations

```bash
make migrate-up           # Apply all pending migrations
make migrate-down         # Rollback last migration
make migrate-create       # Create new migration (prompts for name)
```

### Dirty database state

If a migration fails midway:

```bash
# Force version to last known good state
make migrate-force V=1

# Then re-apply
make migrate-up
```

To wipe and start fresh:

```bash
psql "postgres://billcore:secret@localhost:5432/billcore" \
  -c "DROP SCHEMA IF EXISTS billcore CASCADE;"

make migrate-force V=0
make migrate-up
```

---

## 🛠️ Makefile reference

| Command               | Description                                        |
|-----------------------|----------------------------------------------------|
| `make run`            | Start Go API server (dev)                          |
| `make build`          | Build Go binary to `bin/billcore`                  |
| `make web-dev`        | Start Next.js dev server on :3000                  |
| `make web-build`      | Build Next.js static export → `cmd/server/web/out` |
| `make dev`            | Run API + Next.js simultaneously                   |
| `make migrate-up`     | Apply all pending migrations                       |
| `make migrate-down`   | Rollback last migration                            |
| `make migrate-force`  | Force migration version (`V=n`)                    |
| `make migrate-create` | Create new migration file                          |
| `make docker-build`   | Build production Docker image                      |
| `make docker-up`      | Start services via Docker Compose                  |
| `make docker-down`    | Stop Docker Compose services                       |
| `make release`        | Tag new release (`V=v0.x.0`)                       |

---

## 📄 License

MIT © 2025 [Ruslan Huzii](https://github.com/rguziy)
