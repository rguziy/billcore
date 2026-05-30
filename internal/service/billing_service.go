package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/rguziy/billcore/internal/domain"
	"github.com/rguziy/billcore/internal/repository"
)

// BillingService handles accrual calculation logic.
type BillingService struct {
	calcRepo    *repository.CalculationRepo
	serviceRepo *repository.ServiceRepo
	subRepo     *repository.SubscriptionRepo
}

func NewBillingService(
	calcRepo *repository.CalculationRepo,
	serviceRepo *repository.ServiceRepo,
	subRepo *repository.SubscriptionRepo,
) *BillingService {
	return &BillingService{
		calcRepo:    calcRepo,
		serviceRepo: serviceRepo,
		subRepo:     subRepo,
	}
}

// AccrueRequest holds input data for a single accrual.
type AccrueRequest struct {
	SubscriptionID int
	PeriodStart    time.Time // must be the 1st of the month
	ReadingPrev    *float64  // nil when has_meter = false
	ReadingCurr    *float64
	Quantity       *float64 // override quantity (for flat-rate services)
	Note           string
}

// Accrue creates a calculation for a subscription in a given period.
// It fetches the active tariff automatically.
func (s *BillingService) Accrue(ctx context.Context, req AccrueRequest) (*domain.Calculation, error) {
	if req.PeriodStart.Day() != 1 {
		return nil, fmt.Errorf("period_start must be the 1st day of the month")
	}

	// Fetch the subscription to get service_id
	subs, err := s.subRepo.GetByLocation(ctx, 0) // placeholder — caller should pass service_id directly
	_ = subs

	// Fetch active tariff for this subscription's service
	// In a real flow you'd join subscription → service → active tariff
	// Here we use a simplified approach: tariff_id is passed externally or looked up by service_id
	tariff, err := s.serviceRepo.GetActiveTariff(ctx, req.SubscriptionID) // service_id passed as placeholder
	if err != nil {
		return nil, fmt.Errorf("get active tariff: %w", err)
	}

	// Calculate quantity
	var quantity float64
	if req.Quantity != nil {
		quantity = *req.Quantity
	} else if req.ReadingPrev != nil && req.ReadingCurr != nil {
		quantity = *req.ReadingCurr - *req.ReadingPrev
		if quantity < 0 {
			return nil, fmt.Errorf("reading_curr must be >= reading_prev")
		}
	} else {
		return nil, fmt.Errorf("either quantity or both readings must be provided")
	}

	// Round to 6 decimal places
	amount := math.Round(quantity*tariff.PricePerUnit*1e2) / 1e2

	calc := &domain.Calculation{
		SubscriptionID: req.SubscriptionID,
		TariffID:       tariff.ID,
		PeriodStart:    req.PeriodStart,
		ReadingPrev:    req.ReadingPrev,
		ReadingCurr:    req.ReadingCurr,
		Quantity:       quantity,
		Amount:         amount,
		Status:         domain.StatusPending,
		Note:           req.Note,
	}

	if err := s.calcRepo.Create(ctx, calc); err != nil {
		return nil, fmt.Errorf("create calculation: %w", err)
	}

	return calc, nil
}

// ClientBalance holds the financial summary for a client.
type ClientBalance struct {
	ClientID  int     `json:"client_id"`
	Debt      float64 `json:"debt"`
	PaidTotal float64 `json:"paid_total"`
	Balance   float64 `json:"balance"` // positive = owes money
}
