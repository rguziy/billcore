package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rguziy/billcore/internal/domain"
)

type PeriodRepo struct {
	db *pgxpool.Pool
}

func NewPeriodRepo(db *pgxpool.Pool) *PeriodRepo {
	return &PeriodRepo{db: db}
}

func (r *PeriodRepo) GetAll(ctx context.Context) ([]domain.Period, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, period_start, period_end, status, created_at
		FROM billcore.periods
		ORDER BY period_start DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("periods get all: %w", err)
	}
	defer rows.Close()

	periods := make([]domain.Period, 0)
	for rows.Next() {
		var p domain.Period
		if err := rows.Scan(&p.ID, &p.PeriodStart, &p.PeriodEnd, &p.Status, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("periods scan: %w", err)
		}
		periods = append(periods, p)
	}
	return periods, nil
}

func (r *PeriodRepo) GetByID(ctx context.Context, id int) (*domain.Period, error) {
	var p domain.Period
	err := r.db.QueryRow(ctx, `
		SELECT id, period_start, period_end, status, created_at
		FROM billcore.periods
		WHERE id = $1
	`, id).Scan(&p.ID, &p.PeriodStart, &p.PeriodEnd, &p.Status, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("period get by id: %w", err)
	}
	return &p, nil
}

func (r *PeriodRepo) Create(ctx context.Context, p *domain.Period) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO billcore.periods (period_start, period_end, status)
		VALUES ($1, $2, 'open')
		RETURNING id, created_at
	`, p.PeriodStart, p.PeriodEnd).Scan(&p.ID, &p.CreatedAt)
}

func (r *PeriodRepo) Close(ctx context.Context, id int) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE billcore.periods SET status = 'closed' WHERE id = $1 AND status = 'open'
	`, id)
	if err != nil {
		return fmt.Errorf("period close: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("period not found or already closed")
	}
	return nil
}

func (r *PeriodRepo) Reopen(ctx context.Context, id int) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE billcore.periods SET status = 'open' WHERE id = $1 AND status = 'closed'
	`, id)
	if err != nil {
		return fmt.Errorf("period reopen: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("period not found or already open")
	}
	return nil
}

func (r *PeriodRepo) Delete(ctx context.Context, id int) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM billcore.periods WHERE id = $1
	`, id)
	if err != nil {
		return fmt.Errorf("period delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("period not found")
	}
	return nil
}

// IsOpen returns true if the period owning a calculation allows editing.
func (r *PeriodRepo) IsOpen(ctx context.Context, periodID int) (bool, error) {
	var status domain.PeriodStatus
	err := r.db.QueryRow(ctx, `
		SELECT status FROM billcore.periods WHERE id = $1
	`, periodID).Scan(&status)
	if err != nil {
		return false, fmt.Errorf("period status: %w", err)
	}
	return status == domain.PeriodOpen, nil
}
