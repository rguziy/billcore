package db

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rguziy/billcore/internal/migrations"
)

var Version = "dev"

func RunMigrations(dsn string) error {
	if err := ensureSchema(dsn); err != nil {
		return fmt.Errorf("ensure schema: %w", err)
	}

	src, err := iofs.New(migrations.Files, "sql")
	if err != nil {
		return fmt.Errorf("load migration source: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", src, dsn)
	if err != nil {
		return fmt.Errorf("init migrate: %w", err)
	}
	defer m.Close()

	version, dirty, verErr := m.Version()
	if verErr == nil {
		slog.Info("migration state", "version", version, "dirty", dirty)
		if dirty {
			forceVersion := int(version) - 1
			if forceVersion < 0 {
				forceVersion = 0
			}
			slog.Warn("dirty state — forcing back", "from", version, "to", forceVersion)
			if err := m.Force(forceVersion); err != nil {
				return fmt.Errorf("force version %d: %w", forceVersion, err)
			}
		}
	}

	if err := m.Up(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			slog.Info("migrations: already up to date")
			return nil
		}
		return fmt.Errorf("run migrations: %w", err)
	}

	slog.Info("migrations: applied successfully")
	return nil
}

func ensureSchema(dsn string) error {
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	defer pool.Close()

	if _, err = pool.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS billcore`); err != nil {
		return fmt.Errorf("create schema: %w", err)
	}
	slog.Info("schema billcore ready")
	return nil
}
