package domain

import "time"

// Client represents a subscriber — a natural person or legal entity.
type Client struct {
	ID            int       `json:"id"`
	FullName      string    `json:"full_name"`
	Phone         string    `json:"phone,omitempty"`
	Email         string    `json:"email,omitempty"`
	AccountNumber string    `json:"account_number"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Location is a physical object belonging to a client:
// apartment, cottage, office, etc.
type Location struct {
	ID        int       `json:"id"`
	ClientID  int       `json:"client_id"`
	Name      string    `json:"name"`
	Address   string    `json:"address,omitempty"`
	IsDefault bool      `json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
}
