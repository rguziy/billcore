package handler

import (
	"encoding/json"
	"net/http"

	"github.com/rguziy/billcore/internal/domain"
	"github.com/rguziy/billcore/internal/repository"
)

type PaymentHandler struct {
	repo *repository.PaymentRepo
}

func NewPaymentHandler(repo *repository.PaymentRepo) *PaymentHandler {
	return &PaymentHandler{repo: repo}
}

func (h *PaymentHandler) ListByClient(w http.ResponseWriter, r *http.Request) {
	clientID, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	payments, err := h.repo.GetByClient(r.Context(), clientID)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, payments)
}

func (h *PaymentHandler) Create(w http.ResponseWriter, r *http.Request) {
	clientID, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var p domain.Payment
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	p.ClientID = clientID
	if err := h.repo.Create(r.Context(), &p); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, p)
}
