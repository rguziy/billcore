package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/rguziy/billcore/internal/db"
	"github.com/rguziy/billcore/internal/domain"
)

type CalculationRepo struct {
	db *db.DB
}

func NewCalculationRepo(db *db.DB) *CalculationRepo {
	return &CalculationRepo{db: db}
}

func (r *CalculationRepo) GetByPeriod(ctx context.Context, periodID int) ([]domain.Calculation, error) {
	// Execute queries via the thread-safe connection pool for read operations
	rows, err := r.db.Pool().Query(ctx, `
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
	return r.scanCalculations(rows)
}

func (r *CalculationRepo) GetRowsByPeriod(ctx context.Context, periodID int, clientID *int, locationID *int) ([]domain.CalculationRow, error) {
	query := `
		SELECT c.id, c.subscription_id, c.period_id, c.tariff_id,
		       c.reading_prev, c.reading_curr, c.quantity, c.amount,
		       c.status, c.note, c.created_at, c.updated_at,
		       sv.name AS service_name, sv.unit, l.name AS location_name,
		       sv.has_meter
		FROM billcore.calculations c
		JOIN billcore.subscriptions s  ON s.id  = c.subscription_id
		JOIN billcore.services      sv ON sv.id = s.service_id
		JOIN billcore.locations     l  ON l.id  = s.location_id
		WHERE c.period_id = $1
	`
	args := []any{periodID}
	i := 2

	if clientID != nil {
		query += fmt.Sprintf(` AND l.client_id = $%d`, i)
		args = append(args, *clientID)
		i++
	}
	if locationID != nil {
		query += fmt.Sprintf(` AND l.id = $%d`, i)
		args = append(args, *locationID)
		i++
	}
	query += ` ORDER BY sv.name, l.name`

	// Fetch dynamic filtering data using the thread-safe connection pool
	rows, err := r.db.Pool().Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("calculation rows by period: %w", err)
	}
	defer rows.Close()

	result := make([]domain.CalculationRow, 0)
	for rows.Next() {
		var cr domain.CalculationRow
		var note *string
		if err := rows.Scan(
			&cr.ID, &cr.SubscriptionID, &cr.PeriodID, &cr.TariffID,
			&cr.ReadingPrev, &cr.ReadingCurr, &cr.Quantity, &cr.Amount,
			&cr.Status, &note, &cr.CreatedAt, &cr.UpdatedAt,
			&cr.ServiceName, &cr.Unit, &cr.LocationName, &cr.HasMeter,
		); err != nil {
			return nil, fmt.Errorf("calculation row scan: %w", err)
		}
		if note != nil {
			cr.Note = *note
		}
		result = append(result, cr)
	}
	return result, nil
}

func (r *CalculationRepo) GetByPeriodAndClient(ctx context.Context, periodID, clientID int) ([]domain.Calculation, error) {
	rows, err := r.db.Pool().Query(ctx, `
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
	return r.scanCalculations(rows)
}

func (r *CalculationRepo) GetBySubscription(ctx context.Context, subscriptionID int) ([]domain.Calculation, error) {
	rows, err := r.db.Pool().Query(ctx, `
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
	return r.scanCalculations(rows)
}

func (r *CalculationRepo) GetPending(ctx context.Context, clientID int) ([]domain.Calculation, error) {
	rows, err := r.db.Pool().Query(ctx, `
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
	return r.scanCalculations(rows)
}

func (r *CalculationRepo) GetPendingRows(ctx context.Context, clientID int) ([]domain.CalculationRow, error) {
	rows, err := r.db.Pool().Query(ctx, `
		SELECT c.id, c.subscription_id, c.period_id, c.tariff_id,
		       c.reading_prev, c.reading_curr, c.quantity, c.amount,
		       c.status, c.note, c.created_at, c.updated_at,
		       sv.name, sv.unit, l.name AS location_name, sv.has_meter
		FROM billcore.calculations c
		JOIN billcore.subscriptions s  ON s.id  = c.subscription_id
		JOIN billcore.services      sv ON sv.id = s.service_id
		JOIN billcore.locations     l  ON l.id  = s.location_id
		WHERE l.client_id = $1 AND c.status = 'pending'
		ORDER BY sv.name
	`, clientID)
	if err != nil {
		return nil, fmt.Errorf("pending rows: %w", err)
	}
	defer rows.Close()

	result := make([]domain.CalculationRow, 0)
	for rows.Next() {
		var cr domain.CalculationRow
		var note *string
		if err := rows.Scan(
			&cr.ID, &cr.SubscriptionID, &cr.PeriodID, &cr.TariffID,
			&cr.ReadingPrev, &cr.ReadingCurr, &cr.Quantity, &cr.Amount,
			&cr.Status, &note, &cr.CreatedAt, &cr.UpdatedAt,
			&cr.ServiceName, &cr.Unit, &cr.LocationName, &cr.HasMeter,
		); err != nil {
			return nil, fmt.Errorf("pending rows scan: %w", err)
		}
		if note != nil {
			cr.Note = *note
		}
		result = append(result, cr)
	}
	return result, nil
}

func (r *CalculationRepo) Create(ctx context.Context, c *domain.Calculation) error {
	// Run write mutation within an audit-tracked transaction scope
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO billcore.calculations
			    (subscription_id, period_id, tariff_id, reading_prev, reading_curr, quantity, amount, note)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id, status, created_at, updated_at
		`, c.SubscriptionID, c.PeriodID, c.TariffID,
			c.ReadingPrev, c.ReadingCurr, c.Quantity, c.Amount, c.Note,
		).Scan(&c.ID, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	})
}

func (r *CalculationRepo) Delete(ctx context.Context, id int) error {
	// Execute cascading check and deletion atomically inside a transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		// Check for payments
		var paymentCount int
		if err := tx.QueryRow(ctx, `
			SELECT COUNT(*) FROM billcore.payments WHERE calculation_id = $1
		`, id).Scan(&paymentCount); err != nil {
			return fmt.Errorf("check payments: %w", err)
		}
		if paymentCount > 0 {
			return fmt.Errorf("cannot delete: %d payment(s) reference this calculation", paymentCount)
		}

		tag, err := tx.Exec(ctx, `
			DELETE FROM billcore.calculations c
			USING billcore.periods p
			WHERE c.id = $1
			  AND p.id = c.period_id
			  AND p.status = 'open'
		`, id)
		if err != nil {
			return fmt.Errorf("delete calculation: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("calculation not found or period is closed")
		}
		return nil
	})
}

// UpdateReading updates reading_curr and reading_prev (if provided), recalculates quantity and amount.
// Only allowed when the period is open.
func (r *CalculationRepo) UpdateReading(ctx context.Context, id int, readingPrev *float64, readingCurr float64) error {
	// Execute update within an audit-tracked transaction scope
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE billcore.calculations c
			SET
				reading_prev = COALESCE($1, reading_prev),
				reading_curr = $2,
				quantity     = GREATEST(0, $2 - COALESCE($1, reading_prev, 0)),
				amount       = ROUND(
					GREATEST(0, $2 - COALESCE($1, reading_prev, 0)) *
					(SELECT price_per_unit FROM billcore.tariffs WHERE id = c.tariff_id)::NUMERIC,
					2
				),
				updated_at   = NOW()
			FROM billcore.periods p
			WHERE c.id = $3
			  AND p.id = c.period_id
			  AND p.status = 'open'
		`, readingPrev, readingCurr, id)
		if err != nil {
			return fmt.Errorf("update reading: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("calculation not found or period is closed")
		}
		return nil
	})
}

