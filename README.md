# BillCore

Universal billing system for home utility tracking and telecom operators.

## Tech stack

- **PostgreSQL 16** — database
- **Go 1.22** — REST API (Chi router)
- **golang-migrate** — database migrations
- **pgx/v5** — PostgreSQL driver

## Getting started

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

### 6. Start the server

```bash
make run
```

## Migrations

```bash
make migrate-up           # apply all pending migrations
make migrate-down         # rollback last migration
make migrate-create       # create a new migration (prompts for name)
```

### Dirty database state

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

If you want to wipe the database and start fresh:

```bash
# connect to psql and drop the schema
psql "postgres://billcore:secret@localhost:5432/billcore" \
  -c "DROP SCHEMA IF EXISTS billcore CASCADE;"

make migrate-force V=0
make migrate-up
```

## Project structure

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
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── README.md
```

## License

MIT
