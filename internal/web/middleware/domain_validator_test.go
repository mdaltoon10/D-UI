package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestDomainValidatorMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		configDomain   string
		requestHost    string
		forwardedHost string
		wantCode       int
	}{
		{
			name:         "exact match",
			configDomain: "panel.example.com",
			requestHost:  "panel.example.com",
			wantCode:     http.StatusOK,
		},
		{
			name:         "config domain has scheme and trailing slash",
			configDomain: "https://panel.example.com/",
			requestHost:  "panel.example.com",
			wantCode:     http.StatusOK,
		},
		{
			name:         "config domain has port",
			configDomain: "panel.example.com:2053",
			requestHost:  "panel.example.com:2053",
			wantCode:     http.StatusOK,
		},
		{
			name:          "forwarded host header match",
			configDomain:  "panel.example.com",
			requestHost:   "127.0.0.1:2053",
			forwardedHost: "panel.example.com",
			wantCode:      http.StatusOK,
		},
		{
			name:         "loopback localhost always allowed",
			configDomain: "panel.example.com",
			requestHost:  "localhost:2053",
			wantCode:     http.StatusOK,
		},
		{
			name:         "direct IP access allowed as fallback",
			configDomain: "panel.example.com",
			requestHost:  "192.168.1.100:2053",
			wantCode:     http.StatusOK,
		},
		{
			name:         "unauthorized domain blocked",
			configDomain: "panel.example.com",
			requestHost:  "evil.example.com",
			wantCode:     http.StatusForbidden,
		},
		{
			name:         "wildcard domain match",
			configDomain: "*.example.com",
			requestHost:  "sub.example.com",
			wantCode:     http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := gin.New()
			r.Use(DomainValidatorMiddleware(tt.configDomain))
			r.GET("/test", func(c *gin.Context) {
				c.String(http.StatusOK, "OK")
			})

			req := httptest.NewRequest("GET", "/test", nil)
			req.Host = tt.requestHost
			if tt.forwardedHost != "" {
				req.Header.Set("X-Forwarded-Host", tt.forwardedHost)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tt.wantCode {
				t.Errorf("DomainValidatorMiddleware(%q) for host %q (X-Forwarded-Host: %q) = %d, want %d",
					tt.configDomain, tt.requestHost, tt.forwardedHost, w.Code, tt.wantCode)
			}
		})
	}
}
