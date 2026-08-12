package sub

import "strings"

const (
	subscriptionFormatRaw   = "raw"
	subscriptionFormatJSON  = "json"
	subscriptionFormatClash = "clash"
)

const (
	capabilityClientSockopt      = "client_sockopt"
	capabilityProfileMux         = "profile_mux"
	capabilityShuffleHost        = "shuffle_host"
	capabilityCustomHeaders      = "custom_headers"
	capabilityWebSocketHeartbeat = "websocket_heartbeat"
	capabilityTCPHTTPAdvanced    = "tcp_http_advanced"
	capabilityGRPCAdvanced       = "grpc_advanced"
	capabilityTransport          = "transport"
	capabilityFinalMask          = "finalmask"
	capabilityMultipleTLSPins    = "multiple_tls_pins"
	capabilityRealityMLDSA       = "reality_mldsa65"
	capabilityRealitySpiderX     = "reality_spiderx"
)

// subscriptionProfileCapabilityCodes returns stable, value-free reason codes
// when one subscription format cannot faithfully represent a modern profile.
// The fixed ordering is deliberate: UI previews and tests must remain
// deterministic, and secret-bearing values must never be reflected in output.
func subscriptionProfileCapabilityCodes(
	profile map[string]any,
	stream map[string]any,
	format string,
) []string {
	if profile == nil || !isModernSubscriptionProfile(profile) {
		return nil
	}

	codes := make([]string, 0, 8)
	add := func(code string) {
		for _, existing := range codes {
			if existing == code {
				return
			}
		}
		codes = append(codes, code)
	}

	if enabled, _ := profile["shuffleHost"].(bool); enabled {
		add(capabilityShuffleHost)
	}

	network := strings.ToLower(strings.TrimSpace(stringValue(stream["network"])))
	security := strings.ToLower(strings.TrimSpace(stringValue(stream["security"])))

	switch format {
	case subscriptionFormatJSON:
		// JSON is an Xray-native config and preserves the complete client-side
		// stream, Mux, Sockopt and FinalMask shapes. shuffleHost is checked
		// above because it has no serializer semantics in this build.
		return codes

	case subscriptionFormatRaw:
		if hasNonEmptyMap(profile["sockopt"]) {
			add(capabilityClientSockopt)
		}
		if hasNonEmptyMap(profile["mux"]) {
			add(capabilityProfileMux)
		}
		switch network {
		case "tcp":
			if rawTCPHTTPHasUnrepresentedFields(stream) {
				add(capabilityTCPHTTPAdvanced)
			}
		case "ws":
			settings, _ := stream["wsSettings"].(map[string]any)
			if hasNonHostHeaders(settings) {
				add(capabilityCustomHeaders)
			}
			if nonZeroNumber(settings["heartbeatPeriod"]) {
				add(capabilityWebSocketHeartbeat)
			}
		case "httpupgrade":
			settings, _ := stream["httpupgradeSettings"].(map[string]any)
			if hasNonHostHeaders(settings) {
				add(capabilityCustomHeaders)
			}
		}

	case subscriptionFormatClash:
		if hasNonEmptyMap(profile["sockopt"]) {
			add(capabilityClientSockopt)
		}
		if hasNonEmptyMap(profile["mux"]) {
			add(capabilityProfileMux)
		}
		if hasCapabilityFinalMaskContent(profile["finalmask"]) &&
			(network != "hysteria" || clashHysteriaFinalMaskUnrepresented(profile["finalmask"])) {
			add(capabilityFinalMask)
		}

		switch network {
		case "", "tcp":
			tcp, _ := stream["tcpSettings"].(map[string]any)
			header, _ := tcp["header"].(map[string]any)
			if headerType, _ := header["type"].(string); headerType != "" && headerType != "none" {
				add(capabilityTransport)
			}
		case "ws":
			settings, _ := stream["wsSettings"].(map[string]any)
			if hasNonHostHeaders(settings) {
				add(capabilityCustomHeaders)
			}
			if nonZeroNumber(settings["heartbeatPeriod"]) {
				add(capabilityWebSocketHeartbeat)
			}
		case "grpc":
			settings, _ := stream["grpcSettings"].(map[string]any)
			if strings.TrimSpace(stringValue(settings["authority"])) != "" {
				add(capabilityGRPCAdvanced)
			}
			if multi, _ := settings["multiMode"].(bool); multi {
				add(capabilityGRPCAdvanced)
			}
		case "httpupgrade":
			settings, _ := stream["httpupgradeSettings"].(map[string]any)
			if hasNonHostHeaders(settings) {
				add(capabilityCustomHeaders)
			}
		case "xhttp":
			// buildXhttpClashOpts uses an explicit client-field allowlist.
		case "hysteria":
			// buildHysteriaProxy has a dedicated serializer.
		default:
			add(capabilityTransport)
		}

		if security == "tls" {
			tlsSettings, _ := stream["tlsSettings"].(map[string]any)
			clientSettings, _ := tlsSettings["settings"].(map[string]any)
			if pins, ok := pinnedSha256List(clientSettings); ok && len(pins) > 1 {
				add(capabilityMultipleTLSPins)
			}
		}

		if security == "reality" {
			realitySettings, _ := stream["realitySettings"].(map[string]any)
			clientSettings, _ := realitySettings["settings"].(map[string]any)
			if strings.TrimSpace(stringValue(clientSettings["mldsa65Verify"])) != "" {
				add(capabilityRealityMLDSA)
			}
			spiderX := strings.TrimSpace(stringValue(clientSettings["spiderX"]))
			if spiderX != "" && spiderX != "/" {
				add(capabilityRealitySpiderX)
			}
		}
	}

	return codes
}