func (r *CalculationRepo) UpdateStatus(ctx context.Context, id int, status domain.CalculationStatus) error {
	// Execute update within an audit-tracked transaction scope
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
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
	})
}

func (r *CalculationRepo) UpdateNote(ctx context.Context, id int, note string) error {
	// Execute update within an audit-tracked transaction scope
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
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
	})
}

// SubscriptionInfo holds data needed to create a calculation manually.
type SubscriptionInfo struct {
	ServiceID    int     `json:"service_id"`
	ServiceName  string  `json:"service_name"`
	Unit         string  `json:"unit"`
	HasMeter     bool    `json:"has_meter"`
	TariffID     int     `json:"tariff_id"`
	PricePerUnit float64 `json:"price_per_unit"`
	LocationName string  `json:"location_name"`
}

// GetSubscriptionInfo returns subscription + active tariff info for manual calculation creation.
func (r *CalculationRepo) GetSubscriptionInfo(ctx context.Context, subscriptionID int) (*SubscriptionInfo, error) {
	var info SubscriptionInfo
	var tariffID *int
	var pricePerUnit *float64
	// Fetch reference metadata using the thread-safe connection pool
	err := r.db.Pool().QueryRow(ctx, `
		SELECT sv.id, sv.name, sv.unit, sv.has_meter,
		       t.id, t.price_per_unit,
		       l.name
		FROM billcore.subscriptions s
		JOIN billcore.services  sv ON sv.id = s.service_id
		JOIN billcore.locations l  ON l.id  = s.location_id
		LEFT JOIN billcore.tariffs t ON t.service_id = sv.id AND t.valid_to IS NULL
		WHERE s.id = $1
	`, subscriptionID).Scan(
		&info.ServiceID, &info.ServiceName, &info.Unit, &info.HasMeter,
		&tariffID, &pricePerUnit, &info.LocationName,
	)
	if err != nil {
		return nil, fmt.Errorf("subscription not found: %w", err)
	}
	if tariffID == nil {
		return nil, fmt.Errorf("no active tariff for service '%s' — add a tariff first", info.ServiceName)
	}
	info.TariffID = *tariffID
	info.PricePerUnit = *pricePerUnit
	return &info, nil
}

