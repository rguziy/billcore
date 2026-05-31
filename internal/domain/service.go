package domain

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

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

func (t *Tariff) UnmarshalJSON(data []byte) error {
	type Alias Tariff
	var raw struct {
		*Alias
		ValidFrom *string `json:"valid_from"`
		ValidTo   *string `json:"valid_to"`
	}
	raw.Alias = (*Alias)(t)

	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	if raw.ValidFrom != nil {
		validFrom, err := parseJSONDateTime(*raw.ValidFrom)
		if err != nil {
			return fmt.Errorf("valid_from: %w", err)
		}
		t.ValidFrom = validFrom
	}

	if raw.ValidTo != nil && strings.TrimSpace(*raw.ValidTo) != "" {
		validTo, err := parseJSONDateTime(*raw.ValidTo)
		if err != nil {
			return fmt.Errorf("valid_to: %w", err)
		}
		t.ValidTo = &validTo
	}

	return nil
}
