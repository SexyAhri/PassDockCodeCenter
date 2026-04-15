package service

import (
	"crypto/sha256"
	"sync"
	"time"

	"gorm.io/gorm"

	"passdock/server/internal/config"
)

type Service struct {
	cfg        config.Config
	db         *gorm.DB
	cryptoKey  [32]byte
	nonceMu    sync.Mutex
	nonceSeen  map[string]time.Time
	workerOnce sync.Once
	reporter   ErrorReporter
}

type AuditMeta struct {
	RequestIP   string
	AdminUserID *uint
}

func New(cfg config.Config, db *gorm.DB) *Service {
	return &Service{
		cfg:       cfg,
		db:        db,
		cryptoKey: sha256.Sum256([]byte(cfg.SessionSecret + ":" + cfg.InternalSignSecret)),
		nonceSeen: map[string]time.Time{},
		reporter:  noopErrorReporter{},
	}
}
