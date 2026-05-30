package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rguziy/billcore/internal/domain"
)

type CalculationRepo struct {
	db *pgxpool.Pool
}

func NewCalculationRepo(db *pgxpool.Pool) *CalculationRepo {
	return &CalculationRepo{db: db}
}

func (r *CalculationRepo) GetBySubscription(ctx context.Context, subscriptionID int) ([]domain.Calculation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, subscription_id, tariff_id, period_start,
		       reading_prev, reading_curr, quantity, amount, status, note, created_at, updated_at
		FROM billcore.calculations
		WHERE subscription_id = $1
		ORDER BY period_start DESC
	`, subscriptionID)
	if err != nil {
		return nil, fmt.Errorf("calculations get: %w", err)
	}
	defer rows.Close()

	var calcs []domain.Calculation
	for rows.Next() {
		var c domain.Calculation
		if err := rows.Scan(
			&c.ID, &c.SubscriptionID, &c.TariffID, &c.PeriodStart,
			&c.ReadingPrev, &c.ReadingCurr, &c.Quantity, &c.Amount,
			&c.Status, &c.Note, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("calculations scan: %w", err)
		}
		calcs = append(calcs, c)
	}
	return calcs, nil
}

func (r *CalculationRepo) GetPending(ctx context.Context, clientID int) ([]domain.Calculation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.subscription_id, c.tariff_id, c.period_start,
		       c.reading_prev, c.reading_curr, c.quantity, c.amount,
		       c.status, c.note, c.created_at, c.updated_at
		FROM billcore.calculations c
		JOIN billcore.subscriptions s  ON s.id = c.subscription_id
		JOIN billcore.locations     l  ON l.id = s.location_id
		WHERE l.client_id = $1 AND c.status = 'pending'
		ORDER BY c.period_start DESC
	`, clientID)
	if err != nil {
		return nil, fmt.Errorf("pending calculations: %w", err)
	}
	defer rows.Close()

	var calcs []domain.Calculation
	for rows.Next() {
		var c domain.Calculation
		if err := rows.Scan(
			&c.ID, &c.SubscriptionID, &c.TariffID, &c.PeriodStart,
			&c.ReadingPrev, &c.ReadingCurr, &c.Quantity, &c.Amount,
			&c.Status, &c.Note, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("pending scan: %w", err)
		}
		calcs = append(calcs, c)
	}
	return calcs, nil
}

func (r *CalculationRepo) Create(ctx context.Context, c *domain.Calculation) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO billcore.calculations
		    (subscription_id, tariff_id, period_start, reading_prev, reading_curr, quantity, amount, note)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at
	`, c.SubscriptionID, c.TariffID, c.PeriodStart,
		c.ReadingPrev, c.ReadingCurr, c.Quantity, c.Amount, c.Note,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *CalculationRepo) UpdateStatus(ctx context.Context, id int, status domain.CalculationStatus) error {
	_, err := r.db.Exec(ctx, `
		UPDATE billcore.calculations SET status = $1 WHERE id = $2
	`, status, id)
	return err
}

// GetByPeriod returns all calculations for a given month across all subscriptions of a client.
func (r *CalculationRepo) GetByPeriod(ctx context.Context, clientID int, period time.Time) ([]domain.Calculation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.subscription_id, c.tariff_id, c.period_start,
		       c.reading_prev, c.reading_curr, c.quantity, c.amount,
		       c.status, c.note, c.created_at, c.updated_at
		FROM billcore.calculations c
		JOIN billcore.subscriptions s ON s.id = c.subscription_id
		JOIN billcore.locations     l ON l.id = s.location_id
		WHERE l.client_id = $1 AND c.period_start = $2
		ORDER BY c.id
	`, clientID, period)
	if err != nil {
		return nil, fmt.Errorf("calculations by period: %w", err)
	}
	defer rows.Close()

	var calcs []domain.Calculation
	for rows.Next() {
		var c domain.Calculation
		if err := rows.Scan(
			&c.ID, &c.SubscriptionID, &c.TariffID, &c.PeriodStart,
			&c.ReadingPrev, &c.ReadingCurr, &c.Quantity, &c.Amount,
			&c.Status, &c.Note, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("period scan: %w", err)
		}
		calcs = append(calcs, c)
	}
	return calcs, nil
}
