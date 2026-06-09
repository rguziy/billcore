# ── Stage 1: Build Next.js static files ──────────────────────────────────────
FROM node:20-alpine AS web-builder

ARG VERSION=dev
WORKDIR /app/web

ENV NEXT_TELEMETRY_DISABLED=1

COPY web/package*.json ./
RUN npm ci --prefer-offline

COPY web/ ./

RUN NEXT_PUBLIC_VERSION=${VERSION} \
    NEXT_PUBLIC_API_URL="" \
    npm run build


# ── Stage 2: Build Go binary ──────────────────────────────────────────────────
FROM golang:1.22-alpine AS go-builder

ARG VERSION=dev
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Embed Next.js static output into Go binary
COPY --from=web-builder /app/web/out ./cmd/server/web/out

RUN go build \
    -ldflags "-X main.Version=${VERSION}" \
    -o bin/billcore \
    ./cmd/server


# ── Stage 3: Final minimal image ──────────────────────────────────────────────
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=go-builder /app/bin/billcore .
COPY --from=go-builder /app/internal/migrations ./internal/migrations

EXPOSE 8080

ENTRYPOINT ["./billcore"]
