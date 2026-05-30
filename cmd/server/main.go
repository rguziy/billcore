package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
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

func main() {
	// Load .env (ignore error in production where env vars are set directly)
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}

	// Run migrations before opening the pool
	if err := db.RunMigrations(cfg.DB.DSN()); err != nil {
		slog.Error("migrations", "err", err)
		os.Exit(1)
	}
	slog.Info("migrations applied")

	// Database pool
	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DB.DSN())
	if err != nil {
		slog.Error("database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("database connected")

	// Repositories
	clientRepo := repository.NewClientRepo(pool)
	serviceRepo := repository.NewServiceRepo(pool)
	subscriptionRepo := repository.NewSubscriptionRepo(pool)
	calcRepo := repository.NewCalculationRepo(pool)
	paymentRepo := repository.NewPaymentRepo(pool)

	// Services
	billingSvc := service.NewBillingService(calcRepo, serviceRepo, subscriptionRepo)
	reportSvc := service.NewReportService(pool)

	// Handlers
	clientHandler := handler.NewClientHandler(clientRepo)
	serviceHandler := handler.NewServiceHandler(serviceRepo)
	calcHandler := handler.NewCalculationHandler(calcRepo, billingSvc, reportSvc)
	paymentHandler := handler.NewPaymentHandler(paymentRepo)

	// Router
	router := api.NewRouter(cfg.JWT.Secret, clientHandler, serviceHandler, calcHandler, paymentHandler)

	// HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		slog.Info("server started", "port", cfg.Server.Port)
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
