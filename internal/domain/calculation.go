package domain

import "time"

// CalculationStatus represents the lifecycle state of an accrual.
type CalculationStatus string

const (
	StatusPending   CalculationStatus = "pending"
	StatusPaid      CalculationStatus = "paid"
	StatusCancelled CalculationStatus = "cancelled"
)

// Calculation is a monthly accrual for a subscription within a period.
type Calculation struct {
	ID             int               `json:"id"`
	SubscriptionID int               `json:"subscription_id"`
	PeriodID       int               `json:"period_id"`
	TariffID       int               `json:"tariff_id"`
	ReadingPrev    *float64          `json:"reading_prev,omitempty"`
	ReadingCurr    *float64          `json:"reading_curr,omitempty"`
	Quantity       float64           `json:"quantity"`
	Amount         float64           `json:"amount"`
	Status         CalculationStatus `json:"status"`
	Note           string            `json:"note,omitempty"`
	CreatedAt      time.Time         `json:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
}

// PaymentMethod represents how a payment was made.
type PaymentMethod string

const (
	MethodCash         PaymentMethod = "cash"
	MethodCard         PaymentMethod = "card"
	MethodBankTransfer PaymentMethod = "bank_transfer"
	MethodOnline       PaymentMethod = "online"
)

// Payment is a payment from a client.
// CalculationID = nil means an advance (prepaid) payment.
type Payment struct {
	ID            int           `json:"id"`
	ClientID      int           `json:"client_id"`
	CalculationID *int          `json:"calculation_id,omitempty"`
	Amount        float64       `json:"amount"`
	Method        PaymentMethod `json:"method"`
	PaidAt        time.Time     `json:"paid_at"`
	Note          string        `json:"note,omitempty"`
}

// CalculationRow is an enriched calculation with service info for display.
type CalculationRow struct {
	Calculation
	ServiceName  string `json:"service_name"`
	Unit         string `json:"unit"`
	LocationName string `json:"location_name"`
	HasMeter     bool   `json:"has_meter"`
}

// PeriodSummary is an aggregated billing summary per period for a client.
type PeriodSummary struct {
	PeriodID    int     `json:"period_id"`
	PeriodStart string  `json:"period_start"`
	Accrued     float64 `json:"accrued"`
	Paid        float64 `json:"paid"`
	Cancelled   float64 `json:"cancelled"`
	Pending     float64 `json:"pending"`
}
