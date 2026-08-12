package sub

import "testing"

func TestExpandSubscriptionEndpoints_DefaultWhenProfilesAbsent(t *testing.T) {
	base := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{"type": "none"},
		},
	}

	endpoints := expandSubscriptionEndpoints(base, "node.example.com", 443)
	if len(endpoints) != 1 {
		t.Fatalf("len(endpoints) = %d, want 1", len(endpoints))
	}
	if endpoints[0].Address != "node.example.com" || endpoints[0].Port != 443 {
		t.Fatalf("unexpected default endpoint: %#v", endpoints[0])
	}
	if _, leaked := endpoints[0].Stream["externalProxy"]; leaked {
		t.Fatal("externalProxy must not leak into the effective client stream")
	}
}

func TestExpandSubscriptionEndpoints_BlankAddressInheritsResolvedDefault(t *testing.T) {
	base := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{"type": "none"},
		},
		"externalProxy": []any{
			map[string]any{
				"enabled": true,
				"remark":  "empty",
				"dest":    "",
				"port":    float64(443),
			},
			map[string]any{
				"enabled": true,
				"remark":  "whitespace",
				"dest":    "   ",
				"port":    float64(8443),
			},
			map[string]any{
				"enabled": true,
				"remark":  "override",
				"dest":    "cdn.example.com",
				"port":    float64(9443),
			},
		},
	}

	endpoints := expandSubscriptionEndpoints(base, "resolved-node.example.com", 27543)
	if len(endpoints) != 3 {
		t.Fatalf("len(endpoints) = %d, want 3", len(endpoints))
	}

	wantAddresses := []string{
		"resolved-node.example.com",
		"resolved-node.example.com",
		"cdn.example.com",
	}
	for i, want := range wantAddresses {
		if endpoints[i].Address != want {
			t.Errorf("endpoints[%d].Address = %q, want %q", i, endpoints[i].Address, want)
		}
	}
}

func TestResolveExternalProxyDefaults_InheritsWithoutMutatingSource(t *testing.T) {
	original := map[string]any{
		"dest":     "   ",
		"port":     float64(0),
		"remark":   "inherit",
		"forceTls": "same",
	}
	override := map[string]any{
		"dest":     "  cdn.example.com  ",
		"port":     float64(8443),
		"remark":   "override",
		"forceTls": "same",
	}

	resolved := resolveExternalProxyDefaults(
		[]any{original, override},
		"node7.example.com",
		443,
	)
	if len(resolved) != 2 {
		t.Fatalf("len(resolved) = %d, want 2", len(resolved))
	}

	inherited := resolved[0].(map[string]any)
	explicit := resolved[1].(map[string]any)

	if inherited["dest"] != "node7.example.com" || inherited["port"] != float64(443) {
		t.Fatalf("inherited endpoint = %#v", inherited)
	}
	if explicit["dest"] != "cdn.example.com" || explicit["port"] != float64(8443) {
		t.Fatalf("explicit endpoint = %#v", explicit)
	}

	if original["dest"] != "   " || original["port"] != float64(0) {
		t.Fatalf("source profile was mutated: %#v", original)
	}
	inherited["remark"] = "changed"
	if original["remark"] != "inherit" {
		t.Fatalf("resolved profile aliases source map: %#v", original)
	}
}

