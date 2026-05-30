package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rguziy/billcore/internal/domain"
)

type PaymentRepo struct {
	db *pgxpool.Pool
}

func NewPaymentRepo(db *pgxpool.Pool) *PaymentRepo {
	return &PaymentRepo{db: db}
}

func (r *PaymentRepo) GetByClient(ctx context.Context, clientID int) ([]domain.Payment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, client_id, calculation_id, amount, method, paid_at, note
		FROM billcore.payments
		WHERE client_id = $1
		ORDER BY paid_at DESC
	`, clientID)
	if err != nil {
		return nil, fmt.Errorf("payments get: %w", err)
	}
	defer rows.Close()

	var payments []domain.Payment
	for rows.Next() {
		var p domain.Payment
		if err := rows.Scan(
			&p.ID, &p.ClientID, &p.CalculationID,
			&p.Amount, &p.Method, &p.PaidAt, &p.Note,
		); err != nil {
			return nil, fmt.Errorf("payments scan: %w", err)
		}
		payments = append(payments, p)
	}
	return payments, nil
}

func (r *PaymentRepo) Create(ctx context.Context, p *domain.Payment) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO billcore.payments (client_id, calculation_id, amount, method, note)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, paid_at
	`, p.ClientID, p.CalculationID, p.Amount, p.Method, p.Note,
	).Scan(&p.ID, &p.PaidAt)
}
