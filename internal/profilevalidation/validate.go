// Package profilevalidation performs backend semantic validation for
// streamSettings.externalProxy subscription/runtime profiles. It intentionally
// has no dependency on the web or subscription packages so save, enable and
// runtime compilation paths can share exactly the same rules.
package profilevalidation

import (
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
)

const maxProfiles = 256

var (
	runtimeIDPattern  = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)
	vlessRoutePattern = regexp.MustCompile(`^\d{1,5}(?:-\d{1,5})?(?:\s*,\s*\d{1,5}(?:-\d{1,5})?)*$`)
)

// Options controls checks that depend on the operation being performed.
type Options struct {
	// Protocol is the parent inbound protocol. It is used for runtime-profile
	// and per-profile flow capability checks. Empty means unknown.
	Protocol string
	// CheckCertificateFiles reads file-backed runtime TLS certificates and
	// verifies that each certificate/private-key pair parses and matches.
	CheckCertificateFiles bool
}

// ValidationError is safe for API/log display: it carries only a stable code,
// field path and generic explanation. User-provided values and secrets are
// deliberately never interpolated into Error().
type ValidationError struct {
	Profile int
	Path    string
	Code    string
	Message string
}

func (e *ValidationError) Error() string {
	prefix := "subscription profile"
	if e.Profile > 0 {
		prefix = fmt.Sprintf("subscription profile %d", e.Profile)
	}
	if e.Path != "" {
		prefix += "." + e.Path
	}
	return prefix + ": " + e.Message
}

func issue(profile int, path, code, message string) error {
	return &ValidationError{Profile: profile, Path: path, Code: code, Message: message}
}

// ValidateStreamSettings validates a JSON streamSettings document.
func ValidateStreamSettings(raw string, options Options) error {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	decoder := json.NewDecoder(strings.NewReader(raw))
	decoder.UseNumber()
	var stream map[string]any
	if err := decoder.Decode(&stream); err != nil {
		return issue(0, "streamSettings", "invalid_json", "must be a valid JSON object")
	}
	if stream == nil {
		return issue(0, "streamSettings", "invalid_type", "must be a JSON object")
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return issue(0, "streamSettings", "invalid_json", "must contain one JSON object")
	}
	return ValidateStreamMap(stream, options)
}

// ValidateStreamMap validates an already-decoded streamSettings object.
func ValidateStreamMap(stream map[string]any, options Options) error {
	if stream == nil {
		return nil
	}
	rawProfiles, exists := stream["externalProxy"]
	if !exists || rawProfiles == nil {
		return nil
	}
	profiles, ok := anySlice(rawProfiles)
	if !ok {
		return issue(0, "externalProxy", "invalid_type", "must be an array")
	}
	if len(profiles) > maxProfiles {
		return issue(0, "externalProxy", "too_many_profiles", "contains too many entries")
	}
	for index, raw := range profiles {
		profileNumber := index + 1
		profile, ok := raw.(map[string]any)
		if !ok || profile == nil {
			return issue(profileNumber, "", "invalid_type", "must be an object")
		}
		if err := validateProfile(stream, profile, profileNumber, options); err != nil {
			return err
		}
	}
	return nil
}

func validateProfile(parent, profile map[string]any, number int, options Options) error {
	if err := optionalBool(profile, "enabled", number); err != nil {
		return err
	}
	if enabled, present := profile["enabled"].(bool); present && !enabled {
		// A disabled profile is a draft. Its transport/security/runtime values
		// are intentionally retained by the editor but are not emitted by any
		// active subscription or runtime compiler path. Revalidate it when the
		// profile is enabled instead of blocking unrelated saves now.
		return nil
	}
	if err := optionalSafeString(profile, "remark", number, 512); err != nil {
		return err
	}
	if err := optionalSafeString(profile, "dest", number, 2048); err != nil {
		return err
	}
	if value, exists := profile["port"]; exists {
		port, err := integer(value)
		if err != nil || port < 1 || port > 65535 {
			return issue(number, "port", "invalid_port", "must be an integer between 1 and 65535")
		}
	}

	modern := IsModernProfile(profile)
	if !modern {
		return validateLegacyProfile(profile, number)
	}

	if err := optionalEnum(profile, "network", number, "same", "tcp", "kcp", "ws", "grpc", "httpupgrade", "xhttp"); err != nil {
		return err
	}
	if err := optionalEnum(profile, "security", number, "same", "none", "tls", "reality"); err != nil {
		return err
	}
	if err := optionalEnum(profile, "forceTls", number, "same", "tls", "none"); err != nil {
		return err
	}
	if err := validateProfileMetadata(profile, number); err != nil {
		return err
	}
	if err := validateTransportSettings(parent, profile, number); err != nil {
		return err
	}
	if err := validateClientSecurity(parent, profile, number); err != nil {
		return err
	}
	if err := validateMux(profile, number); err != nil {
		return err
	}
	if err := validateSockoptValue(profile["sockopt"], number, "sockopt", false); err != nil {
		return err
	}
	if err := validateFinalMask(profile["finalmask"], number, "finalmask"); err != nil {
		return err
	}
	if effectiveSecurity(parent, profile) == "reality" && hasTCPFinalMask(profile["finalmask"]) {
		return issue(number, "finalmask.tcp", "security_incompatible", "TCP masks are not supported with REALITY security")
	}
	return validateRuntime(parent, profile, number, options)
}

