package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rguziy/billcore/internal/domain"
	"github.com/rguziy/billcore/internal/repository"
)

type ClientHandler struct {
	repo *repository.ClientRepo
}

func NewClientHandler(repo *repository.ClientRepo) *ClientHandler {
	return &ClientHandler{repo: repo}
}

func (h *ClientHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	if limit <= 0 {
		limit = 20
	}

	page, err := h.repo.Search(r.Context(), repository.ClientFilter{
		Search: q.Get("search"),
		Status: q.Get("status"),
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, page)
}

func (h *ClientHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	client, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, err, http.StatusNotFound)
		return
	}
	writeJSON(w, client)
}

func (h *ClientHandler) Create(w http.ResponseWriter, r *http.Request) {
	var c domain.Client
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.Create(r.Context(), &c); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, c)
}

func (h *ClientHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var c domain.Client
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	c.ID = id
	if err := h.repo.Update(r.Context(), &c); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, c)
}

func (h *ClientHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

func (h *ClientHandler) ListLocations(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	locs, err := h.repo.GetLocations(r.Context(), id)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, locs)
}

func (h *ClientHandler) ListAllLocations(w http.ResponseWriter, r *http.Request) {
	locs, err := h.repo.GetAllLocations(r.Context())
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, locs)
}

func (h *ClientHandler) CreateLocation(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var l domain.Location
	if err := json.NewDecoder(r.Body).Decode(&l); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	l.ClientID = id
	if err := h.repo.CreateLocation(r.Context(), &l); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, l)
}

func (h *ClientHandler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	var l domain.Location
	if err := json.NewDecoder(r.Body).Decode(&l); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	l.ID = id
	if err := h.repo.UpdateLocation(r.Context(), &l); err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}
	writeJSON(w, l)
}

func (h *ClientHandler) DeleteLocation(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	if err := h.repo.DeleteLocation(r.Context(), id); err != nil {
		writeError(w, err, http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- helpers ---

func pathID(r *http.Request, key string) (int, error) {
	return strconv.Atoi(chi.URLParam(r, key))
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, err error, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}
