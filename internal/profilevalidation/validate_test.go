package profilevalidation

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"errors"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestValidateStreamSettingsAcceptsCompleteProfiles(t *testing.T) {
	stream := map[string]any{
		"network":  "tcp",
		"security": "none",
		"externalProxy": []any{
			map[string]any{
				"enabled":  true,
				"dest":     "edge.example.com",
				"port":     443,
				"network":  "xhttp",
				"security": "reality",
				"xhttpSettings": map[string]any{
					"path":                 "/connect",
					"mode":                 "packet-up",
					"scMaxEachPostBytes":   "500000-1000000",
					"scMaxBufferedPosts":   30,
					"scMinPostsIntervalMs": "50-150",
					"xPaddingBytes":        "100-1000",
					"sessionIDPlacement":   "header",
					"sessionIDKey":         "X-Session",
					"sessionIDTable":       "Base62",
					"sessionIDLength":      "8-16",
					"xPaddingObfsMode":     false,
					"xPaddingPlacement":    "stale-invalid",
					"seqPlacement":         "query",
					"seqKey":               "seq",
					"uplinkDataPlacement":  "body",
					"uplinkHTTPMethod":     "POST",
					"headers":              map[string]any{"User-Agent": "Mozilla/5.0"},
					"xmux": map[string]any{
						"maxConcurrency":   "16-32",
						"maxConnections":   0,
						"cMaxReuseTimes":   0,
						"hMaxRequestTimes": "600-900",
					},
				},
				"realitySettings": map[string]any{
					"serverNames": []any{"www.example.com"},
					"shortIds":    []any{"aabb"},
					"settings": map[string]any{
						"publicKey":   "public-material",
						"fingerprint": "chrome",
						"serverName":  "www.example.com",
						"shortId":     "aabb",
						"spiderX":     "/",
					},
				},
				"sockopt": map[string]any{
					"domainStrategy": "AsIs",
					"tcpFastOpen":    true,
					"customSockopt": []any{map[string]any{
						"system": "linux", "type": "int", "level": "6", "opt": "1", "value": 1,
					}},
				},
				"finalmask": map[string]any{
					"udp": []any{map[string]any{"type": "noise"}},
					"quicParams": map[string]any{
						"congestion":              "bbr",
						"initStreamReceiveWindow": 16384,
						"maxStreamReceiveWindow":  32768,
						"udpHop":                  map[string]any{"ports": "20000-50000", "interval": "5-10"},
					},
				},
				"runtime": map[string]any{
					"enabled": true,
					"id":      "edge-reality",
					"mode":    "direct",
					"listen":  "127.0.0.1",
					"port":    24443,
					"realitySettings": map[string]any{
						"target":      "www.example.com:443",
						"serverNames": []any{"www.example.com"},
						"shortIds":    []any{"aabb"},
						"privateKey":  "private-material",
						"xver":        0,
					},
					"sockopt": map[string]any{
						"acceptProxyProtocol":  true,
						"trustedXForwardedFor": []any{"173.245.48.0/20"},
					},
				},
			},
		},
	}
	encoded, err := json.Marshal(stream)
	if err != nil {
		t.Fatal(err)
	}
	if err := ValidateStreamSettings(string(encoded), Options{Protocol: "vless"}); err != nil {
		t.Fatalf("valid profile rejected: %v", err)
	}
}

func TestValidateStreamSettingsRejectsUnsafeHeaderWithoutEchoingValue(t *testing.T) {
	secret := "SECRET-MARKER"
	err := ValidateStreamMap(map[string]any{
		"externalProxy": []any{map[string]any{
			"network": "ws",
			"wsSettings": map[string]any{
				"path":    "/",
				"headers": map[string]any{"X-Test": "ok\r\n" + secret},
			},
		}},
	}, Options{})
	assertValidationCode(t, err, "unsafe_header")
	if strings.Contains(err.Error(), secret) {
		t.Fatalf("validation error leaked a user value: %v", err)
	}
}

