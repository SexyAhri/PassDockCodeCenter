package httpapi

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"passdock/server/internal/config"
	"passdock/server/internal/service"
)

type Handler struct {
	cfg config.Config
	svc *service.Service
}

const authUserContextKey = "passdock.auth.user"
const storefrontOrderAccessHeader = "X-PassDock-Order-Token"

func NewRouter(cfg config.Config, svc *service.Service) *gin.Engine {
	router := gin.New()
	router.MaxMultipartMemory = int64(cfg.UploadMaxFileSizeMB) * 1024 * 1024
	router.Use(httpMetricsMiddleware(), gin.Logger(), recoveryWithErrorReporter(svc))
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSAllowOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Accept", "Authorization", "Content-Type", "X-Idempotency-Key", storefrontOrderAccessHeader},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	handler := &Handler{cfg: cfg, svc: svc}

	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	router.GET("/readyz", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
		defer cancel()

		report := svc.ReadinessReport(ctx)
		statusCode := http.StatusOK
		if report.Status != "ready" {
			statusCode = http.StatusServiceUnavailable
		}

		c.JSON(statusCode, report)
	})
	router.GET("/metrics", metricsHandler())

	api := router.Group("/api/v1")
	api.Use(handler.handleIdempotency())
	handler.registerAuthRoutes(api)
	handler.registerPublicRoutes(api)
	handler.registerUploadRoutes(api)
	handler.registerStorefrontOrderRoutes(api)
	handler.registerBotRoutes(api)
	handler.registerCallbackRoutes(api)
	router.GET(strings.TrimRight(cfg.StoragePublicPath, "/")+"/*objectKey", handler.serveUploadedObject)

	me := api.Group("/me")
	me.Use(handler.requireUser())
	handler.registerMeRoutes(me)

	admin := api.Group("/admin")
	admin.Use(handler.requireAdmin())
	handler.registerAdminDashboardRoutes(admin)
	handler.registerAdminCatalogRoutes(admin)
	handler.registerAdminCustomerRoutes(admin)
	handler.registerAdminOrderRoutes(admin)
	handler.registerAdminPaymentRoutes(admin)
	handler.registerAdminRuntimeRoutes(admin)
	handler.registerAdminSystemSecurityRoutes(admin)
	handler.registerAdminUploadRoutes(admin)
	handler.registerAdminBotRoutes(admin)

	internal := router.Group("/internal/v1")
	internal.Use(handler.handleIdempotency())
	handler.registerInternalRoutes(internal)

	return router
}

func (h *Handler) requireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if strings.TrimSpace(h.cfg.AdminBearerToken) != "" && authHeader == "Bearer "+h.cfg.AdminBearerToken {
			c.Next()
			return
		}

		user, _, err := h.authenticateRequest(c.Request.Context(), authHeader)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, apiEnvelope{
				Success: false,
				Message: "unauthorized",
			})
			return
		}
		if user.Role != "admin" && user.Role != "operator" {
			c.AbortWithStatusJSON(http.StatusForbidden, apiEnvelope{
				Success: false,
				Message: "forbidden",
			})
			return
		}

		c.Set(authUserContextKey, user)
		c.Next()
	}
}

func (h *Handler) requireUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, _, err := h.authenticateRequest(c.Request.Context(), c.GetHeader("Authorization"))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, apiEnvelope{
				Success: false,
				Message: "unauthorized",
			})
			return
		}

		c.Set(authUserContextKey, user)
		c.Next()
	}
}

func (h *Handler) authenticateRequest(ctx context.Context, authHeader string) (*serviceAuthUser, any, error) {
	token := extractBearerToken(authHeader)
	user, session, err := h.svc.AuthenticateToken(ctx, token)
	if err != nil {
		return nil, nil, err
	}

	return &serviceAuthUser{
		ID:    user.ID,
		Email: derefString(user.Email),
		Name:  user.DisplayName,
		Role:  user.Role,
	}, session, nil
}

type serviceAuthUser struct {
	ID    uint
	Email string
	Name  string
	Role  string
}

func extractBearerToken(value string) string {
	text := strings.TrimSpace(value)
	if !strings.HasPrefix(strings.ToLower(text), "bearer ") {
		return ""
	}
	return strings.TrimSpace(text[7:])
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func currentUserFromContext(c *gin.Context) *serviceAuthUser {
	value, ok := c.Get(authUserContextKey)
	if !ok {
		return nil
	}

	user, ok := value.(*serviceAuthUser)
	if !ok {
		return nil
	}

	return user
}

func currentUserID(c *gin.Context) *uint {
	user := currentUserFromContext(c)
	if user == nil {
		return nil
	}

	return &user.ID
}

func (h *Handler) optionalCurrentUserID(c *gin.Context) *uint {
	user, _, err := h.authenticateRequest(c.Request.Context(), c.GetHeader("Authorization"))
	if err != nil {
		return nil
	}

	return &user.ID
}

func currentAuditMeta(c *gin.Context) service.AuditMeta {
	meta := service.AuditMeta{
		RequestIP: c.ClientIP(),
	}
	if userID := currentUserID(c); userID != nil {
		meta.AdminUserID = userID
	}
	return meta
}

func (h *Handler) auditMeta(c *gin.Context) service.AuditMeta {
	return currentAuditMeta(c)
}
