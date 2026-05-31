package domain

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Subscription links a service to a client's location.
// DisconnectedAt = nil means the subscription is active.
type Subscription struct {
	ID             int        `json:"id"`
	LocationID     int        `json:"location_id"`
	ServiceID      int        `json:"service_id"`
	MeterNumber    string     `json:"meter_number,omitempty"`
	ConnectedAt    time.Time  `json:"connected_at"`
	DisconnectedAt *time.Time `json:"disconnected_at,omitempty"`
	Note           string     `json:"note,omitempty"`
}

func (s *Subscription) UnmarshalJSON(data []byte) error {
	type Alias Subscription
	var raw struct {
		*Alias
		ConnectedAt    *string `json:"connected_at"`
		DisconnectedAt *string `json:"disconnected_at"`
	}
	raw.Alias = (*Alias)(s)

	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	if raw.ConnectedAt != nil {
		connectedAt, err := parseJSONDateTime(*raw.ConnectedAt)
		if err != nil {
			return fmt.Errorf("connected_at: %w", err)
		}
		s.ConnectedAt = connectedAt
	}

	if raw.DisconnectedAt != nil && strings.TrimSpace(*raw.DisconnectedAt) != "" {
		disconnectedAt, err := parseJSONDateTime(*raw.DisconnectedAt)
		if err != nil {
			return fmt.Errorf("disconnected_at: %w", err)
		}
		s.DisconnectedAt = &disconnectedAt
	}

	return nil
}

func parseJSONDateTime(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, fmt.Errorf("date is required")
	}
	if t, err := time.Parse(time.DateOnly, value); err == nil {
		return t, nil
	}
	return time.Parse(time.RFC3339, value)
}
