package domain

import "time"

// CalculationStatus represents the lifecycle state of an accrual.
type CalculationStatus string

const (
	StatusPending   CalculationStatus = "pending"
	StatusPaid      CalculationStatus = "paid"
	StatusCancelled CalculationStatus = "cancelled"
)

// Calculation is a monthly accrual for a subscription.
type Calculation struct {
	ID             int               `json:"id"`
	SubscriptionID int               `json:"subscription_id"`
	TariffID       int               `json:"tariff_id"`
	PeriodStart    time.Time         `json:"period_start"`
	ReadingPrev    *float64          `json:"reading_prev,omitempty"` // nil when has_meter = false
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
