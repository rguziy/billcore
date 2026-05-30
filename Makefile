include .env
export

MIGRATE := $(HOME)/go/bin/migrate
MIGRATE_PATH := ./internal/migrations/sql
DB_URL := postgres://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable

.PHONY: run build test migrate-up migrate-down migrate-force migrate-create lint docker-up docker-down

run:
	go run ./cmd/server

build:
	go build -o bin/billcore ./cmd/server

test:
	go test ./...

migrate-up:
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(DB_URL)" up

migrate-down:
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(DB_URL)" down 1

# Use when database is in dirty state: make migrate-force V=1
migrate-force:
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(DB_URL)" force $(V)

migrate-create:
	@read -p "Migration name: " name; \
	$(MIGRATE) create -ext sql -dir $(MIGRATE_PATH) -seq $$name

lint:
	golangci-lint run ./...

docker-up:
	docker compose up -d

docker-down:
	docker compose down
