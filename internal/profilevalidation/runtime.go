package profilevalidation

import (
	"math"
	"strings"
)

func validateMux(profile map[string]any, number int) error {
	value, exists := profile["mux"]
	if !exists || value == nil {
		return nil
	}
	mux, ok := value.(map[string]any)
	if !ok {
		return issue(number, "mux", "invalid_type", "must be an object")
	}
	if err := optionalBoolAt(mux, "enabled", number, "mux"); err != nil {
		return err
	}
	for _, key := range []string{"concurrency", "xudpConcurrency"} {
		if value, exists := mux[key]; exists {
			if v, err := integer(value); err != nil || v < 0 || v > math.MaxInt32 {
				return issue(number, "mux."+key, "invalid_integer", "must be a non-negative integer")
			}
		}
	}
	return optionalEnumAt(mux, "xudpProxyUDP443", number, "mux", "reject", "allow", "skip")
}

func validateRuntime(parent, profile map[string]any, number int, options Options) error {
	runtimeMarked := HasRuntimeMarker(profile)
	runtime := map[string]any{}
	if value, exists := profile["runtime"]; exists && value != nil {
		var ok bool
		runtime, ok = value.(map[string]any)
		if !ok {
			return issue(number, "runtime", "invalid_type", "must be an object")
		}
	}

	// Topology is automatic. The former enabled/mode/listen/port fields are
	// migration-only metadata and cannot disable, force or relocate a listener.
	// The save normalizer removes them before persistence; direct API/database
	// rows are accepted here because the compiler ignores them as well.
	if value, exists := runtime["id"]; exists && value != nil {
		id, ok := value.(string)
		if !ok || !runtimeIDPattern.MatchString(strings.TrimSpace(id)) {
			return issue(number, "runtime.id", "invalid_runtime_id", "must use 1-64 letters, digits, dot, underscore or hyphen")
		}
	}
	if runtimeMarked && options.Protocol != "" && !runtimeProtocolSupported(options.Protocol) {
		return issue(number, "runtime", "protocol_incompatible", "the parent protocol does not support automatic runtime profiles")
	}
	if runtimeMarked && options.Protocol != "" {
		protocol := strings.ToLower(strings.TrimSpace(options.Protocol))
		network := effectiveNetwork(parent, profile)
		if protocol == "hysteria" && network != "hysteria" {
			return issue(number, "network", "protocol_incompatible", "Hysteria profiles must inherit the Hysteria transport")
		}
		if protocol == "hysteria" && effectiveSecurity(parent, profile) != "tls" {
			return issue(number, "security", "protocol_incompatible", "Hysteria runtime profiles require TLS security")
		}
	}
	if flow, _ := profile["flow"].(string); flow != "" && options.Protocol != "" && strings.ToLower(options.Protocol) != "vless" {
		return issue(number, "flow", "protocol_incompatible", "a non-empty flow is only valid for VLESS")
	}
	if value, exists := runtime["sockopt"]; exists && value != nil {
		if err := validateSockoptValue(value, number, "runtime.sockopt", true); err != nil {
			return err
		}
		if err := validateProxyProtocolConsistency(parent, profile, runtime, number); err != nil {
			return err
		}
	}

	security := effectiveSecurity(parent, profile)
	switch security {
	case "none":
	case "tls":
		if tlsValue, ok := runtime["tlsSettings"]; ok && tlsValue != nil {
			tlsSettings, ok := tlsValue.(map[string]any)
			if !ok {
				return issue(number, "runtime.tlsSettings", "invalid_type", "must be an object")
			}
			if err := validateTLSServer(tlsSettings, number, "runtime.tlsSettings", options.CheckCertificateFiles); err != nil {
				return err
			}
		} else if runtimeMarked && options.Protocol != "" && parentSecurity(parent) != "tls" {
			return issue(number, "runtime.tlsSettings", "missing_server_settings", "requires runtime.tlsSettings with server certificate/key settings")
		}
	case "reality":
		if realityValue, ok := runtime["realitySettings"]; ok && realityValue != nil {
			reality, ok := realityValue.(map[string]any)
			if !ok {
				return issue(number, "runtime.realitySettings", "invalid_type", "must be an object")
			}
			if err := validateRealityServer(reality, number, "runtime.realitySettings"); err != nil {
				return err
			}
		} else if runtimeMarked && options.Protocol != "" && parentSecurity(parent) != "reality" {
			return issue(number, "runtime.realitySettings", "missing_server_settings", "is required for a REALITY runtime listener")
		}
	default:
		return issue(number, "security", "invalid_enum", "resolves to an unsupported security mode")
	}
	return nil
}

func validateProxyProtocolConsistency(parent, profile, runtime map[string]any, number int) error {
	sockopt, _ := runtime["sockopt"].(map[string]any)
	proxyValue, explicitlySet := sockopt["acceptProxyProtocol"]
	if !explicitlySet {
		return nil
	}
	proxyEnabled, ok := proxyValue.(bool)
	if !ok {
		// validateSockoptValue reports the concrete type error first.
		return nil
	}

	network := effectiveNetwork(parent, profile)
	if network == "kcp" && proxyEnabled {
		return issue(number, "runtime.sockopt.acceptProxyProtocol", "transport_incompatible", "PROXY protocol is not supported by the active mKCP transport")
	}

	settingsKey := ""
	switch network {
	case "tcp":
		settingsKey = "tcpSettings"
	case "ws":
		settingsKey = "wsSettings"
	case "httpupgrade":
		settingsKey = "httpupgradeSettings"
	default:
		// gRPC and XHTTP consume the Sockopt switch directly and do not have a
		// duplicate transport-level field in the current source.
		return nil
	}

	transport, _ := profile[settingsKey].(map[string]any)
	if transport == nil {
		transport, _ = parent[settingsKey].(map[string]any)
	}
	if transport == nil {
		return nil
	}
	transportValue, exists := transport["acceptProxyProtocol"]
	if !exists {
		return nil
	}
	transportEnabled, ok := transportValue.(bool)
	if !ok {
		// The active transport validator reports the concrete type error first.
		return nil
	}
	if transportEnabled != proxyEnabled {
		return issue(number, "runtime.sockopt.acceptProxyProtocol", "proxy_protocol_mismatch", "must match the active transport acceptProxyProtocol setting")
	}
	return nil
}
