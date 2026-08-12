package sub

import (
	"reflect"
	"strings"
	"testing"
)

func TestSubscriptionProfileCapabilityMatrix(t *testing.T) {
	profile := map[string]any{
		"network":  "ws",
		"security": "tls",
		"sockopt":  map[string]any{"tcpFastOpen": true},
		"mux":      map[string]any{"enabled": true},
	}
	stream := map[string]any{
		"network":  "ws",
		"security": "tls",
		"wsSettings": map[string]any{
			"path":            "/ws",
			"host":            "example.com",
			"heartbeatPeriod": float64(15),
			"headers": map[string]any{
				"Host":         "example.com",
				"X-Profile":    "present",
				"X-Empty-Okay": "",
			},
		},
	}

	if got := subscriptionProfileCapabilityCodes(profile, stream, subscriptionFormatJSON); len(got) != 0 {
		t.Fatalf("JSON capability codes = %v, want none", got)
	}

	wantRaw := []string{
		capabilityClientSockopt,
		capabilityProfileMux,
		capabilityCustomHeaders,
		capabilityWebSocketHeartbeat,
	}
	if got := subscriptionProfileCapabilityCodes(profile, stream, subscriptionFormatRaw); !reflect.DeepEqual(got, wantRaw) {
		t.Fatalf("raw capability codes = %v, want %v", got, wantRaw)
	}

	wantClash := []string{
		capabilityClientSockopt,
		capabilityProfileMux,
		capabilityCustomHeaders,
		capabilityWebSocketHeartbeat,
	}
	if got := subscriptionProfileCapabilityCodes(profile, stream, subscriptionFormatClash); !reflect.DeepEqual(got, wantClash) {
		t.Fatalf("clash capability codes = %v, want %v", got, wantClash)
	}
}

func TestSubscriptionProfileCapabilityClashSecurityBoundaries(t *testing.T) {
	profile := map[string]any{
		"network":   "xhttp",
		"security":  "reality",
		"finalmask": map[string]any{"tcp": []any{map[string]any{"type": "fragment"}}},
	}
	stream := map[string]any{
		"network":  "xhttp",
		"security": "reality",
		"xhttpSettings": map[string]any{
			"path": "/",
			"mode": "auto",
		},
		"realitySettings": map[string]any{
			"settings": map[string]any{
				"publicKey":     "public",
				"mldsa65Verify": "verify-secret",
				"spiderX":       "/custom-spider",
			},
		},
	}

	want := []string{
		capabilityFinalMask,
		capabilityRealityMLDSA,
		capabilityRealitySpiderX,
	}
	got := subscriptionProfileCapabilityCodes(profile, stream, subscriptionFormatClash)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("capability codes = %v, want %v", got, want)
	}
	joined := strings.Join(got, "|")
	for _, secret := range []string{"verify-secret", "/custom-spider", "public"} {
		if strings.Contains(joined, secret) {
			t.Fatalf("capability output leaked value %q: %q", secret, joined)
		}
	}
}

func TestSubscriptionProfileCapabilityTLSMultiplePinsOnlyBlocksClash(t *testing.T) {
	profile := map[string]any{"network": "ws", "security": "tls"}
	stream := map[string]any{
		"network":  "ws",
		"security": "tls",
		"wsSettings": map[string]any{
			"path": "/",
		},
		"tlsSettings": map[string]any{
			"settings": map[string]any{
				"pinnedPeerCertSha256": []any{"pin-one", "pin-two"},
			},
		},
	}

	if got := subscriptionProfileCapabilityCodes(profile, stream, subscriptionFormatRaw); len(got) != 0 {
		t.Fatalf("raw unexpectedly rejected multiple pins: %v", got)
	}
	if got := subscriptionProfileCapabilityCodes(profile, stream, subscriptionFormatJSON); len(got) != 0 {
		t.Fatalf("JSON unexpectedly rejected multiple pins: %v", got)
	}
	if got := subscriptionProfileCapabilityCodes(profile, stream, subscriptionFormatClash); !reflect.DeepEqual(got, []string{capabilityMultipleTLSPins}) {
		t.Fatalf("Clash codes = %v", got)
	}
}

func TestSubscriptionProfileCapabilityRawTCPHTTPAdvancedFields(t *testing.T) {
	profile := map[string]any{"network": "tcp", "security": "none"}
	stream := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{
				"type": "http",
				"request": map[string]any{
					"version": "1.1",
					"method":  "POST",
					"path":    []any{"/one", "/two"},
					"headers": map[string]any{"Host": []any{"example.com"}},
				},
			},
		},
	}

	if got := subscriptionProfileCapabilityCodes(profile, stream, subscriptionFormatRaw); !reflect.DeepEqual(got, []string{capabilityTCPHTTPAdvanced}) {
		t.Fatalf("raw codes = %v", got)
	}
	if got := subscriptionProfileCapabilityCodes(profile, stream, subscriptionFormatClash); !reflect.DeepEqual(got, []string{capabilityTransport}) {
		t.Fatalf("clash codes = %v", got)
	}
}

func TestSubscriptionProfileCapabilityClashHysteriaFinalMask(t *testing.T) {
	profile := map[string]any{
		"network":  "hysteria",
		"security": "tls",
		"finalmask": map[string]any{
			"udp": []any{map[string]any{
				"type": "salamander",
				"settings": map[string]any{
					"password": "secret-value",
				},
			}},
		},
	}
	stream := map[string]any{
		"network":  "hysteria",
		"security": "tls",
	}

	if got := subscriptionProfileCapabilityCodes(profile, stream, subscriptionFormatClash); len(got) != 0 {
		t.Fatalf("supported Hysteria FinalMask codes = %v, want none", got)
	}

	profile["finalmask"] = map[string]any{
		"quicParams": map[string]any{
			"udpHop": map[string]any{
				"ports":    "20000-30000",
				"interval": "5-10",
			},
		},
	}
	if got := subscriptionProfileCapabilityCodes(profile, stream, subscriptionFormatClash); !reflect.DeepEqual(got, []string{capabilityFinalMask}) {
		t.Fatalf("unsupported Hysteria FinalMask codes = %v", got)
	}
}
