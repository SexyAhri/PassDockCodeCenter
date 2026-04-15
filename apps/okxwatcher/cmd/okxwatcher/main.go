package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"passdock/okxwatcher/internal/app"
)

func main() {
	cfg := app.LoadConfig()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("okxwatcher: invalid config: %v", err)
	}

	server := app.NewServer(cfg)
	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf(
			"okxwatcher: listening on :%s for %s via %s",
			cfg.Port,
			cfg.ReceiveAddress,
			cfg.TronGridBaseURL,
		)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("okxwatcher: listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("okxwatcher: shutdown: %v", err)
	}
}
