package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/rguziy/billcore/internal/domain"
	"github.com/rguziy/billcore/internal/service"
)

type contextKey string

const (
	ContextUserID   contextKey = "user_id"
	ContextUsername contextKey = "username"
	ContextRole     contextKey = "role"
)

// Auth validates Bearer JWT and injects user info into context.
func Auth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			claims, err := service.ParseToken(strings.TrimPrefix(header, "Bearer "), secret)
			if err != nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ContextUserID, claims.UserID)
			ctx = context.WithValue(ctx, ContextUsername, claims.Username)
			ctx = context.WithValue(ctx, ContextRole, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireAdmin rejects non-admin users.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, _ := r.Context().Value(ContextRole).(domain.UserRole)
		if role != domain.RoleAdmin {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// UserIDFromContext extracts the authenticated user ID.
func UserIDFromContext(ctx context.Context) *int {
	id, ok := ctx.Value(ContextUserID).(int)
	if !ok || id == 0 {
		return nil
	}
	return &id
}
