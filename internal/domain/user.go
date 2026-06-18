package domain

import "time"

// UserRole defines access level.
type UserRole string
type Language string

const (
	RoleAdmin    UserRole = "admin"
	RoleManager  UserRole = "manager"
	RoleOperator UserRole = "operator"

	LanguageEN Language = "en"
	LanguageUK Language = "uk"
)

func IsSupportedLanguage(lang string) bool {
	switch Language(lang) {
	case LanguageEN, LanguageUK:
		return true
	default:
		return false
	}
}

func DefaultLanguage() Language {
	return LanguageEN
}

// User is a system user that can log in and perform actions.
type User struct {
	ID                int       `json:"id"`
	Username          string    `json:"username"`
	Email             string    `json:"email,omitempty"`
	PasswordHash      string    `json:"-"` // never serialised
	Role              UserRole  `json:"role"`
	PreferredLanguage Language  `json:"preferred_language,omitempty"`
	IsActive          bool      `json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
