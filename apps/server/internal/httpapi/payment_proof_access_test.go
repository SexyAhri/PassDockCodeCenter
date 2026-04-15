package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"passdock/server/internal/config"
	"passdock/server/internal/database"
	"passdock/server/internal/model"
	"passdock/server/internal/service"
)

func TestPaymentProofObjectAccessRoutesRequireScopedAuthorization(t *testing.T) {
	router, svc, db, cfg := newPaymentProofAccessTestRouter(t)
	ctx := context.Background()

	var price model.ProductPrice
	if err := db.WithContext(ctx).
		Where("payment_method = ? AND enabled = ?", "wechat_qr", true).
		Order("sort_order ASC, id ASC").
		First(&price).Error; err != nil {
		t.Fatalf("load product price returned error: %v", err)
	}

	orderData, err := svc.CreateOrder(ctx, service.CreateOrderInput{
		ProductID:     price.ProductID,
		PriceID:       strconv.FormatUint(uint64(price.ID), 10),
		PaymentMethod: "wechat_qr",
		SourceChannel: "web",
		BuyerRef:      "web:proof-access",
		Quantity:      1,
		Currency:      price.Currency,
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(orderData["order_no"])
	orderAccessToken := stringValue(orderData["order_access_token"])
	if orderNo == "" || orderAccessToken == "" {
		t.Fatalf("expected created order to include order_no and order_access_token")
	}

	saved, err := svc.SaveUploadedBytes(ctx, service.SaveUploadedBytesInput{
		Namespace:    filepath.ToSlash(filepath.Join("payment-proofs", "orders", orderNo)),
		OriginalName: "proof.png",
		ContentType:  "image/png",
		Data:         tinyPNGBytes(),
	})
	if err != nil {
		t.Fatalf("SaveUploadedBytes returned error: %v", err)
	}

	if err := svc.UploadPublicPaymentProof(ctx, orderNo, service.StorefrontOrderAccessInput{
		OrderAccessToken: orderAccessToken,
	}, service.UploadPaymentProofInput{
		ProofType: "screenshot",
		ObjectKey: stringValue(saved["object_key"]),
		ObjectURL: stringValue(saved["object_url"]),
		Note:      "test proof",
	}); err != nil {
		t.Fatalf("UploadPublicPaymentProof returned error: %v", err)
	}

	storefrontResponse := performJSONRequest(
		t,
		router,
		http.MethodGet,
		"/api/v1/orders/"+orderNo,
		map[string]string{
			storefrontOrderAccessHeader: orderAccessToken,
		},
	)
	if storefrontResponse.Code != http.StatusOK {
		t.Fatalf("expected storefront order detail 200, got %d: %s", storefrontResponse.Code, storefrontResponse.Body.String())
	}

	storefrontData := decodeAPIData(t, storefrontResponse)
	proofs, ok := storefrontData["payment_proofs"].([]any)
	if !ok || len(proofs) != 1 {
		t.Fatalf("expected one payment proof in storefront response, got %#v", storefrontData["payment_proofs"])
	}

	storefrontProof := proofs[0].(map[string]any)
	proofID := stringValue(storefrontProof["proof_id"])
	storefrontProofURL := stringValue(storefrontProof["object_url"])
	if !strings.Contains(storefrontProofURL, "/api/v1/orders/"+orderNo+"/payment-proofs/"+proofID+"/file") {
		t.Fatalf("expected storefront proof url to use guarded route, got %q", storefrontProofURL)
	}
	if !strings.Contains(storefrontProofURL, "access_token=") {
		t.Fatalf("expected storefront proof url to embed access token, got %q", storefrontProofURL)
	}

	publicRawProofURL := stringValue(saved["object_url"])
	publicRawProofRequestPath := mustRequestURI(t, publicRawProofURL)
	rawProofResponse := performJSONRequest(t, router, http.MethodGet, publicRawProofRequestPath, nil)
	if rawProofResponse.Code != http.StatusNotFound {
		t.Fatalf("expected raw proof object url to be blocked with 404, got %d", rawProofResponse.Code)
	}

	storefrontProofRequestPath := mustRequestURI(t, storefrontProofURL)
	authorizedProofResponse := performJSONRequest(t, router, http.MethodGet, storefrontProofRequestPath, nil)
	if authorizedProofResponse.Code != http.StatusOK {
		t.Fatalf("expected storefront guarded proof fetch 200, got %d: %s", authorizedProofResponse.Code, authorizedProofResponse.Body.String())
	}
	if string(authorizedProofResponse.Body.Bytes()) != string(tinyPNGBytes()) {
		t.Fatalf("expected storefront proof payload to match uploaded file")
	}

	wrongTokenPath := strings.Replace(storefrontProofRequestPath, orderAccessToken, "wrong-token", 1)
	wrongTokenResponse := performJSONRequest(t, router, http.MethodGet, wrongTokenPath, nil)
	if wrongTokenResponse.Code != http.StatusNotFound {
		t.Fatalf("expected wrong storefront proof token to return 404, got %d", wrongTokenResponse.Code)
	}

	adminProofDetailResponse := performJSONRequest(
		t,
		router,
		http.MethodGet,
		"/api/v1/admin/payment-proofs/"+proofID,
		map[string]string{
			"Authorization": "Bearer " + cfg.AdminBearerToken,
		},
	)
	if adminProofDetailResponse.Code != http.StatusOK {
		t.Fatalf("expected admin proof detail 200, got %d: %s", adminProofDetailResponse.Code, adminProofDetailResponse.Body.String())
	}

	adminProofData := decodeAPIData(t, adminProofDetailResponse)
	adminProofURL := stringValue(adminProofData["object_url"])
	expectedAdminPath := "/api/v1/admin/payment-proofs/" + proofID + "/file"
	if adminProofURL != expectedAdminPath {
		t.Fatalf("expected admin proof url %q, got %q", expectedAdminPath, adminProofURL)
	}

	adminProofResponse := performJSONRequest(
		t,
		router,
		http.MethodGet,
		expectedAdminPath,
		map[string]string{
			"Authorization": "Bearer " + cfg.AdminBearerToken,
		},
	)
	if adminProofResponse.Code != http.StatusOK {
		t.Fatalf("expected admin proof fetch 200, got %d: %s", adminProofResponse.Code, adminProofResponse.Body.String())
	}
	if string(adminProofResponse.Body.Bytes()) != string(tinyPNGBytes()) {
		t.Fatalf("expected admin proof payload to match uploaded file")
	}
}

func newPaymentProofAccessTestRouter(t *testing.T) (*gin.Engine, *service.Service, *gorm.DB, config.Config) {
	t.Helper()

	cfg := config.Config{
		AppEnv:              "test",
		AppBaseURL:          "",
		DBDriver:            "sqlite",
		SQLitePath:          filepath.Join(t.TempDir(), "passdock-test.db"),
		SessionSecret:       "test-session-secret",
		InternalSignKey:     "passdock-system",
		InternalSignSecret:  "test-internal-secret",
		StorageType:         "local",
		StorageLocalPath:    filepath.Join(t.TempDir(), "storage"),
		StoragePublicPath:   "/uploads",
		UploadMaxFileSizeMB: 8,
		CORSAllowOrigins:    []string{"*"},
		AdminBearerToken:    "admin-token",
		TelegramBotKey:      "default",
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
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	return NewRouter(cfg, svc), svc, db, cfg
}

func performJSONRequest(
	t *testing.T,
	router http.Handler,
	method string,
	requestPath string,
	headers map[string]string,
) *httptest.ResponseRecorder {
	t.Helper()

	request := httptest.NewRequest(method, requestPath, nil)
	for key, value := range headers {
		request.Header.Set(key, value)
	}

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	return recorder
}

func decodeAPIData(t *testing.T, response *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var envelope struct {
		Success bool           `json:"success"`
		Message string         `json:"message"`
		Data    map[string]any `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response returned error: %v", err)
	}

	return envelope.Data
}

func mustRequestURI(t *testing.T, rawURL string) string {
	t.Helper()

	parsed, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("parse url returned error: %v", err)
	}
	if parsed.RequestURI() == "" {
		t.Fatalf("expected request uri for %q", rawURL)
	}

	return parsed.RequestURI()
}

func tinyPNGBytes() []byte {
	return []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
		0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
		0x54, 0x78, 0x9c, 0x63, 0xf8, 0xff, 0xff, 0x3f,
		0x00, 0x05, 0xfe, 0x02, 0xfe, 0xa7, 0x35, 0x81,
		0x84, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
		0x44, 0xae, 0x42, 0x60, 0x82,
	}
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}

	return strings.TrimSpace(fmt.Sprintf("%v", value))
}
