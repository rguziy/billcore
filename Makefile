include .env
export

VERSION    := $(shell cat VERSION)
MIGRATE    := $(HOME)/go/bin/migrate
MIGRATE_PATH := ./internal/migrations/sql
DB_URL     := postgres://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable
LDFLAGS    := -ldflags "-X main.Version=$(VERSION)"
IMAGE_NAME := billcore

.PHONY: run build test migrate-up migrate-down migrate-force migrate-create \
        web-install web-dev web-build web-start \
        docker-build docker-up docker-down dev release

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
