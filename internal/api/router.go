package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rguziy/billcore/internal/api/handler"
	"github.com/rguziy/billcore/internal/api/middleware"
)

func NewRouter(
	jwtSecret string,
	auth *handler.AuthHandler,
	users *handler.UserHandler,
	clients *handler.ClientHandler,
	services *handler.ServiceHandler,
	calculations *handler.CalculationHandler,
	subscriptions *handler.SubscriptionHandler,
	periods *handler.PeriodHandler,
) *chi.Mux {
	r := chi.NewRouter()

	r.Use(chimw.Recoverer)
	r.Use(middleware.Logger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Public
	r.Post("/auth/login", auth.Login)

	// All routes below require authentication
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(jwtSecret))

		r.Get("/auth/me", auth.Me)
		r.Patch("/auth/language", auth.SetLanguage)

		// ── Admin only ─────────────────────────────────────────────
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAdmin)
			r.Get("/users", users.List)
			r.Post("/users", users.Create)
			r.Get("/users/{id}", users.Get)
			r.Put("/users/{id}", users.Update)
			r.Patch("/users/{id}/block", users.Block)
			r.Patch("/users/{id}/unblock", users.Unblock)
			r.Patch("/users/{id}/password", users.ChangePassword)
			r.Delete("/users/{id}", users.Delete)
		})

		// ── Manager + Admin only ────────────────────────────────────
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireManagerOrAbove)
			// Services CRUD
			r.Post("/services", services.Create)
			r.Put("/services/{id}", services.Update)
			r.Delete("/services/{id}", services.Delete)
			// Tariffs CRUD
			r.Post("/services/{id}/tariffs", services.CreateTariff)
			r.Put("/tariffs/{id}", services.UpdateTariff)
			r.Delete("/tariffs/{id}", services.DeleteTariff)
			// Periods management
			r.Post("/periods/open", periods.Open)
			r.Patch("/periods/{id}/close", periods.Close)
			r.Patch("/periods/{id}/reopen", periods.Reopen)
			r.Delete("/periods/{id}", periods.Delete)
			// Statistics
			r.Get("/statistics", calculations.GetStatistics)
		})

		// ── All authenticated roles ─────────────────────────────────

		// Clients
		r.Get("/clients", clients.List)
		r.Post("/clients", clients.Create)
		r.Get("/clients/{id}", clients.Get)
		r.Put("/clients/{id}", clients.Update)
		r.Delete("/clients/{id}", clients.Delete)

		// Locations
		r.Get("/locations", clients.ListAllLocations)
		r.Get("/clients/{id}/locations", clients.ListLocations)
		r.Post("/clients/{id}/locations", clients.CreateLocation)
		r.Put("/locations/{id}", clients.UpdateLocation)
		r.Delete("/locations/{id}", clients.DeleteLocation)

		// Client reports
		r.Get("/clients/{id}/balance", calculations.ClientBalance)
		r.Get("/clients/{id}/readings", calculations.LatestReadings)
		r.Get("/clients/{id}/pending", calculations.ListPending)
		r.Get("/clients/{id}/paid", calculations.ListPaid)

		// Services (read only for operator)
		r.Get("/services", services.List)
		r.Get("/services/{id}/tariffs", services.ListTariffs)

		// Subscriptions
		r.Get("/subscriptions", subscriptions.ListAll)
		r.Get("/locations/{id}/subscriptions", subscriptions.ListByLocation)
		r.Post("/locations/{id}/subscriptions", subscriptions.Create)
		r.Put("/subscriptions/{id}", subscriptions.Update)
		r.Patch("/subscriptions/{id}/disconnect", subscriptions.Disconnect)
		r.Delete("/subscriptions/{id}", subscriptions.Delete)
		r.Get("/subscriptions/{id}/calculations", calculations.ListBySubscription)

		// Periods (read only for operator)
		r.Get("/periods", periods.List)
		r.Get("/periods/{id}", periods.Get)

		// Calculations
		r.Get("/periods/{id}/calculations", calculations.GetByPeriod)
		r.Post("/periods/{id}/calculations", calculations.Create)
		r.Patch("/calculations/{id}/reading", calculations.UpdateReading)
		r.Patch("/calculations/{id}/status", calculations.UpdateStatus)
		r.Patch("/calculations/{id}/note", calculations.UpdateNote)
		r.Delete("/calculations/{id}", calculations.Delete)
	})

	return r
}
