-include .env
export

.DEFAULT_GOAL := help

VERSION    := $(shell cat VERSION)
MIGRATE    := $(HOME)/go/bin/migrate
MIGRATE_PATH := ./internal/migrations/sql
DB_URL     := postgres://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable
LDFLAGS    := -ldflags "-X main.Version=$(VERSION)"
IMAGE_NAME := billcore

.PHONY: help run build test migrate-up migrate-down migrate-force migrate-create demo-data \
        web-install web-dev web-build web-start \
        docker-build docker-up docker-down dev release

help:
	@echo "Available commands:"
	@echo "  make help             Show this help"
	@echo "  make run              Start Go API server (dev)"
	@echo "  make build            Build Go binary to bin/billcore"
	@echo "  make test             Run Go tests"
	@echo "  make migrate-up       Apply all pending migrations"
	@echo "  make migrate-down     Rollback last migration"
	@echo "  make migrate-force    Force migration version (V=n)"
	@echo "  make migrate-create   Create a new migration file"
	@echo "  make demo-data        Load demo data from scripts/demo_data.sql"
	@echo "  make web-install      Install frontend dependencies"
	@echo "  make web-dev          Start Next.js dev server on :3000"
	@echo "  make web-build        Build Next.js static export"
	@echo "  make web-start        Start Next.js production server"
	@echo "  make docker-build     Build production Docker image"
	@echo "  make docker-up        Start services via Docker Compose"
	@echo "  make docker-down      Stop Docker Compose services"
	@echo "  make dev              Run API + Next.js simultaneously"
	@echo "  make release          Tag new release (V=v0.x.0)"

# ── Go ──────────────────────────────────────────────────────────────────────

run:
	go run $(LDFLAGS) ./cmd/server

build:
	go build $(LDFLAGS) -o bin/billcore ./cmd/server

test:
	go test ./...

# ── Migrations ───────────────────────────────────────────────────────────────

migrate-up:
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(DB_URL)" up

migrate-down:
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(DB_URL)" down 1

migrate-force:
	$(MIGRATE) -path $(MIGRATE_PATH) -database "$(DB_URL)" force $(V)

migrate-create:
	@read -p "Migration name: " name; \
	$(MIGRATE) create -ext sql -dir $(MIGRATE_PATH) -seq $$name

# Load demo data (requires running PostgreSQL)
demo-data:
	psql "$(DB_URL)" -f scripts/demo_data.sql

# ── Next.js ──────────────────────────────────────────────────────────────────

web-install:
	cd web && npm install

web-dev:
	cd web && npm install && NEXT_PUBLIC_VERSION=$(VERSION) npm run dev

web-build:
	cd web && npm install && NEXT_PUBLIC_VERSION=$(VERSION) npm run build
	rm -rf cmd/server/web/out && cp -r web/out cmd/server/web/out
	@echo "Static files copied to cmd/server/web/out"

web-start:
	cd web && NEXT_PUBLIC_VERSION=$(VERSION) npm run start

# ── Docker ───────────────────────────────────────────────────────────────────

docker-build:
	docker build \
		--build-arg VERSION=$(VERSION) \
		-t $(IMAGE_NAME):$(VERSION) \
		-t $(IMAGE_NAME):latest \
		.

docker-up:
	docker compose up -d

docker-down:
	docker compose down

# ── Dev (API + web simultaneously) ───────────────────────────────────────────

dev:
	make -j2 run web-dev

# ── Release ──────────────────────────────────────────────────────────────────
# Usage: make release V=v0.2.0

release:
	@if [ -z "$(V)" ]; then echo "Usage: make release V=v0.2.0"; exit 1; fi
	@echo "$(V)" > VERSION
	@sed -i "s/version: \".*\"/version: \"$(V)\"/" web/package.json
	git add VERSION web/package.json
	git commit -m "release: $(V)"
	git tag $(V)
	@echo "Released $(V). Run: git push && git push --tags"
