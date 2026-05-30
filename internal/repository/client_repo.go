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

	var clients []domain.Client
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

	var locs []domain.Location
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
