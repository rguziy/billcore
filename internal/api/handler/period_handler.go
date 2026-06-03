package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/rguziy/billcore/internal/repository"
	"github.com/rguziy/billcore/internal/service"
)

type PeriodHandler struct {
	repo          *repository.PeriodRepo
	periodService *service.PeriodService
}

func NewPeriodHandler(repo *repository.PeriodRepo, svc *service.PeriodService) *PeriodHandler {
	return &PeriodHandler{repo: repo, periodService: svc}
}

func (h *PeriodHandler) List(w http.ResponseWriter, r *http.Request) {
	periods, err := h.repo.GetAll(r.Context())
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, periods)
}

func (h *PeriodHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	p, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, err, http.StatusNotFound)
		return
	}
	writeJSON(w, p)
}

// Open creates a new period and auto-generates calculations.
// Body: { "period_start": "2026-01-01" }
func (h *PeriodHandler) Open(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PeriodStart string `json:"period_start"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	periodStart, err := time.Parse(time.DateOnly, body.PeriodStart)
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}

	period, generated, err := h.periodService.OpenPeriod(r.Context(), service.OpenPeriodRequest{
		PeriodStart: periodStart,
	})
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, map[string]any{
		"period":    period,
		"generated": generated,
	})
}

func (h *PeriodHandler) Close(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.Close(r.Context(), id); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *PeriodHandler) Reopen(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.Reopen(r.Context(), id); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *PeriodHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
