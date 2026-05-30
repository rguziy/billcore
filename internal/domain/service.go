package domain

import "time"

// Service is a catalogue entry: cold water, electricity, internet, etc.
type Service struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Unit     string `json:"unit"`      // "m³", "kWh", "month"
	HasMeter bool   `json:"has_meter"` // whether a meter reading is required
}

// Tariff is a price entry for a service over a time period.
// ValidTo = nil means the tariff is currently active.
type Tariff struct {
	ID           int        `json:"id"`
	ServiceID    int        `json:"service_id"`
	PricePerUnit float64    `json:"price_per_unit"`
	ValidFrom    time.Time  `json:"valid_from"`
	ValidTo      *time.Time `json:"valid_to,omitempty"`
	Note         string     `json:"note,omitempty"`
}
