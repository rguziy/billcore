package handler

import (
	"encoding/json"
	"net/http"

	"github.com/rguziy/billcore/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Login godoc
// POST /auth/login
// Body: { "username": "admin", "password": "admin" }
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	token, user, err := h.authService.Login(r.Context(), body.Username, body.Password)
	if err != nil {
		writeError(w, err, http.StatusUnauthorized)
		return
	}

	writeJSON(w, map[string]any{
		"token": token,
		"user": map[string]any{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"role":     user.Role,
		},
	})
}

// Me returns the current user info from JWT context.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{
		"user_id":  r.Context().Value("user_id"),
		"username": r.Context().Value("username"),
		"role":     r.Context().Value("role"),
	})
}
