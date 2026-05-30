package handler

import (
	"encoding/json"
	"net/http"

	"github.com/rguziy/billcore/internal/domain"
	"github.com/rguziy/billcore/internal/repository"
)

type ServiceHandler struct {
	repo *repository.ServiceRepo
}

func NewServiceHandler(repo *repository.ServiceRepo) *ServiceHandler {
	return &ServiceHandler{repo: repo}
}

func (h *ServiceHandler) List(w http.ResponseWriter, r *http.Request) {
	services, err := h.repo.GetAll(r.Context())
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, services)
}

func (h *ServiceHandler) Create(w http.ResponseWriter, r *http.Request) {
	var s domain.Service
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.Create(r.Context(), &s); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, s)
}

func (h *ServiceHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var s domain.Service
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

func (h *ServiceHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

func (h *ServiceHandler) ListTariffs(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	tariffs, err := h.repo.GetTariffs(r.Context(), id)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, tariffs)
}

func (h *ServiceHandler) CreateTariff(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var t domain.Tariff
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	t.ServiceID = id
	if err := h.repo.CreateTariff(r.Context(), &t); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, t)
}
