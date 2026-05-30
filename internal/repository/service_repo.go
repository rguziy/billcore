package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rguziy/billcore/internal/domain"
)

type ServiceRepo struct {
	db *pgxpool.Pool
}

func NewServiceRepo(db *pgxpool.Pool) *ServiceRepo {
	return &ServiceRepo{db: db}
}

func (r *ServiceRepo) GetAll(ctx context.Context) ([]domain.Service, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, unit, has_meter
		FROM billcore.services
		ORDER BY name
	`)
	if err != nil {
		return nil, fmt.Errorf("services get all: %w", err)
	}
	defer rows.Close()

	var services []domain.Service
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
	return r.db.QueryRow(ctx, `
		INSERT INTO billcore.services (name, unit, has_meter)
		VALUES ($1, $2, $3)
		RETURNING id
	`, s.Name, s.Unit, s.HasMeter).Scan(&s.ID)
}

func (r *ServiceRepo) Update(ctx context.Context, s *domain.Service) error {
	_, err := r.db.Exec(ctx, `
		UPDATE billcore.services SET name = $1, unit = $2, has_meter = $3 WHERE id = $4
	`, s.Name, s.Unit, s.HasMeter, s.ID)
	return err
}

func (r *ServiceRepo) Delete(ctx context.Context, id int) error {
	_, err := r.db.Exec(ctx, `DELETE FROM billcore.services WHERE id = $1`, id)
	return err
}

// --- Tariffs ---

func (r *ServiceRepo) GetTariffs(ctx context.Context, serviceID int) ([]domain.Tariff, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, service_id, price_per_unit, valid_from, valid_to, note
		FROM billcore.tariffs
		WHERE service_id = $1
		ORDER BY valid_from DESC
	`, serviceID)
	if err != nil {
		return nil, fmt.Errorf("tariffs get: %w", err)
	}
	defer rows.Close()

	var tariffs []domain.Tariff
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
	err := r.db.QueryRow(ctx, `
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
	return r.db.QueryRow(ctx, `
		INSERT INTO billcore.tariffs (service_id, price_per_unit, valid_from, valid_to, note)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, t.ServiceID, t.PricePerUnit, t.ValidFrom, t.ValidTo, t.Note).Scan(&t.ID)
}