func validateLegacyProfile(profile map[string]any, number int) error {
	for _, key := range []string{"sni", "verifyPeerCertByName", "echConfigList"} {
		if err := optionalSafeString(profile, key, number, 4096); err != nil {
			return err
		}
	}
	if err := optionalEnum(profile, "forceTls", number, "same", "tls", "none"); err != nil {
		return err
	}
	if err := optionalStringArray(profile, "alpn", number, allowedSet("h3", "h2", "http/1.1"), true); err != nil {
		return err
	}
	if err := optionalStringArray(profile, "pinnedPeerCertSha256", number, nil, false); err != nil {
		return err
	}
	for _, key := range []string{"overrideSniFromAddress", "keepSniBlank", "allowInsecure"} {
		if err := optionalBool(profile, key, number); err != nil {
			return err
		}
	}
	return nil
}

func validateProfileMetadata(profile map[string]any, number int) error {
	if value, exists := profile["flow"]; exists {
		flow, ok := value.(string)
		if !ok || containsControl(flow) {
			return issue(number, "flow", "invalid_flow", "must be a supported string")
		}
		switch flow {
		case "", "xtls-rprx-vision", "xtls-rprx-vision-udp443":
		default:
			return issue(number, "flow", "invalid_flow", "must be a supported VLESS flow")
		}
	}
	if value, exists := profile["vlessRoute"]; exists && value != nil {
		route, ok := value.(string)
		if !ok || (strings.TrimSpace(route) != "" && !vlessRoutePattern.MatchString(strings.TrimSpace(route))) {
			return issue(number, "vlessRoute", "invalid_route", "must be a comma-separated port or port-range list")
		}
		for _, part := range strings.Split(route, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			bounds := strings.Split(part, "-")
			lower, _ := strconv.Atoi(bounds[0])
			upper := lower
			if len(bounds) == 2 {
				upper, _ = strconv.Atoi(bounds[1])
			}
			if lower < 1 || upper > 65535 || upper < lower {
				return issue(number, "vlessRoute", "invalid_route", "contains an invalid port range")
			}
		}
	}
	if err := optionalEnum(profile, "mihomoIpVersion", number, "dual", "ipv4", "ipv6", "ipv4-prefer", "ipv6-prefer"); err != nil {
		return err
	}
	for _, key := range []string{"mihomoX25519", "shuffleHost", "overrideSniFromAddress", "keepSniBlank", "allowInsecure"} {
		if err := optionalBool(profile, key, number); err != nil {
			return err
		}
	}
	if err := optionalStringArray(profile, "excludeFromSubTypes", number, allowedSet("raw", "json", "clash"), true); err != nil {
		return err
	}
	for _, key := range []string{"sni", "verifyPeerCertByName", "echConfigList"} {
		if err := optionalSafeString(profile, key, number, 4096); err != nil {
			return err
		}
	}
	if err := optionalStringArray(profile, "alpn", number, allowedSet("h3", "h2", "http/1.1"), true); err != nil {
		return err
	}
	if err := optionalStringArray(profile, "pinnedPeerCertSha256", number, nil, false); err != nil {
		return err
	}
	return nil
}

// HasRuntimeMarker reports whether a structured subscription profile owns a
// hidden automatic-listener marker. Presence, including an empty object, is
// intentional: it distinguishes newly created/runtime-migrated profiles from
// older structured entries that were subscription-only before automatic
// topology existed.
func HasRuntimeMarker(profile map[string]any) bool {
	if profile == nil {
		return false
	}
	_, exists := profile["runtime"]
	return exists
}

// IsModernProfile reports whether a subscription profile uses the structured profile schema.
func IsModernProfile(profile map[string]any) bool {
	for _, key := range []string{
		"network", "security", "tlsSettings", "realitySettings", "sockopt", "mux", "finalmask",
		"overrideSniFromAddress", "keepSniBlank", "verifyPeerCertByName", "flow", "runtime",
		"tcpSettings", "kcpSettings", "wsSettings", "grpcSettings", "httpupgradeSettings", "xhttpSettings",
	} {
		if _, exists := profile[key]; exists {
			return true
		}
	}
	return false
}

func effectiveNetwork(parent, profile map[string]any) string {
	network, _ := profile["network"].(string)
	network = strings.ToLower(strings.TrimSpace(network))
	if network == "" || network == "same" {
		network, _ = parent["network"].(string)
		network = strings.ToLower(strings.TrimSpace(network))
	}
	return network
}

func transportSettingsKey(network string) string {
	switch network {
	case "tcp":
		return "tcpSettings"
	case "kcp":
		return "kcpSettings"
	case "ws":
		return "wsSettings"
	case "grpc":
		return "grpcSettings"
	case "httpupgrade":
		return "httpupgradeSettings"
	case "xhttp":
		return "xhttpSettings"
	default:
		return ""
	}
}

func hasTCPFinalMask(value any) bool {
	settings, ok := value.(map[string]any)
	if !ok || settings == nil {
		return false
	}
	entries, ok := anySlice(settings["tcp"])
	return ok && len(entries) > 0
}

func effectiveSecurity(parent, profile map[string]any) string {
	security, _ := profile["security"].(string)
	security = strings.ToLower(strings.TrimSpace(security))
	if security == "" || security == "same" {
		security, _ = profile["forceTls"].(string)
		security = strings.ToLower(strings.TrimSpace(security))
	}
	if security == "" || security == "same" {
		security = parentSecurity(parent)
	}
	if security == "" {
		return "none"
	}
	return security
}

func parentSecurity(parent map[string]any) string {
	security, _ := parent["security"].(string)
	security = strings.ToLower(strings.TrimSpace(security))
	if security == "" {
		return "none"
	}
	return security
}

func runtimeProtocolSupported(protocol string) bool {
	switch strings.ToLower(strings.TrimSpace(protocol)) {
	case "vless", "vmess", "trojan", "shadowsocks", "hysteria":
		return true
	default:
		return false
	}
}
