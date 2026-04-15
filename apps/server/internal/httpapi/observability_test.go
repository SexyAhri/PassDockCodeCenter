package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/config"
	"passdock/server/internal/database"
	"passdock/server/internal/service"
)

func TestOperationalEndpointsExposeHealthReadinessAndMetrics(t *testing.T) {
	router := newObservabilityTestRouter(t, config.Config{
		StorageType:      "local",
		StorageLocalPath: filepath.Join(t.TempDir(), "storage"),
	}, true)

	healthResponse := performObservabilityRequest(router, http.MethodGet, "/healthz")
	if healthResponse.Code != http.StatusOK {
		t.Fatalf("expected /healthz 200, got %d", healthResponse.Code)
	}

	readinessResponse := performObservabilityRequest(router, http.MethodGet, "/readyz")
	if readinessResponse.Code != http.StatusOK {
		t.Fatalf("expected /readyz 200, got %d: %s", readinessResponse.Code, readinessResponse.Body.String())
	}

	var readiness service.ReadinessReport
	if err := json.Unmarshal(readinessResponse.Body.Bytes(), &readiness); err != nil {
		t.Fatalf("decode readiness returned error: %v", err)
	}
	if readiness.Status != "ready" {
		t.Fatalf("expected readiness status ready, got %q", readiness.Status)
	}
	if readiness.Checks["database"].Status != "ready" {
		t.Fatalf("expected database check ready, got %#v", readiness.Checks["database"])
	}
	if readiness.Checks["storage"].Status != "ready" {
		t.Fatalf("expected storage check ready, got %#v", readiness.Checks["storage"])
	}

	metricsResponse := performObservabilityRequest(router, http.MethodGet, "/metrics")
	if metricsResponse.Code != http.StatusOK {
		t.Fatalf("expected /metrics 200, got %d: %s", metricsResponse.Code, metricsResponse.Body.String())
	}
	metricsBody := metricsResponse.Body.String()
	if !strings.Contains(metricsBody, "passdock_http_requests_total") {
		t.Fatalf("expected custom request counter metric in response body")
	}
	if !strings.Contains(metricsBody, "passdock_http_request_duration_seconds") {
		t.Fatalf("expected custom duration histogram metric in response body")
	}
}

func TestReadyzReturnsServiceUnavailableWhenStorageIsUnavailable(t *testing.T) {
	router := newObservabilityTestRouter(t, config.Config{
		StorageType:      "local",
		StorageLocalPath: filepath.Join(t.TempDir(), "missing-storage"),
	}, false)

	response := performObservabilityRequest(router, http.MethodGet, "/readyz")
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected /readyz 503, got %d: %s", response.Code, response.Body.String())
	}

	var readiness service.ReadinessReport
	if err := json.Unmarshal(response.Body.Bytes(), &readiness); err != nil {
		t.Fatalf("decode readiness returned error: %v", err)
	}
	if readiness.Status != "not_ready" {
		t.Fatalf("expected readiness status not_ready, got %q", readiness.Status)
	}
	if readiness.Checks["storage"].Status != "not_ready" {
		t.Fatalf("expected storage check not_ready, got %#v", readiness.Checks["storage"])
	}
}

func TestRecoveryReportsPanicsThroughErrorReporter(t *testing.T) {
	reporter := &capturingErrorReporter{}
	router := newObservabilityTestRouter(t, config.Config{
		StorageType:      "local",
		StorageLocalPath: filepath.Join(t.TempDir(), "storage"),
	}, true, reporter)
	router.GET("/__panic", func(c *gin.Context) {
		panic("panic for observability test")
	})

	response := performObservabilityRequest(router, http.MethodGet, "/__panic")
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("expected panic route 500, got %d", response.Code)
	}

	events := reporter.Events()
	if len(events) != 1 {
		t.Fatalf("expected exactly one reported error event, got %d", len(events))
	}
	if events[0].Source != "httpapi" || events[0].Category != "panic" {
		t.Fatalf("expected httpapi panic event, got %#v", events[0])
	}
	if !strings.Contains(events[0].Message, "panic for observability test") {
		t.Fatalf("expected panic message to be reported, got %#v", events[0].Message)
	}
	if events[0].Tags["route"] != "/__panic" {
		t.Fatalf("expected panic route tag, got %#v", events[0].Tags)
	}
}

func newObservabilityTestRouter(
	t *testing.T,
	partial config.Config,
	prepareStorage bool,
	reporter ...service.ErrorReporter,
) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	cfg := config.Config{
		AppEnv:              "test",
		DBDriver:            "sqlite",
		SQLitePath:          filepath.Join(t.TempDir(), "passdock-test.db"),
		SessionSecret:       "test-session-secret",
		InternalSignKey:     "passdock-system",
		InternalSignSecret:  "test-internal-secret",
		CORSAllowOrigins:    []string{"*"},
		StoragePublicPath:   "/uploads",
		UploadMaxFileSizeMB: 8,
		StorageType:         "local",
		StorageLocalPath:    filepath.Join(t.TempDir(), "storage"),
		TelegramBotKey:      "default",
	}
	if strings.TrimSpace(partial.StorageType) != "" {
		cfg.StorageType = partial.StorageType
	}
	if strings.TrimSpace(partial.StorageLocalPath) != "" {
		cfg.StorageLocalPath = partial.StorageLocalPath
	}

	db, err := database.Open(cfg)
	if err != nil {
		t.Fatalf("database.Open returned error: %v", err)
	}
	if err := database.AutoMigrate(db); err != nil {
		t.Fatalf("database.AutoMigrate returned error: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db.DB returned error: %v", err)
	}
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})

	svc := service.New(cfg, db)
	if len(reporter) > 0 && reporter[0] != nil {
		svc.SetErrorReporter(reporter[0])
	}
	if prepareStorage {
		if err := svc.PrepareStorage(context.Background()); err != nil {
			t.Fatalf("PrepareStorage returned error: %v", err)
		}
	}

	return NewRouter(cfg, svc)
}

func performObservabilityRequest(router http.Handler, method string, requestPath string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, requestPath, nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	return recorder
}

type capturingErrorReporter struct {
	mu     sync.Mutex
	events []service.ErrorEvent
}

func (r *capturingErrorReporter) Capture(_ context.Context, event service.ErrorEvent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, event)
}

func (r *capturingErrorReporter) Events() []service.ErrorEvent {
	r.mu.Lock()
	defer r.mu.Unlock()

	items := make([]service.ErrorEvent, len(r.events))
	copy(items, r.events)
	return items
}
