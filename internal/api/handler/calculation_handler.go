package handler

import (
	"encoding/json"
	"net/http"

	"github.com/rguziy/billcore/internal/domain"
	"github.com/rguziy/billcore/internal/repository"
	"github.com/rguziy/billcore/internal/service"
)

type CalculationHandler struct {
	repo           *repository.CalculationRepo
	billingService *service.BillingService
	reportService  *service.ReportService
}

func NewCalculationHandler(
	repo *repository.CalculationRepo,
	billing *service.BillingService,
	report *service.ReportService,
) *CalculationHandler {
	return &CalculationHandler{repo: repo, billingService: billing, reportService: report}
}

func (h *CalculationHandler) ListBySubscription(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	calcs, err := h.repo.GetBySubscription(r.Context(), id)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, calcs)
}

func (h *CalculationHandler) ListPending(w http.ResponseWriter, r *http.Request) {
	clientID, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	calcs, err := h.repo.GetPending(r.Context(), clientID)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, calcs)
}

func (h *CalculationHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var body struct {
		Status domain.CalculationStatus `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.UpdateStatus(r.Context(), id, body.Status); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CalculationHandler) ClientBalance(w http.ResponseWriter, r *http.Request) {
	clientID, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	balance, err := h.reportService.GetClientBalance(r.Context(), clientID)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, balance)
}

func (h *CalculationHandler) LatestReadings(w http.ResponseWriter, r *http.Request) {
	clientID, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	readings, err := h.reportService.GetLatestReadings(r.Context(), clientID)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, readings)
}
