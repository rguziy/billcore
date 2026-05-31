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
	clients *handler.ClientHandler,
	services *handler.ServiceHandler,
	calculations *handler.CalculationHandler,
	payments *handler.PaymentHandler,
	subscriptions *handler.SubscriptionHandler,
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

	r.Group(func(r chi.Router) {
		if jwtSecret != "dev" {
			r.Use(middleware.Auth(jwtSecret))
		}

		// Clients
		r.Get("/clients", clients.List)
		r.Post("/clients", clients.Create)
		r.Get("/clients/{id}", clients.Get)
		r.Put("/clients/{id}", clients.Update)
		r.Delete("/clients/{id}", clients.Delete)

		// Locations (nested under client)
		r.Get("/locations", clients.ListAllLocations)
		r.Get("/clients/{id}/locations", clients.ListLocations)
		r.Post("/clients/{id}/locations", clients.CreateLocation)
		r.Put("/locations/{id}", clients.UpdateLocation)
		r.Delete("/locations/{id}", clients.DeleteLocation)

		// Reports (nested under client)
		r.Get("/clients/{id}/balance", calculations.ClientBalance)
		r.Get("/clients/{id}/readings", calculations.LatestReadings)
		r.Get("/clients/{id}/pending", calculations.ListPending)
		r.Get("/clients/{id}/payments", payments.ListByClient)
		r.Post("/clients/{id}/payments", payments.Create)

		// Services
		r.Get("/services", services.List)
		r.Post("/services", services.Create)
		r.Put("/services/{id}", services.Update)
		r.Delete("/services/{id}", services.Delete)

		// Tariffs (nested under service)
		r.Get("/services/{id}/tariffs", services.ListTariffs)
		r.Post("/services/{id}/tariffs", services.CreateTariff)

		// Subscriptions
		r.Get("/subscriptions", subscriptions.ListAll)
		r.Get("/locations/{id}/subscriptions", subscriptions.ListByLocation)
		r.Post("/locations/{id}/subscriptions", subscriptions.Create)
		r.Put("/subscriptions/{id}", subscriptions.Update)
		r.Patch("/subscriptions/{id}/disconnect", subscriptions.Disconnect)
		r.Delete("/subscriptions/{id}", subscriptions.Delete)

		// Calculations
		r.Get("/subscriptions/{id}/calculations", calculations.ListBySubscription)
		r.Patch("/calculations/{id}/status", calculations.UpdateStatus)
	})

	return r
}
