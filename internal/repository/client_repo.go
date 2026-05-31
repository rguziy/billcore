package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rguziy/billcore/internal/domain"
)

type ClientRepo struct {
	db *pgxpool.Pool
}

func NewClientRepo(db *pgxpool.Pool) *ClientRepo {
	return &ClientRepo{db: db}
}

func (r *ClientRepo) GetAll(ctx context.Context) ([]domain.Client, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, full_name, phone, email, account_number, is_active, created_at, updated_at
		FROM billcore.clients
		ORDER BY full_name
	`)
	if err != nil {
		return nil, fmt.Errorf("clients get all: %w", err)
	}
	defer rows.Close()

	clients := make([]domain.Client, 0)
	for rows.Next() {
		var c domain.Client
		if err := rows.Scan(
			&c.ID, &c.FullName, &c.Phone, &c.Email,
			&c.AccountNumber, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("clients scan: %w", err)
		}
		clients = append(clients, c)
	}
	return clients, nil
}

func (r *ClientRepo) GetByID(ctx context.Context, id int) (*domain.Client, error) {
	var c domain.Client
	err := r.db.QueryRow(ctx, `
		SELECT id, full_name, phone, email, account_number, is_active, created_at, updated_at
		FROM billcore.clients
		WHERE id = $1
	`, id).Scan(
		&c.ID, &c.FullName, &c.Phone, &c.Email,
		&c.AccountNumber, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("clients get by id: %w", err)
	}
	return &c, nil
}

func (r *ClientRepo) Create(ctx context.Context, c *domain.Client) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO billcore.clients (full_name, phone, email, account_number)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`, c.FullName, c.Phone, c.Email, c.AccountNumber,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *ClientRepo) Update(ctx context.Context, c *domain.Client) error {
	_, err := r.db.Exec(ctx, `
		UPDATE billcore.clients
		SET full_name = $1, phone = $2, email = $3, is_active = $4
		WHERE id = $5
	`, c.FullName, c.Phone, c.Email, c.IsActive, c.ID)
	return err
}

func (r *ClientRepo) Delete(ctx context.Context, id int) error {
	_, err := r.db.Exec(ctx, `DELETE FROM billcore.clients WHERE id = $1`, id)
	return err
}

// --- Locations ---

func (r *ClientRepo) GetAllLocations(ctx context.Context) ([]domain.Location, error) {
	rows, err := r.db.Query(ctx, `
		SELECT l.id, l.client_id, l.name, l.address, l.is_default, l.created_at,
		       c.full_name, c.account_number
		FROM billcore.locations l
		JOIN billcore.clients c ON c.id = l.client_id
		ORDER BY c.full_name, l.is_default DESC, l.name
	`)
	if err != nil {
		return nil, fmt.Errorf("locations get all: %w", err)
	}
	defer rows.Close()

	locs := make([]domain.Location, 0)
	for rows.Next() {
		var l domain.Location
		if err := rows.Scan(
			&l.ID, &l.ClientID, &l.Name, &l.Address, &l.IsDefault, &l.CreatedAt,
			&l.ClientName, &l.AccountNumber,
		); err != nil {
			return nil, fmt.Errorf("locations scan: %w", err)
		}
		locs = append(locs, l)
	}
	return locs, nil
}

func (r *ClientRepo) GetLocations(ctx context.Context, clientID int) ([]domain.Location, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, client_id, name, address, is_default, created_at
		FROM billcore.locations
		WHERE client_id = $1
		ORDER BY is_default DESC, name
	`, clientID)
	if err != nil {
		return nil, fmt.Errorf("locations get: %w", err)
	}
	defer rows.Close()

	locs := make([]domain.Location, 0)
	for rows.Next() {
		var l domain.Location
		if err := rows.Scan(&l.ID, &l.ClientID, &l.Name, &l.Address, &l.IsDefault, &l.CreatedAt); err != nil {
			return nil, fmt.Errorf("locations scan: %w", err)
		}
		locs = append(locs, l)
	}
	return locs, nil
}

func (r *ClientRepo) CreateLocation(ctx context.Context, l *domain.Location) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO billcore.locations (client_id, name, address, is_default)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`, l.ClientID, l.Name, l.Address, l.IsDefault,
	).Scan(&l.ID, &l.CreatedAt)
}

func (r *ClientRepo) UpdateLocation(ctx context.Context, l *domain.Location) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("locations update begin: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := tx.QueryRow(ctx, `
		SELECT client_id
		FROM billcore.locations
		WHERE id = $1
	`, l.ID).Scan(&l.ClientID); err != nil {
		return fmt.Errorf("locations get client: %w", err)
	}

	if l.IsDefault {
		if _, err := tx.Exec(ctx, `
			UPDATE billcore.locations
			SET is_default = FALSE
			WHERE client_id = $1 AND id <> $2
		`, l.ClientID, l.ID); err != nil {
			return fmt.Errorf("locations clear defaults: %w", err)
		}
	}

	if err := tx.QueryRow(ctx, `
		UPDATE billcore.locations
		SET name = $1, address = $2, is_default = $3
		WHERE id = $4
		RETURNING created_at
	`, l.Name, l.Address, l.IsDefault, l.ID).Scan(&l.CreatedAt); err != nil {
		return fmt.Errorf("locations update: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("locations update commit: %w", err)
	}
	return nil
}

func (r *ClientRepo) DeleteLocation(ctx context.Context, id int) error {
	var used bool
	if err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM billcore.subscriptions
			WHERE location_id = $1
		)
	`, id).Scan(&used); err != nil {
		return fmt.Errorf("locations check usage: %w", err)
	}
	if used {
		return fmt.Errorf("location is used by subscriptions")
	}

	tag, err := r.db.Exec(ctx, `DELETE FROM billcore.locations WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("locations delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("location not found")
	}
	return nil
}
