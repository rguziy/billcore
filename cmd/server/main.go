package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/rguziy/billcore/internal/api"
	"github.com/rguziy/billcore/internal/api/handler"
	"github.com/rguziy/billcore/internal/config"
	"github.com/rguziy/billcore/internal/db"
	"github.com/rguziy/billcore/internal/repository"
	"github.com/rguziy/billcore/internal/service"
)

// Version is set at build time via -ldflags "-X main.Version=v0.1.0"
var Version = "dev"

//go:embed web/out
var staticFiles embed.FS

func main() {
	_ = godotenv.Load()

	slog.Info("starting BillCore", "version", Version)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}

	if err := db.RunMigrations(cfg.DB.DSN()); err != nil {
		slog.Error("migrations", "err", err)
		os.Exit(1)
	}
	slog.Info("migrations applied")

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DB.DSN())
	if err != nil {
		slog.Error("database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("database connected")

	// Repositories
	userRepo         := repository.NewUserRepo(pool)
	clientRepo       := repository.NewClientRepo(pool)
	serviceRepo      := repository.NewServiceRepo(pool)
	subscriptionRepo := repository.NewSubscriptionRepo(pool)
	calcRepo         := repository.NewCalculationRepo(pool)
	periodRepo       := repository.NewPeriodRepo(pool)

	// Services
	authSvc   := service.NewAuthService(userRepo, cfg.JWT.Secret)
	reportSvc := service.NewReportService(pool)
	periodSvc := service.NewPeriodService(pool, periodRepo, serviceRepo)

	// Handlers
	authHandler         := handler.NewAuthHandler(authSvc)
	userHandler         := handler.NewUserHandler(userRepo)
	clientHandler       := handler.NewClientHandler(clientRepo)
	serviceHandler      := handler.NewServiceHandler(serviceRepo)
	calcHandler         := handler.NewCalculationHandler(calcRepo, reportSvc)
	subscriptionHandler := handler.NewSubscriptionHandler(subscriptionRepo)
	periodHandler       := handler.NewPeriodHandler(periodRepo, periodSvc)

	apiRouter := api.NewRouter(
		cfg.JWT.Secret,
		authHandler,
		userHandler,
		clientHandler,
		serviceHandler,
		calcHandler,
		subscriptionHandler,
		periodHandler,
	)

	// Root mux: /api/* → API handlers, / → static files
	mux := http.NewServeMux()

	// API routes (strip /api prefix before passing to chi router)
	mux.Handle("/api/", http.StripPrefix("/api", apiRouter))

	// Version endpoint (public)
	mux.HandleFunc("/version", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"version":%q}`, Version)
	})

	// Static files from embedded web/out
	webFS, err := fs.Sub(staticFiles, "web/out")
	if err != nil {
		slog.Error("static files", "err", err)
		os.Exit(1)
	}
	fileServer := http.FileServer(http.FS(webFS))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// SPA fallback: serve index.html for unknown non-file paths
		path := r.URL.Path
		if path != "/" && !strings.Contains(path, ".") {
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Server.Port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		slog.Info("server started", "port", cfg.Server.Port, "version", Version)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server", "err", err)
			os.Exit(1)
		}
	}()

	<-quit
	slog.Info("shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown", "err", err)
	}
	slog.Info("server stopped")
}
