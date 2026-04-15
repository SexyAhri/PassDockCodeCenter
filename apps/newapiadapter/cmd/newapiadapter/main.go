package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"passdock/newapiadapter/internal/app"
)

func main() {
	cfg := app.LoadConfig()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("newapiadapter: invalid config: %v", err)
	}

	store, err := app.NewStore(cfg.StorePath)
	if err != nil {
		log.Fatalf("newapiadapter: init store: %v", err)
	}

	server := app.NewServer(cfg, store)
	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("newapiadapter: listening on :%s upstream=%s", cfg.Port, cfg.UpstreamBaseURL)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("newapiadapter: listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("newapiadapter: shutdown: %v", err)
	}
}
