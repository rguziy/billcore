package domain

import "time"

// PeriodStatus represents the lifecycle state of a billing period.
type PeriodStatus string

const (
	PeriodOpen   PeriodStatus = "open"
	PeriodClosed PeriodStatus = "closed"
)

// Period represents a billing period (e.g. January 2026).
// Only open periods allow editing calculations.
type Period struct {
	ID          int          `json:"id"`
	PeriodStart time.Time    `json:"period_start"`
	PeriodEnd   time.Time    `json:"period_end"`
	Status      PeriodStatus `json:"status"`
	CreatedAt   time.Time    `json:"created_at"`
}
