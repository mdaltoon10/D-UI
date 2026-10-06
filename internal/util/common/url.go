package common

import (
	"fmt"
	"net/url"
	"strings"
)

// EnsureURLScheme prepends https:// to a URL that carries no scheme, so
// subscription apps and browsers don't resolve it relative to the panel's own
// domain (e.g. "t.me/support" turning into "https://panel.example/t.me/support").
// Values with an explicit scheme (https://, tg://, mailto:, tel:) and empty
// strings pass through untouched.
func EnsureURLScheme(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if strings.Contains(trimmed, "://") ||
		strings.HasPrefix(trimmed, "mailto:") ||
		strings.HasPrefix(trimmed, "tel:") {
		return trimmed
	}
	return "https://" + trimmed
}

// ParseRemoteRoutingURL checks if a raw string is a remote routing URL (https:// or http://).
// If it is, it returns the trimmed URL, remote=true, and nil error (or parse error if malformed).
// If it is not a remote URL (e.g. inline YAML/JSON string or empty), it returns raw, remote=false, nil error.
func ParseRemoteRoutingURL(raw string) (string, bool, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", false, nil
	}
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		u, err := url.Parse(trimmed)
		if err != nil {
			return "", true, err
		}
		if u.Scheme != "http" && u.Scheme != "https" {
			return "", false, nil
		}
		if u.Host == "" {
			return "", true, fmt.Errorf("invalid remote routing URL: missing host")
		}
		return u.String(), true, nil
	}
	if strings.HasPrefix(trimmed, "http:") || strings.HasPrefix(trimmed, "https:") {
		_, err := url.Parse(trimmed)
		return "", true, err
	}
	return trimmed, false, nil
}
