package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/rguziy/billcore/internal/domain"
	"github.com/rguziy/billcore/internal/repository"
)

type SubscriptionHandler struct {
	repo *repository.SubscriptionRepo
}

func NewSubscriptionHandler(repo *repository.SubscriptionRepo) *SubscriptionHandler {
	return &SubscriptionHandler{repo: repo}
}

func (h *SubscriptionHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	subs, err := h.repo.GetAll(r.Context())
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, subs)
}

func (h *SubscriptionHandler) ListByLocation(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	subs, err := h.repo.GetByLocation(r.Context(), id)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, subs)
}

func (h *SubscriptionHandler) Create(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var s domain.Subscription
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if s.ConnectedAt.IsZero() {
		writeError(w, fmt.Errorf("connected_at is required"), http.StatusBadRequest)
		return
	}
	s.LocationID = id
	if err := h.repo.Create(r.Context(), &s); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, s)
}

func (h *SubscriptionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var s domain.Subscription
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	s.ID = id
	if err := h.repo.Update(r.Context(), &s); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, s)
}

func (h *SubscriptionHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var body struct {
		Date string `json:"date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.Disconnect(r.Context(), id, body.Date); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *SubscriptionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.Delete(r.Context(), id); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
