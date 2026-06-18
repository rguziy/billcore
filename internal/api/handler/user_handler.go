package handler

import (
	"encoding/json"
	"net/http"

	"github.com/rguziy/billcore/internal/domain"
	"github.com/rguziy/billcore/internal/repository"
	"github.com/rguziy/billcore/internal/service"
)

type UserHandler struct {
	repo *repository.UserRepo
}

func NewUserHandler(repo *repository.UserRepo) *UserHandler {
	return &UserHandler{repo: repo}
}

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.GetAll(r.Context())
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, users)
}

func (h *UserHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	u, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, err, http.StatusNotFound)
		return
	}
	writeJSON(w, u)
}

// Create godoc
// Only admin can create users.
// Body: { "username": "...", "email": "...", "password": "...", "role": "operator" }
func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username          string          `json:"username"`
		Email             string          `json:"email"`
		Password          string          `json:"password"`
		Role              domain.UserRole `json:"role"`
		PreferredLanguage string          `json:"preferred_language"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	hash, err := service.HashPassword(body.Password)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	u := &domain.User{
		Username:          body.Username,
		Email:             body.Email,
		PasswordHash:      hash,
		Role:              body.Role,
		PreferredLanguage: domain.Language(body.PreferredLanguage),
	}
	if u.Role == "" {
		u.Role = domain.RoleOperator
	}

	if err := h.repo.Create(r.Context(), u); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, u)
}

func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var body struct {
		Username          string          `json:"username"`
		Email             string          `json:"email"`
		Role              domain.UserRole `json:"role"`
		PreferredLanguage string          `json:"preferred_language"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	u := &domain.User{
		ID:                id,
		Username:          body.Username,
		Email:             body.Email,
		Role:              body.Role,
		PreferredLanguage: domain.Language(body.PreferredLanguage),
	}
	if err := h.repo.Update(r.Context(), u); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, u)
}

// ChangePassword allows admin to reset any user's password.
// Body: { "password": "newpassword" }
func (h *UserHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var body struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	hash, err := service.HashPassword(body.Password)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	if err := h.repo.SetPassword(r.Context(), id, hash); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) Block(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.SetActive(r.Context(), id, false); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) Unblock(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.SetActive(r.Context(), id, true); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.Delete(r.Context(), id); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