// GetPaidRows returns paid calculations for a client with service info.
func (r *CalculationRepo) GetPaidRows(ctx context.Context, clientID int) ([]domain.CalculationRow, error) {
	// Fetch history data using the thread-safe connection pool
	rows, err := r.db.Pool().Query(ctx, `
		SELECT c.id, c.subscription_id, c.period_id, c.tariff_id,
		       c.reading_prev, c.reading_curr, c.quantity, c.amount,
		       c.status, c.note, c.created_at, c.updated_at,
		       sv.name, sv.unit, l.name AS location_name, sv.has_meter
		FROM billcore.calculations c
		JOIN billcore.subscriptions s  ON s.id  = c.subscription_id
		JOIN billcore.services      sv ON sv.id = s.service_id
		JOIN billcore.locations     l  ON l.id  = s.location_id
		WHERE l.client_id = $1 AND c.status = 'paid'
		ORDER BY c.period_id DESC, sv.name
	`, clientID)
	if err != nil {
		return nil, fmt.Errorf("paid rows: %w", err)
	}
	defer rows.Close()

	result := make([]domain.CalculationRow, 0)
	for rows.Next() {
		var cr domain.CalculationRow
		var note *string
		if err := rows.Scan(
			&cr.ID, &cr.SubscriptionID, &cr.PeriodID, &cr.TariffID,
			&cr.ReadingPrev, &cr.ReadingCurr, &cr.Quantity, &cr.Amount,
			&cr.Status, &note, &cr.CreatedAt, &cr.UpdatedAt,
			&cr.ServiceName, &cr.Unit, &cr.LocationName, &cr.HasMeter,
		); err != nil {
			return nil, fmt.Errorf("paid rows scan: %w", err)
		}
		if note != nil {
			cr.Note = *note
		}
		result = append(result, cr)
	}
	return result, nil
}

// --- helpers ---

// scanCalculations acts as a package-level helper to unpack calculation dataset rows.
func (r *CalculationRepo) scanCalculations(rows interface {
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

// GetPeriodHistory returns per-period billing summary for a client.
func (r *CalculationRepo) GetPeriodHistory(ctx context.Context, clientID int) ([]domain.PeriodSummary, error) {
	rows, err := r.db.Pool().Query(ctx, `
		SELECT
			p.id                                                          AS period_id,
			TO_CHAR(p.period_start, 'YYYY-MM-DD')                        AS period_start,
			COALESCE(SUM(c.amount), 0)                                   AS accrued,
			COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'paid'),      0) AS paid,
			COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'cancelled'), 0) AS cancelled,
			COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'pending'),   0) AS pending
		FROM billcore.periods p
		JOIN billcore.calculations  c  ON c.period_id       = p.id
		JOIN billcore.subscriptions s  ON s.id              = c.subscription_id
		JOIN billcore.locations     l  ON l.id              = s.location_id
		WHERE l.client_id = $1
		GROUP BY p.id, p.period_start
		ORDER BY p.period_start DESC
	`, clientID)
	if err != nil {
		return nil, fmt.Errorf("period history: %w", err)
	}
	defer rows.Close()

	result := make([]domain.PeriodSummary, 0)
	for rows.Next() {
		var ps domain.PeriodSummary
		if err := rows.Scan(
			&ps.PeriodID, &ps.PeriodStart,
			&ps.Accrued, &ps.Paid, &ps.Cancelled, &ps.Pending,
		); err != nil {
			return nil, fmt.Errorf("period history scan: %w", err)
		}
		result = append(result, ps)
	}
	return result, nil
}