func TestExpandSubscriptionEndpoints_FiltersDisabledAndOverridesStream(t *testing.T) {
	base := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{"type": "none"},
		},
		"externalProxy": []any{
			map[string]any{
				"enabled": false,
				"remark":  "disabled",
				"dest":    "disabled.example.com",
				"port":    float64(443),
			},
			map[string]any{
				"enabled":  true,
				"remark":   "ws-tls",
				"dest":     "cdn.example.com",
				"port":     float64(8443),
				"network":  "ws",
				"security": "tls",
				"wsSettings": map[string]any{
					"path":            "/secx",
					"host":            "origin.example.com",
					"headers":         map[string]any{},
					"heartbeatPeriod": float64(0),
				},
				"tlsSettings": map[string]any{
					"serverName": "sni.example.com",
					"alpn":       []any{"h2"},
					"settings": map[string]any{
						"fingerprint":   "chrome",
						"allowInsecure": true,
					},
				},
			},
		},
	}

	endpoints := expandSubscriptionEndpoints(base, "node.example.com", 27543)
	if len(endpoints) != 1 {
		t.Fatalf("len(endpoints) = %d, want 1 active profile", len(endpoints))
	}
	endpoint := endpoints[0]
	if endpoint.Address != "cdn.example.com" || endpoint.Port != 8443 || endpoint.Remark != "ws-tls" {
		t.Fatalf("unexpected endpoint: %#v", endpoint)
	}
	if endpoint.Stream["network"] != "ws" || endpoint.Stream["security"] != "tls" {
		t.Fatalf("effective stream did not apply network/security: %#v", endpoint.Stream)
	}
	if _, stillPresent := endpoint.Stream["tcpSettings"]; stillPresent {
		t.Fatal("old transport settings must be removed when network changes")
	}
	ws, _ := endpoint.Stream["wsSettings"].(map[string]any)
	if ws["path"] != "/secx" || ws["host"] != "origin.example.com" {
		t.Fatalf("unexpected ws settings: %#v", ws)
	}
	tlsSettings, _ := endpoint.Stream["tlsSettings"].(map[string]any)
	if tlsSettings["serverName"] != "sni.example.com" {
		t.Fatalf("unexpected TLS settings: %#v", tlsSettings)
	}
}

func TestExpandSubscriptionEndpoints_AllDisabledMeansNoConfiguration(t *testing.T) {
	base := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{"type": "none"},
		},
		"externalProxy": []any{
			map[string]any{"enabled": false, "dest": "one.example.com", "port": float64(443)},
			map[string]any{"enabled": false, "dest": "two.example.com", "port": float64(8443)},
		},
	}

	if endpoints := expandSubscriptionEndpoints(base, "node.example.com", 443); len(endpoints) != 0 {
		t.Fatalf("len(endpoints) = %d, want 0", len(endpoints))
	}
}

func TestExpandSubscriptionEndpoints_LegacyTLSFieldsRemainCompatible(t *testing.T) {
	base := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{"type": "none"},
		},
		"externalProxy": []any{
			map[string]any{
				"forceTls":    "tls",
				"dest":        "legacy.example.com",
				"port":        float64(443),
				"remark":      "legacy",
				"sni":         "sni.example.com",
				"fingerprint": "firefox",
				"alpn":        []any{"h2", "http/1.1"},
			},
		},
	}

	endpoints := expandSubscriptionEndpoints(base, "node.example.com", 27543)
	if len(endpoints) != 1 {
		t.Fatalf("len(endpoints) = %d, want 1", len(endpoints))
	}
	stream := endpoints[0].Stream
	if stream["security"] != "tls" {
		t.Fatalf("security = %v, want tls", stream["security"])
	}
	tlsSettings, _ := stream["tlsSettings"].(map[string]any)
	if tlsSettings["serverName"] != "sni.example.com" {
		t.Fatalf("serverName = %v, want sni.example.com", tlsSettings["serverName"])
	}
	clientSettings, _ := tlsSettings["settings"].(map[string]any)
	if clientSettings["fingerprint"] != "firefox" {
		t.Fatalf("fingerprint = %v, want firefox", clientSettings["fingerprint"])
	}
}

func TestExpandSubscriptionEndpoints_CarriesPerProfileMuxOverride(t *testing.T) {
	base := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{"type": "none"},
		},
		"externalProxy": []any{
			map[string]any{
				"enabled": true,
				"dest":    "mux.example.com",
				"port":    float64(443),
				"mux": map[string]any{
					"enabled":         true,
					"concurrency":     float64(4),
					"xudpConcurrency": float64(8),
					"xudpProxyUDP443": "allow",
				},
			},
		},
	}

	endpoints := expandSubscriptionEndpoints(base, "node.example.com", 27543)
	if len(endpoints) != 1 || !endpoints[0].HasMuxOverride {
		t.Fatalf("unexpected endpoints/mux override: %#v", endpoints)
	}
	mux, ok := endpoints[0].MuxOverride.(map[string]any)
	if !ok || mux["enabled"] != true || mux["concurrency"] != float64(4) {
		t.Fatalf("unexpected mux override: %#v", endpoints[0].MuxOverride)
	}
}

