package handler

import (
	"encoding/json"
	"fmt"
	"math"
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

// Create manually creates a calculation for a subscription in an open period.
// POST /periods/{id}/calculations
// Body: { "subscription_id": 1, "reading_prev": 600, "reading_curr": 608, "quantity": 1, "note": "" }
func (h *CalculationHandler) Create(w http.ResponseWriter, r *http.Request) {
	periodID, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	var body struct {
		SubscriptionID int      `json:"subscription_id"`
		ReadingPrev    *float64 `json:"reading_prev"`
		ReadingCurr    *float64 `json:"reading_curr"`
		Quantity       *float64 `json:"quantity"`
		Note           string   `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	// Fetch subscription info to get tariff
	info, err := h.repo.GetSubscriptionInfo(r.Context(), body.SubscriptionID)
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	// Calculate quantity and amount
	var quantity float64
	if body.Quantity != nil {
		quantity = *body.Quantity
	} else if body.ReadingPrev != nil && body.ReadingCurr != nil {
		quantity = *body.ReadingCurr - *body.ReadingPrev
		if quantity < 0 {
			quantity = 0
		}
	} else if !info.HasMeter {
		quantity = 1
	}

	amount := math.Round(quantity*info.PricePerUnit*1e2) / 1e2

	calc := &domain.Calculation{
		SubscriptionID: body.SubscriptionID,
		PeriodID:       periodID,
		TariffID:       info.TariffID,
		ReadingPrev:    body.ReadingPrev,
		ReadingCurr:    body.ReadingCurr,
		Quantity:       quantity,
		Amount:         amount,
		Note:           body.Note,
	}

	if err := h.repo.Create(r.Context(), calc); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, calc)
}

// Delete removes a calculation if no payments exist and period is open.
// DELETE /calculations/{id}
func (h *CalculationHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

// GetByPeriod returns enriched calculations (with service name) for a period.
// GET /periods/{id}/calculations?client_id=5
func (h *CalculationHandler) GetByPeriod(w http.ResponseWriter, r *http.Request) {
	periodID, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	var clientID *int
	if s := r.URL.Query().Get("client_id"); s != "" {
		var id int
		if _, err := fmt.Sscan(s, &id); err != nil {
			writeError(w, err, http.StatusBadRequest)
			return
		}
		clientID = &id
	}

	var locationID *int
	if s := r.URL.Query().Get("location_id"); s != "" {
		var id int
		if _, err := fmt.Sscan(s, &id); err != nil {
			writeError(w, err, http.StatusBadRequest)
			return
		}
		locationID = &id
	}

	rows, err := h.repo.GetRowsByPeriod(r.Context(), periodID, clientID, locationID)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, rows)
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
	rows, err := h.repo.GetPendingRows(r.Context(), clientID)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, rows)
}

// UpdateReading updates reading_prev (optional) and reading_curr, recalculates amount.
// PATCH /calculations/{id}/reading
// Body: { "reading_prev": 600, "reading_curr": 608 }
func (h *CalculationHandler) UpdateReading(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var body struct {
		ReadingPrev *float64 `json:"reading_prev"`
		ReadingCurr float64  `json:"reading_curr"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.UpdateReading(r.Context(), id, body.ReadingPrev, body.ReadingCurr); err != nil {
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

func (h *CalculationHandler) ListPaid(w http.ResponseWriter, r *http.Request) {
	clientID, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	rows, err := h.repo.GetPaidRows(r.Context(), clientID)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, rows)
}

func (h *CalculationHandler) GetStatistics(w http.ResponseWriter, r *http.Request) {
	stats, err := h.reportService.GetStatistics(r.Context())
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, stats)
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

func (h *CalculationHandler) ClientHistory(w http.ResponseWriter, r *http.Request) {
	clientID, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	rows, err := h.repo.GetPeriodHistory(r.Context(), clientID)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, rows)
}
