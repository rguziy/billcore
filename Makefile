include .env
export

MIGRATE := $(HOME)/go/bin/migrate
MIGRATE_PATH := ./internal/migrations/sql
DB_URL := postgres://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable

.PHONY: run build test lint \
        migrate-up migrate-down migrate-force migrate-create \
        web-install web-dev web-build web-start \
        docker-up docker-down dev

# --- Go API ---

run:
	go run ./cmd/server

build:
	go build -o bin/billcore ./cmd/server

test:
	go test ./...

lint:
	golangci-lint run ./...

# --- Migrations ---

migrate-up:
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(DB_URL)" up

migrate-down:
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(DB_URL)" down 1

migrate-force:
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(DB_URL)" force $(V)

migrate-create:
	@read -p "Migration name: " name; \
	$(MIGRATE) create -ext sql -dir $(MIGRATE_PATH) -seq $$name

# --- Next.js ---

web-install:
	cd web && npm install

web-dev:
	cd web && npm install && npm run dev

web-build:
	cd web && npm install && npm run build

web-start:
	cd web && npm run start

# --- Docker ---

docker-up:
	docker compose up -d

docker-down:
	docker compose down

# --- Dev: run API + Next.js simultaneously ---

dev:
	make -j2 run web-dev