package service

import (
	"context"
	"fmt"

	"github.com/rguziy/billcore/internal/db"
)

type ReportService struct {
	db *db.DB
}

func NewReportService(db *db.DB) *ReportService {
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
	// Execute read-only view query using the thread-safe connection pool
	err := s.db.Pool().QueryRow(ctx, `
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
	// Execute complex join selection using the thread-safe connection pool
	rows, err := s.db.Pool().Query(ctx, `
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

// Statistics holds system-wide metrics for the dashboard.
type Statistics struct {
	Clients struct {
		Total    int `json:"total"`
		Active   int `json:"active"`
		Inactive int `json:"inactive"`
	} `json:"clients"`
	Users struct {
		Total     int `json:"total"`
		Admins    int `json:"admins"`
		Managers  int `json:"managers"`
		Operators int `json:"operators"`
	} `json:"users"`
	Services struct {
		Total         int `json:"total"`
		WithoutTariff int `json:"without_tariff"`
	} `json:"services"`
	CurrentPeriod *PeriodStats `json:"current_period,omitempty"`
}

type PeriodStats struct {
	PeriodID    int     `json:"period_id"`
	PeriodStart string  `json:"period_start"`
	Accrued     float64 `json:"accrued"`
	Paid        float64 `json:"paid"`
	Pending     float64 `json:"pending"`
	Cancelled   float64 `json:"cancelled"`
}

func (s *ReportService) GetStatistics(ctx context.Context) (*Statistics, error) {
	stats := &Statistics{}

	// Fetch system dashboard counters using the thread-safe connection pool
	if err := s.db.Pool().QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE is_active = TRUE),
			COUNT(*) FILTER (WHERE is_active = FALSE)
		FROM billcore.clients
	`).Scan(&stats.Clients.Total, &stats.Clients.Active, &stats.Clients.Inactive); err != nil {
		return nil, fmt.Errorf("stats clients: %w", err)
	}

	if err := s.db.Pool().QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE role = 'admin'),
			COUNT(*) FILTER (WHERE role = 'manager'),
			COUNT(*) FILTER (WHERE role = 'operator')
		FROM billcore.users
	`).Scan(&stats.Users.Total, &stats.Users.Admins, &stats.Users.Managers, &stats.Users.Operators); err != nil {
		return nil, fmt.Errorf("stats users: %w", err)
	}

	if err := s.db.Pool().QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE id NOT IN (
				SELECT service_id FROM billcore.tariffs WHERE valid_to IS NULL
			))
		FROM billcore.services
	`).Scan(&stats.Services.Total, &stats.Services.WithoutTariff); err != nil {
		return nil, fmt.Errorf("stats services: %w", err)
	}

	// Current period (most recent open, or last closed)
	var ps PeriodStats
	var periodStart interface{}
	err := s.db.Pool().QueryRow(ctx, `
		SELECT
			p.id,
			p.period_start,
			COALESCE(SUM(c.amount), 0),
			COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'paid'), 0),
			COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'pending'), 0),
			COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'cancelled'), 0)
		FROM billcore.periods p
		LEFT JOIN billcore.calculations c ON c.period_id = p.id
		GROUP BY p.id, p.period_start
		ORDER BY p.period_start DESC
		LIMIT 1
	`).Scan(&ps.PeriodID, &periodStart, &ps.Accrued, &ps.Paid, &ps.Pending, &ps.Cancelled)
	if err == nil {
		if t, ok := periodStart.(interface{ Format(string) string }); ok {
			ps.PeriodStart = t.Format("2006-01-02")
		}
		stats.CurrentPeriod = &ps
	}

	return stats, nil
}