func TestValidateStreamSettingsHeaderControlPolicy(t *testing.T) {
	t.Run("rejects non-line C0 control", func(t *testing.T) {
		err := ValidateStreamMap(map[string]any{
			"externalProxy": []any{map[string]any{
				"network": "ws",
				"wsSettings": map[string]any{
					"path":    "/",
					"headers": map[string]any{"X-Test": "value\x01marker"},
				},
			}},
		}, Options{})
		assertValidationCode(t, err, "unsafe_header")
	})

	t.Run("allows horizontal tab", func(t *testing.T) {
		err := ValidateStreamMap(map[string]any{
			"externalProxy": []any{map[string]any{
				"network": "ws",
				"wsSettings": map[string]any{
					"path":    "/",
					"headers": map[string]any{"X-Test": "value\tcontinuation"},
				},
			}},
		}, Options{})
		if err != nil {
			t.Fatalf("valid horizontal tab rejected: %v", err)
		}
	})
}

func TestValidateStreamSettingsRejectsXHTTPModeAndPlacementErrors(t *testing.T) {
	tests := []struct {
		name  string
		xhttp map[string]any
		code  string
	}{
		{"unknown mode", map[string]any{"mode": "unknown", "path": "/"}, "invalid_enum"},
		{"missing placement key", map[string]any{"mode": "packet-up", "path": "/", "sessionIDPlacement": "header"}, "missing_dependency"},
		{"xmux conflict", map[string]any{"mode": "auto", "path": "/", "xmux": map[string]any{"maxConcurrency": "16-32", "maxConnections": 6}}, "mutually_exclusive"},
		{"bad session room", map[string]any{"mode": "auto", "path": "/", "sessionIDTable": "ab", "sessionIDLength": "1-2"}, "insufficient_space"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
				"network": "xhttp", "xhttpSettings": test.xhttp,
			}}}, Options{})
			assertValidationCode(t, err, test.code)
		})
	}
}

func TestValidateStreamSettingsBoundsSessionRoomComputation(t *testing.T) {
	err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"network": "xhttp",
		"xhttpSettings": map[string]any{
			"mode":            "auto",
			"path":            "/",
			"sessionIDTable":  "ab",
			"sessionIDLength": "2147483647",
		},
	}}}, Options{})
	if err != nil {
		t.Fatalf("large valid session range rejected: %v", err)
	}
}

func TestValidateStreamSettingsAllowsInactiveXHTTPModeFields(t *testing.T) {
	err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"network": "xhttp",
		"xhttpSettings": map[string]any{
			"mode":                 "stream-one",
			"path":                 "/",
			"uplinkHTTPMethod":     "GET",
			"scMaxEachPostBytes":   "stale-invalid",
			"scMaxBufferedPosts":   "stale-invalid",
			"scMinPostsIntervalMs": "stale-invalid",
			"uplinkDataPlacement":  "stale-invalid",
			"sessionIDPlacement":   "header",
			"sessionIDKey":         "X-Session",
			"sessionIDLength":      "8-16",
		},
	}}}, Options{})
	if err != nil {
		t.Fatalf("stale inactive XHTTP fields rejected: %v", err)
	}
}

func TestValidateStreamSettingsAcceptsTrustedClientIPHeader(t *testing.T) {
	err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"runtime": map[string]any{
			"enabled": true,
			"id":      "trusted-header",
			"mode":    "direct",
			"sockopt": map[string]any{
				"trustedXForwardedFor": []any{"CF-Connecting-IP"},
			},
		},
	}}}, Options{Protocol: "vless"})
	if err != nil {
		t.Fatalf("trusted client-IP header rejected: %v", err)
	}
}

func TestValidateStreamSettingsRejectsTLSVersionOrder(t *testing.T) {
	err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"security": "tls",
		"runtime": map[string]any{
			"enabled": true, "id": "tls", "mode": "direct",
			"tlsSettings": map[string]any{
				"minVersion": "1.3", "maxVersion": "1.2",
				"certificates": []any{},
			},
		},
	}}}, Options{Protocol: "vless"})
	assertValidationCode(t, err, "version_order")
}

