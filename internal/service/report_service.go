package service

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ReportService provides reporting and balance queries via raw SQL views.
type ReportService struct {
	db *pgxpool.Pool
}

func NewReportService(db *pgxpool.Pool) *ReportService {
	return &ReportService{db: db}
}

// GetClientBalance returns the financial balance for a client
// using the v_client_balance view.
func (s *ReportService) GetClientBalance(ctx context.Context, clientID int) (*ClientBalance, error) {
	var b ClientBalance
	err := s.db.QueryRow(ctx, `
		WITH debt AS (
			SELECT COALESCE(SUM(calc.amount), 0) AS amount
			FROM billcore.calculations calc
			JOIN billcore.subscriptions sub ON sub.id = calc.subscription_id
			JOIN billcore.locations loc ON loc.id = sub.location_id
			WHERE loc.client_id = $1 AND calc.status = 'pending'
		),
		paid AS (
			SELECT COALESCE(SUM(amount), 0) AS amount
			FROM billcore.payments
			WHERE client_id = $1
		)
		SELECT $1, debt.amount, paid.amount, debt.amount - paid.amount
		FROM debt, paid
	`, clientID).Scan(&b.ClientID, &b.Debt, &b.PaidTotal, &b.Balance)
	if err != nil {
		return nil, fmt.Errorf("client balance: %w", err)
	}
	return &b, nil
}

// LatestReading holds the most recent meter reading for a subscription.
type LatestReading struct {
	SubscriptionID int       `json:"subscription_id"`
	MeterNumber    string    `json:"meter_number"`
	ServiceName    string    `json:"service_name"`
	Unit           string    `json:"unit"`
	PeriodStart    time.Time `json:"period_start"`
	ReadingPrev    *float64  `json:"reading_prev,omitempty"`
	ReadingCurr    *float64  `json:"reading_curr,omitempty"`
	Quantity       float64   `json:"quantity"`
	Amount         float64   `json:"amount"`
	Status         string    `json:"status"`
}

// GetLatestReadings returns the most recent meter reading per subscription
// using the v_latest_readings view.
func (s *ReportService) GetLatestReadings(ctx context.Context, clientID int) ([]LatestReading, error) {
	rows, err := s.db.Query(ctx, `
		SELECT r.subscription_id, r.meter_number, r.service_name, r.unit,
		       r.period_start, r.reading_prev, r.reading_curr, r.quantity, r.amount, r.status
		FROM billcore.v_latest_readings r
		JOIN billcore.subscriptions s ON s.id = r.subscription_id
		JOIN billcore.locations     l ON l.id = s.location_id
		WHERE l.client_id = $1
	`, clientID)
	if err != nil {
		return nil, fmt.Errorf("latest readings: %w", err)
	}
	defer rows.Close()

	var result []LatestReading
	for rows.Next() {
		var r LatestReading
		if err := rows.Scan(
			&r.SubscriptionID, &r.MeterNumber, &r.ServiceName, &r.Unit,
			&r.PeriodStart, &r.ReadingPrev, &r.ReadingCurr, &r.Quantity, &r.Amount, &r.Status,
		); err != nil {
			return nil, fmt.Errorf("readings scan: %w", err)
		}
		result = append(result, r)
	}
	return result, nil
}
