package service

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ReportService struct {
	db *pgxpool.Pool
}

func NewReportService(db *pgxpool.Pool) *ReportService {
	return &ReportService{db: db}
}

// ClientBalance holds the financial summary for a client based on calculation statuses.
type ClientBalance struct {
	ClientID  int     `json:"client_id"`
	Debt      float64 `json:"debt"`       // sum of pending calculations
	PaidTotal float64 `json:"paid_total"` // sum of paid calculations
}

func (s *ReportService) GetClientBalance(ctx context.Context, clientID int) (*ClientBalance, error) {
	var b ClientBalance
	err := s.db.QueryRow(ctx, `
		SELECT client_id, debt, paid_total
		FROM billcore.v_client_balance
		WHERE client_id = $1
	`, clientID).Scan(&b.ClientID, &b.Debt, &b.PaidTotal)
	if err != nil {
		return nil, fmt.Errorf("client balance: %w", err)
	}
	return &b, nil
}

// LatestReading holds the most recent meter reading for a subscription.
type LatestReading struct {
	SubscriptionID int      `json:"subscription_id"`
	MeterNumber    string   `json:"meter_number"`
	ServiceName    string   `json:"service_name"`
	Unit           string   `json:"unit"`
	PeriodStart    string   `json:"period_start"`
	ReadingPrev    *float64 `json:"reading_prev,omitempty"`
	ReadingCurr    *float64 `json:"reading_curr,omitempty"`
	Quantity       float64  `json:"quantity"`
	Amount         float64  `json:"amount"`
	Status         string   `json:"status"`
}

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

	result := make([]LatestReading, 0)
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