func TestValidateStreamSettingsValidatesInlineCertificatePair(t *testing.T) {
	certPEM, keyPEM := testCertificate(t)
	valid := map[string]any{"externalProxy": []any{map[string]any{
		"security": "tls",
		"runtime": map[string]any{
			"enabled": true, "id": "tls", "mode": "direct",
			"tlsSettings": map[string]any{
				"minVersion": "1.2", "maxVersion": "1.3",
				"certificates": []any{map[string]any{
					"certificate": strings.Split(strings.TrimSuffix(string(certPEM), "\n"), "\n"),
					"key":         strings.Split(strings.TrimSuffix(string(keyPEM), "\n"), "\n"),
				}},
			},
		},
	}}}
	if err := ValidateStreamMap(valid, Options{Protocol: "vless"}); err != nil {
		t.Fatalf("valid inline certificate rejected: %v", err)
	}
	valid["externalProxy"].([]any)[0].(map[string]any)["runtime"].(map[string]any)["tlsSettings"].(map[string]any)["certificates"].([]any)[0].(map[string]any)["key"] = []any{"not-a-private-key"}
	err := ValidateStreamMap(valid, Options{Protocol: "vless"})
	assertValidationCode(t, err, "certificate_mismatch")
}

func TestValidateStreamSettingsValidatesFileCertificatePairAtSave(t *testing.T) {
	certPEM, keyPEM := testCertificate(t)
	dir := t.TempDir()
	certFile := filepath.Join(dir, "cert.pem")
	keyFile := filepath.Join(dir, "key.pem")
	if err := os.WriteFile(certFile, certPEM, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyFile, keyPEM, 0o600); err != nil {
		t.Fatal(err)
	}
	stream := map[string]any{"externalProxy": []any{map[string]any{
		"security": "tls",
		"runtime": map[string]any{
			"enabled": true, "id": "tls", "mode": "direct",
			"tlsSettings": map[string]any{"certificates": []any{map[string]any{
				"certificateFile": certFile, "keyFile": keyFile,
			}}},
		},
	}}}
	if err := ValidateStreamMap(stream, Options{Protocol: "vless", CheckCertificateFiles: true}); err != nil {
		t.Fatalf("valid file certificate rejected: %v", err)
	}
	stream["externalProxy"].([]any)[0].(map[string]any)["runtime"].(map[string]any)["tlsSettings"].(map[string]any)["certificates"].([]any)[0].(map[string]any)["keyFile"] = filepath.Join(dir, "missing.pem")
	err := ValidateStreamMap(stream, Options{Protocol: "vless", CheckCertificateFiles: true})
	assertValidationCode(t, err, "certificate_unreadable")
}

func TestValidateStreamSettingsRejectsOversizedCertificateFile(t *testing.T) {
	dir := t.TempDir()
	certFile := filepath.Join(dir, "oversized.pem")
	keyFile := filepath.Join(dir, "key.pem")
	file, err := os.Create(certFile)
	if err != nil {
		t.Fatal(err)
	}
	if err := file.Truncate(maxTLSMaterialBytes + 1); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyFile, []byte("not-read-because-certificate-is-too-large"), 0o600); err != nil {
		t.Fatal(err)
	}
	err = ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"security": "tls",
		"runtime": map[string]any{
			"enabled": true, "id": "tls", "mode": "direct",
			"tlsSettings": map[string]any{"certificates": []any{map[string]any{
				"certificateFile": certFile, "keyFile": keyFile,
			}}},
		},
	}}}, Options{Protocol: "vless", CheckCertificateFiles: true})
	assertValidationCode(t, err, "certificate_unreadable")
}

