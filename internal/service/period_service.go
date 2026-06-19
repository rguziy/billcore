package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/rguziy/billcore/internal/db"
	"github.com/rguziy/billcore/internal/domain"
	"github.com/rguziy/billcore/internal/repository"
)

// PeriodService handles period lifecycle and calculation generation.
type PeriodService struct {
	db          *db.DB
	periodRepo  *repository.PeriodRepo
	serviceRepo *repository.ServiceRepo
}

func NewPeriodService(
	db *db.DB,
	periodRepo *repository.PeriodRepo,
	serviceRepo *repository.ServiceRepo,
) *PeriodService {
	return &PeriodService{db: db, periodRepo: periodRepo, serviceRepo: serviceRepo}
}

// OpenPeriodRequest holds input for opening a new billing period.
type OpenPeriodRequest struct {
	PeriodStart time.Time // must be 1st of month
}

// OpenPeriod creates a new period and auto-generates calculations
// for all active subscriptions.
func (s *PeriodService) OpenPeriod(ctx context.Context, req OpenPeriodRequest) (*domain.Period, int, error) {
	if req.PeriodStart.Day() != 1 {
		return nil, 0, fmt.Errorf("period_start must be the 1st day of the month")
	}

	// period_end = last day of the month
	periodEnd := req.PeriodStart.AddDate(0, 1, -1)

	period := &domain.Period{
		PeriodStart: req.PeriodStart,
		PeriodEnd:   periodEnd,
	}
	generated := 0

	// Orchestrate the entire batch process inside an audit-tracked transaction context
	err := s.db.WithTx(ctx, func(tx pgx.Tx) error {
		// Create billing period record
		if err := tx.QueryRow(ctx, `
			INSERT INTO billcore.periods (period_start, period_end, status)
			VALUES ($1, $2, 'open')
			RETURNING id, created_at
		`, period.PeriodStart, period.PeriodEnd).Scan(&period.ID, &period.CreatedAt); err != nil {
			return fmt.Errorf("create period: %w", err)
		}
		period.Status = domain.PeriodOpen

		// Fetch all active subscriptions with their service info
		rows, err := tx.Query(ctx, `
			SELECT
				s.id          AS subscription_id,
				s.service_id,
				sv.has_meter,
				s.connected_at,
				s.disconnected_at
			FROM billcore.subscriptions s
			JOIN billcore.services sv ON sv.id = s.service_id
			WHERE s.disconnected_at IS NULL
			   OR s.disconnected_at > $1
		`, req.PeriodStart)
		if err != nil {
			return fmt.Errorf("fetch subscriptions: %w", err)
		}
		defer rows.Close()

		type subRow struct {
			subscriptionID int
			serviceID      int
			hasMeter       bool
		}
		var subs []subRow
		for rows.Next() {
			var sr subRow
			var connectedAt time.Time
			var disconnectedAt *time.Time
			if err := rows.Scan(&sr.subscriptionID, &sr.serviceID, &sr.hasMeter, &connectedAt, &disconnectedAt); err != nil {
				return fmt.Errorf("scan subscriptions: %w", err)
			}
			subs = append(subs, sr)
		}
		rows.Close()

		// Generate initial calculations for each matching subscription
		for _, sub := range subs {
			// Find active tariff for this service
			var tariffID int
			var pricePerUnit float64
			err := tx.QueryRow(ctx, `
				SELECT id, price_per_unit
				FROM billcore.tariffs
				WHERE service_id = $1 AND valid_to IS NULL
			`, sub.serviceID).Scan(&tariffID, &pricePerUnit)
			if err != nil {
				// No active tariff found — skip this subscription
				continue
			}

			var readingPrev *float64
			var readingCurr *float64
			var quantity float64
			var amount float64

			if sub.hasMeter {
				// Get last reading_curr as the new reading_prev
				var lastReading *float64
				_ = tx.QueryRow(ctx, `
					SELECT c.reading_curr
					FROM billcore.calculations c
					JOIN billcore.periods p ON p.id = c.period_id
					WHERE c.subscription_id = $1
					  AND c.reading_curr IS NOT NULL
					ORDER BY p.period_start DESC
					LIMIT 1
				`, sub.subscriptionID).Scan(&lastReading)

				readingPrev = lastReading
				readingCurr = nil
				quantity = 0
				amount = 0
			} else {
				// Flat-rate tariff: quantity = 1, amount = price
				quantity = 1
				amount = math.Round(pricePerUnit*1e2) / 1e2
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO billcore.calculations
					(subscription_id, period_id, tariff_id, reading_prev, reading_curr, quantity, amount, status)
				VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
				ON CONFLICT (subscription_id, period_id) DO NOTHING
			`, sub.subscriptionID, period.ID, tariffID, readingPrev, readingCurr, quantity, amount)
			if err != nil {
				return fmt.Errorf("insert calculation for sub %d: %w", sub.subscriptionID, err)
			}
			generated++
		}

		return nil
	})

	if err != nil {
		return nil, 0, err
	}

	return period, generated, nil
}
