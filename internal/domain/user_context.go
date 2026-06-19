package domain

// ContextKey defines a globally accessible type for context keys
// to maintain strict type safety and prevent package cross-import conflicts.
type ContextKey string

const (
	// ContextUserID is the unified key to store/retrieve the authenticated user ID (int).
	ContextUserID ContextKey = "user_id"

	// ContextUsername is the unified key to store/retrieve the authenticated username (string).
	ContextUsername ContextKey = "username"

	// ContextRole is the unified key to store/retrieve the authenticated user's role (UserRole).
	ContextRole ContextKey = "role"
)