func TestValidateStreamSettingsRejectsRealitySemanticErrors(t *testing.T) {
	tests := []struct {
		name    string
		reality map[string]any
		code    string
	}{
		{"bad target", map[string]any{"target": "https://example.com", "privateKey": "secret", "serverNames": []any{"example.com"}}, "invalid_target"},
		{"missing key", map[string]any{"target": "example.com:443", "serverNames": []any{"example.com"}}, "missing_secret"},
		{"bad short id", map[string]any{"target": "example.com:443", "privateKey": "secret", "serverNames": []any{"example.com"}, "shortIds": []any{"xyz"}}, "invalid_short_id"},
		{"version order", map[string]any{"target": "example.com:443", "privateKey": "secret", "serverNames": []any{"example.com"}, "minClientVer": "2.0", "maxClientVer": "1.9"}, "version_order"},
		{"fallback dependency", map[string]any{"target": "example.com:443", "privateKey": "secret", "serverNames": []any{"example.com"}, "limitFallbackUpload": map[string]any{"bytesPerSec": 0, "burstBytesPerSec": 10}}, "missing_dependency"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
				"security": "reality",
				"runtime": map[string]any{
					"enabled": true, "id": "r", "mode": "direct", "realitySettings": test.reality,
				},
			}}}, Options{Protocol: "vless"})
			assertValidationCode(t, err, test.code)
		})
	}
}

func TestValidateStreamSettingsRejectsOverflowingRealityVersion(t *testing.T) {
	err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"security": "reality",
		"runtime": map[string]any{
			"enabled": true, "id": "r", "mode": "direct",
			"realitySettings": map[string]any{
				"target":       "example.com:443",
				"privateKey":   "secret",
				"serverNames":  []any{"example.com"},
				"minClientVer": "999999999999999999999999999999",
			},
		},
	}}}, Options{Protocol: "vless"})
	assertValidationCode(t, err, "invalid_version")
}

func TestValidateStreamSettingsAllowsStaleRealityPreferredSelection(t *testing.T) {
	err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"security": "reality",
		"realitySettings": map[string]any{
			"serverNames": []any{"a.example.com"},
			"shortIds":    []any{"aabb"},
			"settings":    map[string]any{"serverName": "b.example.com", "shortId": "ffff", "fingerprint": "chrome"},
		},
	}}}, Options{})
	if err != nil {
		t.Fatalf("stale preferred REALITY selection rejected: %v", err)
	}
}

func TestValidateStreamSettingsAllowsClientOnlyTLSWithoutRuntimeContext(t *testing.T) {
	err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"security": "tls",
		"tlsSettings": map[string]any{
			"serverName": "cdn.example.com",
			"alpn":       []any{"h2", "http/1.1"},
		},
	}}}, Options{})
	if err != nil {
		t.Fatalf("client-only TLS profile required runtime server settings: %v", err)
	}
}

func TestValidateStreamSettingsRequiresRealityServerSettingsWhenProtocolKnown(t *testing.T) {
	err := ValidateStreamMap(map[string]any{
		"network":  "tcp",
		"security": "none",
		"externalProxy": []any{map[string]any{
			"security": "reality",
			"runtime":  map[string]any{},
			"realitySettings": map[string]any{
				"serverNames": []any{"a.example.com"},
				"shortIds":    []any{"aabb"},
			},
		}},
	}, Options{Protocol: "vless"})
	assertValidationCode(t, err, "missing_server_settings")
}

func TestValidateStreamSettingsRejectsClientSockoptScopeViolation(t *testing.T) {
	err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"sockopt": map[string]any{"acceptProxyProtocol": true},
	}}}, Options{})
	assertValidationCode(t, err, "scope_violation")
}

func TestValidateStreamSettingsValidatesProxyProtocolConsistency(t *testing.T) {
	t.Run("duplicate transport switch must match", func(t *testing.T) {
		err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
			"network": "ws",
			"wsSettings": map[string]any{
				"path": "/", "acceptProxyProtocol": false,
			},
			"runtime": map[string]any{
				"enabled": true, "id": "proxy-mismatch", "mode": "direct",
				"sockopt": map[string]any{"acceptProxyProtocol": true},
			},
		}}}, Options{Protocol: "vless"})
		assertValidationCode(t, err, "proxy_protocol_mismatch")
	})

	t.Run("mKCP cannot enable proxy protocol", func(t *testing.T) {
		err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
			"network": "kcp",
			"runtime": map[string]any{
				"enabled": true, "id": "kcp-proxy", "mode": "direct",
				"sockopt": map[string]any{"acceptProxyProtocol": true},
			},
		}}}, Options{Protocol: "vless"})
		assertValidationCode(t, err, "transport_incompatible")
	})
}