func TestExpandSubscriptionEndpoints_TwoInboundsWithThreeProfilesProduceSixConfigurations(t *testing.T) {
	makeStream := func(prefix string) map[string]any {
		profiles := make([]any, 0, 3)
		for i := 1; i <= 3; i++ {
			profiles = append(profiles, map[string]any{
				"enabled": true,
				"remark":  prefix + string(rune('0'+i)),
				"dest":    prefix + string(rune('0'+i)) + ".example.com",
				"port":    float64(443),
			})
		}
		return map[string]any{
			"network":       "tcp",
			"security":      "none",
			"tcpSettings":   map[string]any{"header": map[string]any{"type": "none"}},
			"externalProxy": profiles,
		}
	}

	total := 0
	for _, stream := range []map[string]any{makeStream("a"), makeStream("b")} {
		total += len(expandSubscriptionEndpoints(stream, "node.example.com", 27543))
	}
	if total != 6 {
		t.Fatalf("total configurations = %d, want exactly 6", total)
	}
}

func TestEffectiveSubscriptionProfileStream_SNIParity(t *testing.T) {
	base := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{"type": "none"},
		},
	}

	override := effectiveSubscriptionProfileStream(
		base,
		map[string]any{
			"dest":                   "resolved.example.com",
			"security":               "tls",
			"overrideSniFromAddress": true,
			"verifyPeerCertByName":   "verify.example.com",
		},
	)

	overrideTLS, _ := override["tlsSettings"].(map[string]any)
	if overrideTLS["serverName"] != "resolved.example.com" {
		t.Fatalf("override serverName = %v", overrideTLS["serverName"])
	}

	overrideSettings, _ := overrideTLS["settings"].(map[string]any)
	if overrideSettings["verifyPeerCertByName"] != "verify.example.com" {
		t.Fatalf(
			"verifyPeerCertByName = %v",
			overrideSettings["verifyPeerCertByName"],
		)
	}

	blank := effectiveSubscriptionProfileStream(
		base,
		map[string]any{
			"dest":         "edge.example.com",
			"security":     "tls",
			"keepSniBlank": true,
			"tlsSettings": map[string]any{
				"serverName": "must-be-cleared.example.com",
				"settings":   map[string]any{},
			},
		},
	)

	blankTLS, _ := blank["tlsSettings"].(map[string]any)
	if blankTLS["serverName"] != "" {
		t.Fatalf("blank serverName = %v", blankTLS["serverName"])
	}
}

func TestEffectiveSubscriptionProfileStream_ClientSockopt(t *testing.T) {
	base := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{"type": "none"},
		},
	}

	stream := effectiveSubscriptionProfileStream(
		base,
		map[string]any{
			"sockopt": map[string]any{
				"mark":                 float64(27),
				"tcpFastOpen":          true,
				"tcpKeepAliveInterval": float64(15),
				"tcpKeepAliveIdle":     float64(90),
				"tcpMaxSeg":            float64(1400),
				"tcpUserTimeout":       float64(30000),
				"tcpWindowClamp":       float64(65535),
				"tcpcongestion":        "bbr",
				"tproxy":               "off",
				"penetrate":            true,
				"domainStrategy":       "UseIP",
				"customSockopt": []any{map[string]any{
					"system": "linux",
					"level":  "6",
					"opt":    "19",
					"type":   "int",
					"value":  "1",
				}},
				"acceptProxyProtocol":  true,
				"V6Only":               true,
				"trustedXForwardedFor": []any{"127.0.0.1"},
			},
		},
	)

	sockopt, _ := stream["sockopt"].(map[string]any)
	if sockopt["tcpFastOpen"] != true {
		t.Fatalf("tcpFastOpen = %v", sockopt["tcpFastOpen"])
	}
	if sockopt["domainStrategy"] != "UseIP" {
		t.Fatalf("domainStrategy = %v", sockopt["domainStrategy"])
	}
	for key, want := range map[string]any{
		"mark":                 float64(27),
		"tcpKeepAliveInterval": float64(15),
		"tcpKeepAliveIdle":     float64(90),
		"tcpMaxSeg":            float64(1400),
		"tcpUserTimeout":       float64(30000),
		"tcpWindowClamp":       float64(65535),
		"tcpcongestion":        "bbr",
		"tproxy":               "off",
		"penetrate":            true,
	} {
		if sockopt[key] != want {
			t.Fatalf("%s = %#v, want %#v", key, sockopt[key], want)
		}
	}
	custom, _ := sockopt["customSockopt"].([]any)
	if len(custom) != 1 {
		t.Fatalf("customSockopt = %#v", sockopt["customSockopt"])
	}

	for _, key := range []string{
		"acceptProxyProtocol",
		"V6Only",
		"trustedXForwardedFor",
	} {
		if _, exists := sockopt[key]; exists {
			t.Fatalf("listener-only Sockopt key leaked: %s", key)
		}
	}
}

