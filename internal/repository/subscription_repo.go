package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/rguziy/billcore/internal/db"
	"github.com/rguziy/billcore/internal/domain"
)

type SubscriptionRepo struct {
	db *db.DB
}

func NewSubscriptionRepo(db *db.DB) *SubscriptionRepo {
	return &SubscriptionRepo{db: db}
}

func (r *SubscriptionRepo) GetByLocation(ctx context.Context, locationID int) ([]domain.Subscription, error) {
	// Fetch location subscriptions using the thread-safe connection pool
	rows, err := r.db.Pool().Query(ctx, `
		SELECT id, location_id, service_id, meter_number, connected_at, disconnected_at, note
		FROM billcore.subscriptions
		WHERE location_id = $1
		ORDER BY connected_at DESC
	`, locationID)
	if err != nil {
		return nil, fmt.Errorf("subscriptions get: %w", err)
	}
	defer rows.Close()

	subs := make([]domain.Subscription, 0)
	for rows.Next() {
		var s domain.Subscription
		var meterNumber, note *string
		if err := rows.Scan(
			&s.ID, &s.LocationID, &s.ServiceID,
			&meterNumber, &s.ConnectedAt, &s.DisconnectedAt, &note,
		); err != nil {
			return nil, fmt.Errorf("subscriptions scan: %w", err)
		}
		if meterNumber != nil {
			s.MeterNumber = *meterNumber
		}
		if note != nil {
			s.Note = *note
		}
		subs = append(subs, s)
	}
	return subs, nil
}

func (r *SubscriptionRepo) Create(ctx context.Context, s *domain.Subscription) error {
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO billcore.subscriptions (location_id, service_id, meter_number, connected_at, note)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id
		`, s.LocationID, s.ServiceID, s.MeterNumber, s.ConnectedAt, s.Note,
		).Scan(&s.ID)
	})
}

func (r *SubscriptionRepo) Disconnect(ctx context.Context, id int, date string) error {
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			UPDATE billcore.subscriptions SET disconnected_at = $1 WHERE id = $2
		`, date, id)
		return err
	})
}

func (r *SubscriptionRepo) GetAll(ctx context.Context) ([]domain.Subscription, error) {
	// Fetch all subscriptions using the thread-safe connection pool
	rows, err := r.db.Pool().Query(ctx, `
		SELECT id, location_id, service_id, meter_number, connected_at, disconnected_at, note
		FROM billcore.subscriptions
		ORDER BY connected_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("subscriptions get all: %w", err)
	}
	defer rows.Close()

	subs := make([]domain.Subscription, 0)
	for rows.Next() {
		var s domain.Subscription
		var meterNumber, note *string
		if err := rows.Scan(
			&s.ID, &s.LocationID, &s.ServiceID,
			&meterNumber, &s.ConnectedAt, &s.DisconnectedAt, &note,
		); err != nil {
			return nil, fmt.Errorf("subscriptions scan: %w", err)
		}
		if meterNumber != nil {
			s.MeterNumber = *meterNumber
		}
		if note != nil {
			s.Note = *note
		}
		subs = append(subs, s)
	}
	return subs, nil
}

func (r *SubscriptionRepo) Update(ctx context.Context, s *domain.Subscription) error {
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			UPDATE billcore.subscriptions
			SET meter_number = $1, note = $2
			WHERE id = $3
		`, s.MeterNumber, s.Note, s.ID)
		return err
	})
}

func (r *SubscriptionRepo) Delete(ctx context.Context, id int) error {
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `DELETE FROM billcore.subscriptions WHERE id = $1`, id)
		return err
	})
}
