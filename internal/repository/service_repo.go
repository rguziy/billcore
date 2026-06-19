package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/rguziy/billcore/internal/db"
	"github.com/rguziy/billcore/internal/domain"
)

type ServiceRepo struct {
	db *db.DB
}

func NewServiceRepo(db *db.DB) *ServiceRepo {
	return &ServiceRepo{db: db}
}

func (r *ServiceRepo) GetAll(ctx context.Context) ([]domain.Service, error) {
	// Query the list of services using the thread-safe connection pool
	rows, err := r.db.Pool().Query(ctx, `
		SELECT id, name, unit, has_meter
		FROM billcore.services
		ORDER BY name
	`)
	if err != nil {
		return nil, fmt.Errorf("services get all: %w", err)
	}
	defer rows.Close()

	services := make([]domain.Service, 0)
	for rows.Next() {
		var s domain.Service
		if err := rows.Scan(&s.ID, &s.Name, &s.Unit, &s.HasMeter); err != nil {
			return nil, fmt.Errorf("services scan: %w", err)
		}
		services = append(services, s)
	}
	return services, nil
}

func (r *ServiceRepo) Create(ctx context.Context, s *domain.Service) error {
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO billcore.services (name, unit, has_meter)
			VALUES ($1, $2, $3)
			RETURNING id
		`, s.Name, s.Unit, s.HasMeter).Scan(&s.ID)
	})
}

func (r *ServiceRepo) Update(ctx context.Context, s *domain.Service) error {
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			UPDATE billcore.services SET name = $1, unit = $2, has_meter = $3 WHERE id = $4
		`, s.Name, s.Unit, s.HasMeter, s.ID)
		return err
	})
}

func (r *ServiceRepo) Delete(ctx context.Context, id int) error {
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `DELETE FROM billcore.services WHERE id = $1`, id)
		return err
	})
}

// --- Tariffs ---

func (r *ServiceRepo) GetTariffs(ctx context.Context, serviceID int) ([]domain.Tariff, error) {
	// Fetch all tariffs for a service using the thread-safe connection pool
	rows, err := r.db.Pool().Query(ctx, `
		SELECT id, service_id, price_per_unit, valid_from, valid_to, note
		FROM billcore.tariffs
		WHERE service_id = $1
		ORDER BY valid_from DESC
	`, serviceID)
	if err != nil {
		return nil, fmt.Errorf("tariffs get: %w", err)
	}
	defer rows.Close()

	tariffs := make([]domain.Tariff, 0)
	for rows.Next() {
		var t domain.Tariff
		if err := rows.Scan(&t.ID, &t.ServiceID, &t.PricePerUnit, &t.ValidFrom, &t.ValidTo, &t.Note); err != nil {
			return nil, fmt.Errorf("tariffs scan: %w", err)
		}
		tariffs = append(tariffs, t)
	}
	return tariffs, nil
}

func (r *ServiceRepo) GetActiveTariff(ctx context.Context, serviceID int) (*domain.Tariff, error) {
	var t domain.Tariff
	// Fetch the active tariff using the thread-safe connection pool
	err := r.db.Pool().QueryRow(ctx, `
		SELECT id, service_id, price_per_unit, valid_from, valid_to, note
		FROM billcore.tariffs
		WHERE service_id = $1 AND valid_to IS NULL
	`, serviceID).Scan(&t.ID, &t.ServiceID, &t.PricePerUnit, &t.ValidFrom, &t.ValidTo, &t.Note)
	if err != nil {
		return nil, fmt.Errorf("active tariff: %w", err)
	}
	return &t, nil
}

func (r *ServiceRepo) CreateTariff(ctx context.Context, t *domain.Tariff) error {
	// Run timeline safety validations and mutations inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		if t.ValidTo == nil {
			var activeValidFrom time.Time
			err := tx.QueryRow(ctx, `
				SELECT valid_from FROM billcore.tariffs
				WHERE service_id = $1 AND valid_to IS NULL
			`, t.ServiceID).Scan(&activeValidFrom)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return err
			}

			if !activeValidFrom.IsZero() {
				// Active tariff exists — new tariff's valid_from must be in the future and after the active one
				today := time.Now().Format("2006-01-02")
				validFrom := t.ValidFrom.Format("2006-01-02")
				if validFrom < today {
					return fmt.Errorf("valid_from must not be in the past for an active tariff")
				}
				if !t.ValidFrom.After(activeValidFrom) {
					return fmt.Errorf("valid_from must be after the current active tariff's valid_from (%s)",
						activeValidFrom.Format("2006-01-02"))
				}

				// Automatically close the previous tariff period
				_, err = tx.Exec(ctx, `
					UPDATE billcore.tariffs
					SET valid_to = $2::date - INTERVAL '1 day'
					WHERE service_id = $1 AND valid_to IS NULL
				`, t.ServiceID, t.ValidFrom)
				if err != nil {
					return err
				}
			}
		}

		return tx.QueryRow(ctx, `
			INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from, valid_to, note)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id
		`, t.ServiceID, t.PricePerUnit, t.ValidFrom, t.ValidTo, t.Note).Scan(&t.ID)
	})
}

func (r *ServiceRepo) UpdateTariff(ctx context.Context, t *domain.Tariff) error {
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE billcore.tariffs
			SET price_per_unit = $1, valid_from = $2, valid_to = $3, note = $4
			WHERE id = $5
		`, t.PricePerUnit, t.ValidFrom, t.ValidTo, t.Note, t.ID)
		if err != nil {
			return fmt.Errorf("tariffs update: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("tariff not found")
		}
		return nil
	})
}

func (r *ServiceRepo) DeleteTariff(ctx context.Context, id int) error {
	// Execute mutation inside an audit-tracked transaction context
	return r.db.WithTx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `DELETE FROM billcore.tariffs WHERE id = $1`, id)
		if err != nil {
			return fmt.Errorf("tariffs delete: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("tariff not found")
		}
		return nil
	})
}