func TestModernSubscriptionProfileBoundary(t *testing.T) {
	legacy := map[string]any{
		"forceTls": "tls",
		"dest":     "legacy.example.com",
		"port":     float64(443),
		"remark":   "legacy",
		"sni":      "legacy-sni.example.com",
	}
	if isModernSubscriptionProfile(legacy) {
		t.Fatal("legacy external proxy was classified as modern")
	}

	managedHost := map[string]any{
		"isHost":   true,
		"network":  "ws",
		"security": "tls",
	}
	if isModernSubscriptionProfile(managedHost) {
		t.Fatal("managed host was classified as modern")
	}

	modern := map[string]any{
		"network":  "ws",
		"security": "tls",
	}
	if !isModernSubscriptionProfile(modern) {
		t.Fatal("modern subscription profile was not detected")
	}

	base := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{"type": "none"},
		},
	}
	productionStream := effectiveSubscriptionProfileProductionStream(
		base,
		map[string]any{
			"network": "ws",
			"sockopt": map[string]any{
				"tcpFastOpen": true,
			},
			"finalmask": map[string]any{
				"tcp": []any{map[string]any{"type": "sudoku"}},
			},
		},
	)
	if _, exists := productionStream["sockopt"]; exists {
		t.Fatal("production pre-normalization stream must defer profile sockopt")
	}
	if _, exists := productionStream["finalmask"]; exists {
		t.Fatal("production pre-normalization stream must defer profile finalmask")
	}
}

