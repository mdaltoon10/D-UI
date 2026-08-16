// Package middleware provides HTTP middleware functions for the d-ui web panel,
// including domain validation utilities.
package middleware

import (
	"net"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mdaltoon10/D-UI/v3/internal/logger"
)

// DomainValidatorMiddleware returns a Gin middleware that validates the request domain.
// It extracts the host from the request, strips any port number, and compares it
// against the configured domain. Requests from unauthorized domains are rejected
// with HTTP 403 Forbidden status.
func DomainValidatorMiddleware(domain string) gin.HandlerFunc {
	return func(c *gin.Context) {
		host := c.Request.Host
		if colonIndex := strings.LastIndex(host, ":"); colonIndex != -1 {
			var err error
			host, _, err = net.SplitHostPort(c.Request.Host)
			if err != nil {
				logger.Warningf("DomainValidatorMiddleware: SplitHostPort failed for %s: %s", c.Request.Host, err.Error())
			}
		}

		if host != domain {
			// If the user is accessing directly via IP, allow it as a fallback / direct access.
			if ip := net.ParseIP(host); ip != nil {
				c.Next()
				return
			}
			logger.Warningf("DomainValidatorMiddleware: Host mismatch. Host: %q, Configured Domain: %q. Request rejected.", host, domain)
			c.AbortWithStatus(http.StatusForbidden)
			return
		}

		c.Next()
	}
}