func TestValidateStreamSettingsRejectsCustomSockoptTypeMismatch(t *testing.T) {
	err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"sockopt": map[string]any{"customSockopt": []any{map[string]any{
			"type": "int", "level": "6", "opt": "1", "value": "not-int",
		}}},
	}}}, Options{})
	assertValidationCode(t, err, "invalid_integer")
}

func TestValidateStreamSettingsRejectsQUICWindowAndHopErrors(t *testing.T) {
	tests := []struct {
		name string
		quic map[string]any
		code string
	}{
		{"window", map[string]any{"initStreamReceiveWindow": 32768, "maxStreamReceiveWindow": 16384}, "window_order"},
		{"ports", map[string]any{"udpHop": map[string]any{"ports": "0-70000", "interval": "5-10"}}, "invalid_range"},
		{"timeout", map[string]any{"maxIdleTimeout": 3}, "invalid_integer"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
				"finalmask": map[string]any{"quicParams": test.quic},
			}}}, Options{})
			assertValidationCode(t, err, test.code)
		})
	}
}

func TestValidateStreamSettingsRejectsRuntimeCapabilityErrors(t *testing.T) {
	tests := []struct {
		name     string
		protocol string
		profile  map[string]any
		code     string
	}{
		{"bad protocol", "wireguard", map[string]any{"runtime": map[string]any{"enabled": false, "id": "x", "mode": "manual"}}, "protocol_incompatible"},
		{"flow protocol", "vmess", map[string]any{"flow": "xtls-rprx-vision"}, "protocol_incompatible"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateStreamMap(map[string]any{"externalProxy": []any{test.profile}}, Options{Protocol: test.protocol})
			assertValidationCode(t, err, test.code)
		})
	}
}

func TestValidateStreamSettingsAllowsInactiveDrafts(t *testing.T) {
	t.Run("obsolete runtime topology controls", func(t *testing.T) {
		err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
			"network": "ws",
			"runtime": map[string]any{
				"enabled":         false,
				"mode":            "future-mode",
				"port":            "unfinished",
				"tlsSettings":     "unfinished",
				"realitySettings": []any{"unfinished"},
			},
		}}}, Options{Protocol: "vless", CheckCertificateFiles: true})
		if err != nil {
			t.Fatalf("obsolete runtime topology metadata was not ignored: %v", err)
		}
	})

	t.Run("disabled profile", func(t *testing.T) {
		err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
			"enabled":       false,
			"port":          0,
			"network":       "future-transport",
			"security":      "future-security",
			"xhttpSettings": "unfinished",
		}}}, Options{Protocol: "vless", CheckCertificateFiles: true})
		if err != nil {
			t.Fatalf("disabled profile draft rejected: %v", err)
		}
	})

	t.Run("inactive transport and security objects", func(t *testing.T) {
		err := ValidateStreamMap(map[string]any{
			"network":  "ws",
			"security": "none",
			"externalProxy": []any{map[string]any{
				"network":         "ws",
				"security":        "none",
				"wsSettings":      map[string]any{"path": "/active"},
				"xhttpSettings":   "inactive-draft",
				"tlsSettings":     "inactive-draft",
				"realitySettings": []any{"inactive-draft"},
			}},
		}, Options{Protocol: "vless"})
		if err != nil {
			t.Fatalf("inactive transport/security drafts rejected: %v", err)
		}
	})
}

