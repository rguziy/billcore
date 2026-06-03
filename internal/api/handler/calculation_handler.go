package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/rguziy/billcore/internal/domain"
	"github.com/rguziy/billcore/internal/repository"
	"github.com/rguziy/billcore/internal/service"
)

type CalculationHandler struct {
	repo          *repository.CalculationRepo
	reportService *service.ReportService
}

func NewCalculationHandler(
	repo *repository.CalculationRepo,
	report *service.ReportService,
) *CalculationHandler {
	return &CalculationHandler{repo: repo, reportService: report}
}

// GetByPeriod returns all calculations for a period, optionally filtered by client.
// GET /periods/{id}/calculations?client_id=5
func (h *CalculationHandler) GetByPeriod(w http.ResponseWriter, r *http.Request) {
	periodID, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	clientIDStr := r.URL.Query().Get("client_id")
	if clientIDStr != "" {
		clientID := 0
		if _, err := fmt.Sscan(clientIDStr, &clientID); err != nil {
			writeError(w, err, http.StatusBadRequest)
			return
		}
		calcs, err := h.repo.GetByPeriodAndClient(r.Context(), periodID, clientID)
		if err != nil {
			writeError(w, err, http.StatusInternalServerError)
			return
		}
		writeJSON(w, calcs)
		return
	}

	calcs, err := h.repo.GetByPeriod(r.Context(), periodID)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, calcs)
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

// UpdateReading updates reading_curr and recalculates amount.
// PATCH /calculations/{id}/reading  body: { "reading_curr": 608 }
func (h *CalculationHandler) UpdateReading(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var body struct {
		ReadingCurr float64 `json:"reading_curr"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.UpdateReading(r.Context(), id, body.ReadingCurr); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
		writeError(w, err, http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CalculationHandler) UpdateNote(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var body struct {
		Note string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.UpdateNote(r.Context(), id, body.Note); err != nil {
		writeError(w, err, http.StatusBadRequest)
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
