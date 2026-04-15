package database

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"passdock/server/internal/config"
	"passdock/server/internal/model"
)

func Open(cfg config.Config) (*gorm.DB, error) {
	var dialector gorm.Dialector

	switch cfg.DBDriver {
	case "postgres":
		dialector = postgres.Open(cfg.PostgresDSN)
	default:
		if err := ensureSQLiteDir(cfg.SQLitePath); err != nil {
			return nil, err
		}

		dialector = sqlite.Open(cfg.SQLitePath)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	if cfg.DBDriver != "postgres" {
		if err := db.Exec("PRAGMA journal_mode = WAL;").Error; err != nil {
			return nil, fmt.Errorf("enable wal: %w", err)
		}
	}

	return db, nil
}

func AutoMigrate(db *gorm.DB) error {
	if err := normalizeProductPriceIndexes(db); err != nil {
		return err
	}

	return db.AutoMigrate(
		&model.User{},
		&model.UserSession{},
		&model.IdempotencyRecord{},
		&model.TelegramBinding{},
		&model.PaymentChannel{},
		&model.IntegrationProvider{},
		&model.IntegrationAction{},
		&model.FulfillmentStrategy{},
		&model.DeliveryStrategy{},
		&model.Product{},
		&model.ProductPrice{},
		&model.Order{},
		&model.OrderItem{},
		&model.OrderEvent{},
		&model.PaymentRecord{},
		&model.PaymentCallbackLog{},
		&model.PaymentWatcherRecord{},
		&model.RefundRecord{},
		&model.PaymentProof{},
		&model.FulfillmentRecord{},
		&model.CodeIssueRecord{},
		&model.DeliveryRecord{},
		&model.SupportTicket{},
		&model.RuntimeSetting{},
		&model.InternalClientKey{},
		&model.AdminOperationLog{},
		&model.AsyncJob{},
	)
}

func normalizeProductPriceIndexes(db *gorm.DB) error {
	if db.Migrator().HasTable(&model.ProductPrice{}) &&
		db.Migrator().HasColumn(&model.ProductPrice{}, "payment_method") &&
		db.Migrator().HasColumn(&model.ProductPrice{}, "currency") {
		if err := dedupeProductPrices(db); err != nil {
			return err
		}
	}

	if db.Migrator().HasIndex(&model.ProductPrice{}, "uk_product_prices_product_payment_currency") {
		if err := db.Migrator().DropIndex(&model.ProductPrice{}, "uk_product_prices_product_payment_currency"); err != nil {
			return err
		}
	}

	if db.Migrator().HasIndex(&model.ProductPrice{}, "uk_product_prices_product_template_payment_currency") {
		if err := db.Migrator().DropIndex(&model.ProductPrice{}, "uk_product_prices_product_template_payment_currency"); err != nil {
			return err
		}
	}

	return nil
}

func dedupeProductPrices(db *gorm.DB) error {
	var prices []model.ProductPrice
	if err := db.Order("updated_at DESC, id DESC").Find(&prices).Error; err != nil {
		return err
	}

	seen := make(map[string]struct{}, len(prices))
	duplicateIDs := make([]uint, 0)

	for _, item := range prices {
		key := fmt.Sprintf(
			"%d|%s|%s|%s",
			item.ProductID,
			normalizeProductPriceIndexValue(item.TemplateName),
			normalizeProductPriceIndexValue(item.PaymentMethod),
			normalizeProductPriceIndexValue(item.Currency),
		)

		if _, exists := seen[key]; exists {
			duplicateIDs = append(duplicateIDs, item.ID)
			continue
		}

		seen[key] = struct{}{}
	}

	if len(duplicateIDs) == 0 {
		return nil
	}

	return db.Where("id IN ?", duplicateIDs).Delete(&model.ProductPrice{}).Error
}

func normalizeProductPriceIndexValue(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func ensureSQLiteDir(path string) error {
	dir := filepath.Dir(path)
	if dir == "." || dir == "" {
		return nil
	}

	return os.MkdirAll(dir, 0o755)
}