func TestValidateStreamSettingsMarkerlessStructuredTLSRemainsSubscriptionOnly(t *testing.T) {
	err := ValidateStreamMap(map[string]any{
		"network":  "tcp",
		"security": "none",
		"externalProxy": []any{map[string]any{
			"network":  "ws",
			"security": "tls",
		}},
	}, Options{Protocol: "vless"})
	if err != nil {
		t.Fatalf("markerless structured subscription profile required server runtime settings: %v", err)
	}
}

func TestValidateStreamSettingsRuntimeEnabledFalseCannotBypassServerValidation(t *testing.T) {
	err := ValidateStreamMap(map[string]any{
		"network":  "tcp",
		"security": "none",
		"externalProxy": []any{map[string]any{
			"network":  "ws",
			"security": "tls",
			"runtime":  map[string]any{"enabled": false},
		}},
	}, Options{Protocol: "vless"})
	assertValidationCode(t, err, "missing_server_settings")
}

func TestValidateStreamSettingsIgnoresObsoleteRuntimeTopologyValues(t *testing.T) {
	err := ValidateStreamMap(map[string]any{
		"network": "tcp",
		"externalProxy": []any{map[string]any{
			"network": "grpc",
			"runtime": map[string]any{
				"enabled": "not-a-bool",
				"mode":    "manual",
				"listen":  map[string]any{"stale": true},
				"port":    "unfinished",
			},
		}},
	}, Options{Protocol: "vless"})
	if err != nil {
		t.Fatalf("obsolete topology fields affected validation: %v", err)
	}
}

func TestValidateStreamSettingsLegacyCompatibility(t *testing.T) {
	err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"dest": "cdn.example.com", "port": 443, "forceTls": "tls", "sni": "sni.example.com",
	}}}, Options{})
	if err != nil {
		t.Fatalf("legacy profile rejected: %v", err)
	}
}

func TestValidationErrorDoesNotLeakSecrets(t *testing.T) {
	secret := "DO-NOT-LEAK-PRIVATE-KEY"
	err := ValidateStreamMap(map[string]any{"externalProxy": []any{map[string]any{
		"security": "reality",
		"runtime": map[string]any{
			"enabled": true, "id": "r", "mode": "direct",
			"realitySettings": map[string]any{
				"target": "invalid", "privateKey": secret, "serverNames": []any{"example.com"},
			},
		},
	}}}, Options{Protocol: "vless"})
	if err == nil {
		t.Fatal("expected validation error")
	}
	if strings.Contains(err.Error(), secret) {
		t.Fatalf("secret leaked in error: %v", err)
	}
}

func assertValidationCode(t *testing.T, err error, code string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected validation code %q, got nil", code)
	}
	var validationError *ValidationError
	if !errors.As(err, &validationError) {
		t.Fatalf("error type = %T, want *ValidationError: %v", err, err)
	}
	if validationError.Code != code {
		t.Fatalf("validation code = %q, want %q; error=%v", validationError.Code, code, err)
	}
}

func testCertificate(t *testing.T) ([]byte, []byte) {
	t.Helper()
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "example.com"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:     []string{"example.com"},
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &privateKey.PublicKey, privateKey)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		t.Fatal(err)
	}
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}),
		pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})
}

func TestValidateStreamSettingsAllowsHysteriaRuntimeAlias(t *testing.T) {
	err := ValidateStreamMap(map[string]any{
		"network":  "hysteria",
		"security": "tls",
		"externalProxy": []any{map[string]any{
			"network":  "same",
			"security": "same",
			"runtime":  map[string]any{"enabled": true, "id": "hy-alias"},
		}},
	}, Options{Protocol: "hysteria"})
	if err != nil {
		t.Fatal(err)
	}
}

func TestValidateStreamSettingsRejectsHysteriaRuntimeTransportOverride(t *testing.T) {
	err := ValidateStreamMap(map[string]any{
		"network":  "hysteria",
		"security": "tls",
		"externalProxy": []any{map[string]any{
			"network": "kcp",
			"runtime": map[string]any{"enabled": true, "id": "invalid-hy-kcp"},
		}},
	}, Options{Protocol: "hysteria"})
	assertValidationCode(t, err, "protocol_incompatible")
}
