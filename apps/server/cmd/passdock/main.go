package main

import (
	"context"
	"log"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"

	"passdock/server/internal/config"
	"passdock/server/internal/database"
	"passdock/server/internal/httpapi"
	"passdock/server/internal/service"
)

func main() {
	loadEnvFiles()

	cfg := config.Load()
	if cfg.StorageType == "" || cfg.StorageType == "local" {
		if err := os.MkdirAll(cfg.StorageLocalPath, 0o755); err != nil {
			log.Fatalf("create storage path: %v", err)
		}
	}
	db, err := database.Open(cfg)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}

	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("auto migrate: %v", err)
	}

	svc := service.New(cfg, db)
	if err := svc.PrepareStorage(context.Background()); err != nil {
		log.Fatalf("prepare storage: %v", err)
	}
	if err := svc.SeedRuntimeDefaults(); err != nil {
		log.Fatalf("seed defaults: %v", err)
	}
	if err := svc.ValidateProviderBootstrapTargets(context.Background()); err != nil {
		log.Fatalf("validate providers: %v", err)
	}
	svc.StartBackgroundWorkers(context.Background())

	router := httpapi.NewRouter(cfg, svc)
	if err := router.Run(cfg.ListenAddress()); err != nil {
		log.Fatalf("run server: %v", err)
	}
}

func loadEnvFiles() {
	candidates := []string{
		".env",
		filepath.Join("..", ".env"),
		filepath.Join("..", "..", ".env"),
		filepath.Join("..", "..", "..", ".env"),
	}

	for _, candidate := range candidates {
		_ = godotenv.Overload(candidate)
	}
}
