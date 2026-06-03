package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rguziy/billcore/internal/domain"
)

type CalculationRepo struct {
	db *pgxpool.Pool
}

func NewCalculationRepo(db *pgxpool.Pool) *CalculationRepo {
	return &CalculationRepo{db: db}
}

func (r *CalculationRepo) GetByPeriod(ctx context.Context, periodID int) ([]domain.Calculation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, subscription_id, period_id, tariff_id,
		       reading_prev, reading_curr, quantity, amount, status, note, created_at, updated_at
		FROM billcore.calculations
		WHERE period_id = $1
		ORDER BY subscription_id
	`, periodID)
	if err != nil {
		return nil, fmt.Errorf("calculations by period: %w", err)
	}
	defer rows.Close()
	return scanCalculations(rows)
}

func (r *CalculationRepo) GetByPeriodAndClient(ctx context.Context, periodID, clientID int) ([]domain.Calculation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.subscription_id, c.period_id, c.tariff_id,
		       c.reading_prev, c.reading_curr, c.quantity, c.amount, c.status, c.note,
		       c.created_at, c.updated_at
		FROM billcore.calculations c
		JOIN billcore.subscriptions s  ON s.id = c.subscription_id
		JOIN billcore.locations     l  ON l.id = s.location_id
		WHERE c.period_id = $1 AND l.client_id = $2
		ORDER BY c.id
	`, periodID, clientID)
	if err != nil {
		return nil, fmt.Errorf("calculations by period+client: %w", err)
	}
	defer rows.Close()
	return scanCalculations(rows)
}

func (r *CalculationRepo) GetBySubscription(ctx context.Context, subscriptionID int) ([]domain.Calculation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, subscription_id, period_id, tariff_id,
		       reading_prev, reading_curr, quantity, amount, status, note, created_at, updated_at
		FROM billcore.calculations
		WHERE subscription_id = $1
		ORDER BY period_id DESC
	`, subscriptionID)
	if err != nil {
		return nil, fmt.Errorf("calculations by subscription: %w", err)
	}
	defer rows.Close()
	return scanCalculations(rows)
}

func (r *CalculationRepo) GetPending(ctx context.Context, clientID int) ([]domain.Calculation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.subscription_id, c.period_id, c.tariff_id,
		       c.reading_prev, c.reading_curr, c.quantity, c.amount,
		       c.status, c.note, c.created_at, c.updated_at
		FROM billcore.calculations c
		JOIN billcore.subscriptions s  ON s.id = c.subscription_id
		JOIN billcore.locations     l  ON l.id = s.location_id
		WHERE l.client_id = $1 AND c.status = 'pending'
		ORDER BY c.period_id DESC
	`, clientID)
	if err != nil {
		return nil, fmt.Errorf("pending calculations: %w", err)
	}
	defer rows.Close()
	return scanCalculations(rows)
}

func (r *CalculationRepo) Create(ctx context.Context, c *domain.Calculation) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO billcore.calculations
		    (subscription_id, period_id, tariff_id, reading_prev, reading_curr, quantity, amount, note)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at
	`, c.SubscriptionID, c.PeriodID, c.TariffID,
		c.ReadingPrev, c.ReadingCurr, c.Quantity, c.Amount, c.Note,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

// UpdateReading updates reading_curr, recalculates quantity and amount.
// Only allowed when the period is open.
func (r *CalculationRepo) UpdateReading(ctx context.Context, id int, readingCurr float64) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE billcore.calculations c
		SET
			reading_curr = $1,
			quantity     = GREATEST(0, $1 - COALESCE(reading_prev, 0)),
			amount       = ROUND(
				GREATEST(0, $1 - COALESCE(reading_prev, 0)) *
				(SELECT price_per_unit FROM billcore.tariffs WHERE id = c.tariff_id)::NUMERIC,
				2
			),
			updated_at   = NOW()
		FROM billcore.periods p
		WHERE c.id = $2
		  AND p.id = c.period_id
		  AND p.status = 'open'
	`, readingCurr, id)
	if err != nil {
		return fmt.Errorf("update reading: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("calculation not found or period is closed")
	}
	return nil
}

func (r *CalculationRepo) UpdateStatus(ctx context.Context, id int, status domain.CalculationStatus) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE billcore.calculations c
		SET status = $1, updated_at = NOW()
		FROM billcore.periods p
		WHERE c.id = $2
		  AND p.id = c.period_id
		  AND p.status = 'open'
	`, status, id)
	if err != nil {
		return fmt.Errorf("update status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("calculation not found or period is closed")
	}
	return nil
}

func (r *CalculationRepo) UpdateNote(ctx context.Context, id int, note string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE billcore.calculations c
		SET note = $1, updated_at = NOW()
		FROM billcore.periods p
		WHERE c.id = $2
		  AND p.id = c.period_id
		  AND p.status = 'open'
	`, note, id)
	if err != nil {
		return fmt.Errorf("update note: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("calculation not found or period is closed")
	}
	return nil
}

// --- helpers ---

func scanCalculations(rows interface {
	Next() bool
	Scan(...any) error
	Err() error
}) ([]domain.Calculation, error) {
	calcs := make([]domain.Calculation, 0)
	for rows.Next() {
		var c domain.Calculation
		var note *string
		if err := rows.Scan(
			&c.ID, &c.SubscriptionID, &c.PeriodID, &c.TariffID,
			&c.ReadingPrev, &c.ReadingCurr, &c.Quantity, &c.Amount,
			&c.Status, &note, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("calculations scan: %w", err)
		}
		if note != nil {
			c.Note = *note
		}
		calcs = append(calcs, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("calculations rows: %w", err)
	}
	return calcs, nil
}
