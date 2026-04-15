package httpapi

import (
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpMetricsRegisterOnce sync.Once
	httpRequestsTotal       = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "passdock_http_requests_total",
			Help: "Total number of HTTP requests handled by PassDock.",
		},
		[]string{"method", "route", "status_code"},
	)
	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "passdock_http_request_duration_seconds",
			Help:    "HTTP request duration in seconds for PassDock routes.",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"method", "route", "status_code"},
	)
)

func registerHTTPMetrics() {
	httpMetricsRegisterOnce.Do(func() {
		prometheus.MustRegister(httpRequestsTotal, httpRequestDuration)
	})
}

func httpMetricsMiddleware() gin.HandlerFunc {
	registerHTTPMetrics()

	return func(c *gin.Context) {
		startedAt := time.Now()
		c.Next()

		method := normalizeMetricMethod(c.Request.Method)
		route := normalizeMetricRoute(c.FullPath())
		statusCode := strconv.Itoa(c.Writer.Status())

		httpRequestsTotal.WithLabelValues(method, route, statusCode).Inc()
		httpRequestDuration.WithLabelValues(method, route, statusCode).Observe(time.Since(startedAt).Seconds())
	}
}

func metricsHandler() gin.HandlerFunc {
	registerHTTPMetrics()
	return gin.WrapH(promhttp.Handler())
}

func normalizeMetricMethod(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "UNKNOWN"
	}

	return strings.ToUpper(trimmed)
}

func normalizeMetricRoute(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "unmatched"
	}

	return trimmed
}