func subscriptionProfileFormatCompatible(
	profile map[string]any,
	stream map[string]any,
	format string,
) bool {
	return len(subscriptionProfileCapabilityCodes(profile, stream, format)) == 0
}

func hasNonEmptyMap(value any) bool {
	m, ok := value.(map[string]any)
	return ok && len(m) > 0
}

func hasNonHostHeaders(settings map[string]any) bool {
	if settings == nil {
		return false
	}
	headers, _ := settings["headers"].(map[string]any)
	for key, value := range headers {
		if strings.EqualFold(strings.TrimSpace(key), "host") {
			continue
		}
		if headerValuePresent(value) {
			return true
		}
	}
	return false
}

func headerValuePresent(value any) bool {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed) != ""
	case []any:
		for _, item := range typed {
			if headerValuePresent(item) {
				return true
			}
		}
	case []string:
		for _, item := range typed {
			if strings.TrimSpace(item) != "" {
				return true
			}
		}
	default:
		return value != nil
	}
	return false
}

func nonZeroNumber(value any) bool {
	return intValue(value) != 0
}

func rawTCPHTTPHasUnrepresentedFields(stream map[string]any) bool {
	tcp, _ := stream["tcpSettings"].(map[string]any)
	header, _ := tcp["header"].(map[string]any)
	if strings.ToLower(strings.TrimSpace(stringValue(header["type"]))) != "http" {
		return false
	}

	request, _ := header["request"].(map[string]any)
	if request != nil {
		if version := strings.TrimSpace(stringValue(request["version"])); version != "" && version != "1.1" {
			return true
		}
		if method := strings.TrimSpace(stringValue(request["method"])); method != "" && method != "GET" {
			return true
		}
		if paths, ok := request["path"].([]any); ok && len(paths) > 1 {
			return true
		}
		if hasNonHostHeaders(request) {
			return true
		}
	}

	response, _ := header["response"].(map[string]any)
	if response != nil {
		if version := strings.TrimSpace(stringValue(response["version"])); version != "" && version != "1.1" {
			return true
		}
		if status := strings.TrimSpace(stringValue(response["status"])); status != "" && status != "200" {
			return true
		}
		if reason := strings.TrimSpace(stringValue(response["reason"])); reason != "" && reason != "OK" {
			return true
		}
		if hasNonHostHeaders(response) {
			return true
		}
	}

	return false
}

func hasCapabilityFinalMaskContent(value any) bool {
	finalmask, ok := value.(map[string]any)
	if !ok || finalmask == nil {
		return false
	}
	if masks, ok := finalmask["tcp"].([]any); ok && len(masks) > 0 {
		return true
	}
	if masks, ok := finalmask["udp"].([]any); ok && len(masks) > 0 {
		return true
	}
	if params, ok := finalmask["quicParams"].(map[string]any); ok && len(params) > 0 {
		return true
	}
	return false
}

func clashHysteriaFinalMaskUnrepresented(value any) bool {
	finalmask, _ := value.(map[string]any)
	if finalmask == nil {
		return false
	}

	if tcp, ok := finalmask["tcp"].([]any); ok && len(tcp) > 0 {
		return true
	}

	if udp, ok := finalmask["udp"].([]any); ok {
		if len(udp) > 1 {
			return true
		}
		for _, rawMask := range udp {
			mask, _ := rawMask.(map[string]any)
			if mask == nil || stringValue(mask["type"]) != "salamander" {
				return true
			}
			settings, _ := mask["settings"].(map[string]any)
			for key, item := range settings {
				if key != "password" && headerValuePresent(item) {
					return true
				}
			}
		}
	}

	quic, _ := finalmask["quicParams"].(map[string]any)
	for key, item := range quic {
		if key != "udpHop" && headerValuePresent(item) {
			return true
		}
	}
	if hop, ok := quic["udpHop"].(map[string]any); ok {
		for key, item := range hop {
			if key != "ports" && headerValuePresent(item) {
				return true
			}
		}
	}

	return false
}
