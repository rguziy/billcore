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
│   ├── db/                  # pgx pool, migration runner (auto-creates billcore schema)
│   ├── domain/              # Domain structs
│   ├── migrations/
│   │   ├── embed.go         # Embeds SQL files into binary
│   │   └── sql/             # Migration files (000001…)
│   ├── repository/          # SQL queries
│   ├── service/             # Business logic
│   └── api/                 # HTTP router, middleware, handlers
├── web/                     # Next.js 15 frontend (static export)
├── scripts/
│   └── demo_data.sql        # Demo data for exploration
├── docs/
│   └── USER_GUIDE.md        # Step-by-step user guide with demo data
├── VERSION                  # Single source of version (e.g. v0.1.0)
├── Dockerfile               # Multi-stage: Node → Go → Alpine (single image)
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
| Migrations | golang-migrate (embedded in binary, auto-run on start) |
| Frontend   | Next.js 15 (static export), Bootstrap 5  |
| Auth       | JWT (HS256), role-based (admin/manager/operator) |
| Localization | UI translations, Ukrainian + English, preferred language persisted per user |

---

## 👥 Roles

| Feature                                        | Operator | Manager | Admin |
|------------------------------------------------|----------|---------|-------|
| Clients, Locations, Subscriptions, Calculations | ✅      | ✅      | ✅    |
| Statistics                                     | ❌       | ✅      | ✅    |
| Services, Tariffs (CRUD)                       | 👁 read  | ✅      | ✅    |
| Periods (open/close)                           | 👁 read  | ✅      | ✅    |
| Users (CRUD)                                   | ❌       | ❌      | ✅    |

Default pages after login: **Operator** → `/clients`, **Manager** → `/statistics`, **Admin** → `/users`

> UI supports English and Ukrainian. Users can select their preferred language, which is stored in their profile and applied automatically after login.

---

## 📺 User Interface Preview

Discover the look and feel of the BillCore UI, packed with features for billing and management (using realistic demo data):

### 🔑 Sign-In Page (Multi-language Support)
Allows users to switch languages (English/Ukrainian) before authenticating. The selected language is instantly saved to the user's profile.
![Sign-In Page](docs/login.png)

### 📊 Real-Time Statistics & Dashboard
Provides managers and admins with a complete financial and structural overview of the current billing period, active users, and service statuses at a glance.
![Dashboard](docs/statistics.png)

### ⚙️ Services & Tariffs Management
The control panel for configuring billing units and meter options. Features a clear history of tariff changes and visual alerts for missing rates.
![Services list](docs/services.png)

### 🧮 Daily Operations & Billing Calculations
The primary workspace for operators. Easily filter calculations by period or client, input current meter readings with live volume calculation, and track payment status.
![Calculations and Meter Readings](docs/calculations.png)

### 👤 Client Management & Profiles
A comprehensive view of client records, including contact information, physical locations, service subscriptions, and detailed payment history.
![Client Details](docs/detail.png)

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
# Edit .env — set DB credentials and JWT_SECRET:
# openssl rand -hex 32
```

### 3. Install golang-migrate

```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
export PATH=$PATH:~/go/bin
migrate -version
```

### 4. Create PostgreSQL database

Connect to PostgreSQL as a superuser and run:

```sql
CREATE USER billcore WITH PASSWORD 'secret';
CREATE DATABASE billcore OWNER billcore ENCODING 'UTF8';
```

> **Docker alternative:** skip this step and use `make docker-up` instead (see [Docker section](#-docker-production)).

> **Install psql client (if needed):**
> ```bash
> sudo apt update && sudo apt install -y postgresql-client
> ```

### 5. Start the API server

```bash
make run
```

The server automatically:
1. Creates the `billcore` schema if it doesn't exist
2. Runs all pending migrations
3. Starts serving on `:8080`

> **Note:** `make migrate-up` can still be used to run migrations manually, but running `make run` is sufficient — migrations are embedded in the binary and run automatically on every start.

### 6. Start the frontend (separate terminal)

```bash
cd web
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8080
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Or run both simultaneously:

```bash
make dev
```

Default credentials: `admin / admin`, `manager / manager`

---

## 🐳 Docker (production)

### Build image

```bash
make docker-build
# builds billcore:v0.1.0 and billcore:latest
```

Single image containing Go binary + embedded Next.js static files. One port (`:8080`).

### Run with Docker Compose

```bash
cp .env.example .env
# Edit JWT_SECRET — required!

make docker-up
```

Open [http://localhost:8080](http://localhost:8080)

```bash
make docker-down        # stop (data preserved)
make docker-down && docker volume rm billcore_postgres_data  # stop + wipe data
```

---

## 📦 Versioning & release

Version is stored in `VERSION` file and propagated to Go binary, Next.js build, and Docker image tag.

```bash
make release V=v0.2.0
# Updates VERSION, package.json, commits, creates git tag

git push && git push --tags
```

---

## 🎮 Demo data

Load realistic demo data to explore the system:

```bash
# Requires psql client: sudo apt install -y postgresql-client
make demo-data
```

Creates: **5 clients**, **10 services with tariffs**, **3 billing periods** (Jan 2025 paid, Feb 2025 partial, Mar 2025 open with pending meter readings), locations, subscriptions and calculations.

---

## 📖 User Guide

See **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)** for a step-by-step walkthrough of all features using the demo data, including screenshots placeholders for each section.

---

## 🗃️ Migrations

Migrations run **automatically on server start** via the embedded `golang-migrate`. Manual CLI commands are available for development:

```bash
make migrate-up           # Apply all pending migrations manually
make migrate-down         # Rollback last migration
make migrate-force V=n    # Force migration to version n (fix dirty state)
make migrate-create       # Create new migration file (prompts for name)
```

### Dirty database state

If a migration fails midway, the server auto-recovers by forcing the version back and retrying. If you need to fix manually:

```bash
make migrate-force V=1    # force to version before the failure
make migrate-up           # retry
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
| `make run`            | Start Go API server (runs migrations automatically)|
| `make build`          | Build Go binary to `bin/billcore`                  |
| `make test`           | Run all tests                                      |
| `make migrate-up`     | Apply pending migrations manually via CLI          |
| `make migrate-down`   | Rollback last migration                            |
| `make migrate-force`  | Force migration version (`V=n`)                    |
| `make migrate-create` | Create new migration file                          |
| `make demo-data`      | Load demo data from `scripts/demo_data.sql`        |
| `make web-install`    | Install frontend dependencies                      |
| `make web-dev`        | Start Next.js dev server on :3000                  |
| `make web-build`      | Build Next.js static export → `cmd/server/web/out` |
| `make web-start`      | Start Next.js production server                    |
| `make dev`            | Run API + Next.js simultaneously                   |
| `make docker-build`   | Build production Docker image                      |
| `make docker-up`      | Start services via Docker Compose                  |
| `make docker-down`    | Stop Docker Compose services                       |
| `make release`        | Tag new release (`V=v0.x.0`)                       |

---

## 📄 License

MIT © 2025 [Ruslan Huzii](https://github.com/rguziy)
