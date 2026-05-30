package domain

import "time"

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