func TestEffectiveSubscriptionProfileStream_XHTTPModeCleanup(t *testing.T) {
	base := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{"type": "none"},
		},
	}

	stream := effectiveSubscriptionProfileStream(base, map[string]any{
		"network": "xhttp",
		"xhttpSettings": map[string]any{
			"mode":                 "stream-one",
			"path":                 "/x",
			"scMaxEachPostBytes":   "1024",
			"scMaxBufferedPosts":   float64(30),
			"scMinPostsIntervalMs": "50-150",
			"scStreamUpServerSecs": "20-80",
			"uplinkDataPlacement":  "header",
			"uplinkDataKey":        "x_data",
			"uplinkHTTPMethod":     "GET",
			"xPaddingObfsMode":     false,
			"xPaddingKey":          "stale",
			"xPaddingHeader":       "stale",
			"xPaddingPlacement":    "header",
			"xPaddingMethod":       "tokenish",
			"sessionPlacement":     "path",
			"sessionKey":           "stale",
			"sessionIDTable":       "",
			"sessionIDLength":      "8-16",
			"seqPlacement":         "path",
			"seqKey":               "stale",
			"enableXmux":           true,
			"headers":              map[string]any{"User-Agent": "x"},
			"xmux":                 map[string]any{"maxConnections": float64(6)},
		},
		"finalmask": map[string]any{
			"tcp": []any{},
			"udp": []any{},
			"quicParams": map[string]any{
				"congestion":         "bbr",
				"maxIncomingStreams": float64(1024),
			},
		},
	})

	xhttp, _ := stream["xhttpSettings"].(map[string]any)
	if xhttp["mode"] != "stream-one" {
		t.Fatalf("mode = %#v", xhttp["mode"])
	}
	for _, key := range []string{
		"scMaxEachPostBytes",
		"scMaxBufferedPosts",
		"scMinPostsIntervalMs",
		"scStreamUpServerSecs",
		"uplinkDataPlacement",
		"uplinkDataKey",
		"uplinkHTTPMethod",
		"xPaddingKey",
		"xPaddingHeader",
		"xPaddingPlacement",
		"xPaddingMethod",
		"sessionIDKey",
		"sessionIDLength",
		"seqKey",
		"enableXmux",
	} {
		if _, exists := xhttp[key]; exists {
			t.Errorf("inactive XHTTP key leaked: %s: %#v", key, xhttp)
		}
	}
	if _, exists := xhttp["headers"]; !exists {
		t.Fatalf("client headers were removed: %#v", xhttp)
	}
	if _, exists := xhttp["xmux"]; !exists {
		t.Fatalf("client XMUX was removed: %#v", xhttp)
	}

	finalMask, _ := stream["finalmask"].(map[string]any)
	quic, _ := finalMask["quicParams"].(map[string]any)
	if quic["congestion"] != "bbr" || quic["maxIncomingStreams"] != float64(1024) {
		t.Fatalf("QUIC params were not preserved: %#v", finalMask)
	}
}

func TestEffectiveSubscriptionProfileStreamExplicitKCPDefaultsOwnedFinalMask(t *testing.T) {
	base := map[string]any{
		"network":  "tcp",
		"security": "none",
		"tcpSettings": map[string]any{
			"header": map[string]any{"type": "none"},
		},
		"finalmask": map[string]any{
			"tcp": []any{map[string]any{"type": "sudoku"}},
		},
	}
	profile := map[string]any{
		"network": "kcp",
		"kcpSettings": map[string]any{
			"mtu": float64(1350),
			"tti": float64(20),
		},
	}

	stream := effectiveSubscriptionProfileStream(base, profile)
	finalmask, _ := stream["finalmask"].(map[string]any)
	if _, inherited := finalmask["tcp"]; inherited {
		t.Fatalf("parent finalmask leaked into explicit mKCP profile: %#v", finalmask)
	}
	udp, _ := finalmask["udp"].([]any)
	if len(udp) != 1 || stringValue(udp[0].(map[string]any)["type"]) != "mkcp-legacy" {
		t.Fatalf("unexpected effective mKCP finalmask: %#v", finalmask)
	}

	same := effectiveSubscriptionProfileStream(base, map[string]any{"network": "same"})
	sameFinalMask, _ := same["finalmask"].(map[string]any)
	if len(sameFinalMask["tcp"].([]any)) != 1 {
		t.Fatalf("same profile did not inherit parent finalmask: %#v", same)
	}
}

func TestProductionProfileRestoresImplicitKCPFinalMaskAfterDeferredMerge(t *testing.T) {
	base := map[string]any{
		"network":     "tcp",
		"security":    "none",
		"tcpSettings": map[string]any{"header": map[string]any{"type": "none"}},
	}
	profile := map[string]any{
		"network":     "kcp",
		"kcpSettings": map[string]any{"mtu": float64(1350), "tti": float64(20)},
	}

	stream := effectiveSubscriptionProfileProductionStream(base, profile)
	if _, exists := stream["finalmask"]; exists {
		t.Fatalf("production pre-normalization stream must defer finalmask: %#v", stream)
	}
	applyHostStreamOverrides(profile, stream)
	finalmask, _ := stream["finalmask"].(map[string]any)
	udp, _ := finalmask["udp"].([]any)
	if len(udp) != 1 || stringValue(udp[0].(map[string]any)["type"]) != "mkcp-legacy" {
		t.Fatalf("implicit mKCP finalmask was not restored: %#v", stream)
	}
}
