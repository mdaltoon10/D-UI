package service

import (
	"strings"
	"testing"
)

func TestCompileRuntimeProfileInboundsRunsSemanticValidation(t *testing.T) {
	parent := runtimeProfileTestParent()
	secretMarker := "DO-NOT-ECHO-HEADER-MARKER"
	raw := map[string]any{
		"network":  "tcp",
		"security": "none",
		"externalProxy": []any{map[string]any{
			"enabled":  true,
			"port":     float64(2087),
			"network":  "ws",
			"security": "none",
			"wsSettings": map[string]any{
				"path":    "/semantic-validation",
				"headers": map[string]any{"X-Test": "ok\r\n" + secretMarker},
			},
			"runtime": map[string]any{
				"enabled": true,
				"id":      "semantic-validation",
				"mode":    "direct",
			},
		}},
	}

	_, err := compileRuntimeProfileInbounds(parent, raw)
	if err == nil {
		t.Fatal("unsafe profile unexpectedly compiled")
	}
	if !strings.Contains(err.Error(), "semantic validation failed") ||
		!strings.Contains(err.Error(), "header") {
		t.Fatalf("unexpected validation error: %v", err)
	}
	if strings.Contains(err.Error(), secretMarker) {
		t.Fatalf("validation error leaked a user value: %v", err)
	}
}

func TestCompileRuntimeProfileInboundsAllowsDisabledDraft(t *testing.T) {
	parent := runtimeProfileTestParent()
	raw := map[string]any{
		"network":  "tcp",
		"security": "none",
		"externalProxy": []any{map[string]any{
			"enabled":       false,
			"port":          "unfinished",
			"network":       "future-transport",
			"security":      "future-security",
			"xhttpSettings": "unfinished",
			"runtime": map[string]any{
				"enabled": true,
				"id":      "draft",
				"mode":    "future-mode",
			},
		}},
	}

	got, err := compileRuntimeProfileInbounds(parent, raw)
	if err != nil {
		t.Fatalf("disabled draft rejected during compilation: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("disabled draft unexpectedly compiled: %#v", got)
	}
}

func TestCompileRuntimeProfileInboundsIgnoresInactiveTransportDraft(t *testing.T) {
	parent := runtimeProfileTestParent()
	raw := map[string]any{
		"network":  "tcp",
		"security": "none",
		"externalProxy": []any{map[string]any{
			"enabled":       true,
			"port":          float64(2088),
			"network":       "grpc",
			"security":      "none",
			"grpcSettings":  map[string]any{"serviceName": "active"},
			"xhttpSettings": "inactive-draft",
			"tlsSettings":   "inactive-draft",
			"runtime": map[string]any{
				"enabled": true,
				"id":      "active-grpc-with-drafts",
				"mode":    "direct",
			},
		}},
	}

	got, err := compileRuntimeProfileInbounds(parent, raw)
	if err != nil {
		t.Fatalf("inactive transport/security draft rejected: %v", err)
	}
	if len(got) != 1 || got[0].Port != 2088 {
		t.Fatalf("unexpected compiled runtime profile: %#v", got)
	}
}
