package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rguziy/billcore/internal/domain"
)

// DB wraps a pgx connection pool and provides automated transaction
// management with user auditing.
type DB struct {
	pool *pgxpool.Pool
}

// NewDB creates, validates, and initializes a new DB wrapper instance.
func NewDB(ctx context.Context, dsn string) (*DB, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &DB{pool: pool}, nil
}

// Close gracefully shuts down the underlying connection pool.
func (db *DB) Close() {
	db.pool.Close()
}

// Pool returns the raw *pgxpool.Pool for read-only operations
// or queries that do not require transactional isolation.
func (db *DB) Pool() *pgxpool.Pool {
	return db.pool
}

// WithTx automatically starts a transaction, sets the PostgreSQL session-local
// variable 'app.billcore_user' for audit-column triggers, executes the provided
// callback function, and safely handles Commit or Rollback.
func (db *DB) WithTx(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("db begin tx: %w", err)
	}
	// Defers are evaluated in LIFO order; Rollback runs first but does
	// nothing if the transaction is already committed.
	defer tx.Rollback(ctx)

	var userID int
	var found bool

	// Safely and statically extract the authenticated user ID using the shared domain key.
	// This approach is type-safe, natively fast, and eliminates reflection entirely.
	if id, ok := ctx.Value(domain.ContextUserID).(int); ok {
		userID = id
		found = true
	}

	// Inject the user ID into the PostgreSQL transaction scope if found.
	if found && userID > 0 {
		// Used set_config() function instead of SET LOCAL syntax.
		// This natively supports parameterized inputs ($1) inside utility scopes.
		// Argument 'true' means it acts exactly like SET LOCAL (scoped strictly to this transaction).
		_, err = tx.Exec(ctx, "SELECT set_config('app.billcore_user', $1::text, true);", fmt.Sprintf("%d", userID))
		if err != nil {
			return fmt.Errorf("db set audit user: %w", err)
		}
	}

	// Execute business logic inside the transactional block.
	if err := fn(tx); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("db commit tx: %w", err)
	}

	return nil
}
