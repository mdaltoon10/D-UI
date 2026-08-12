package profilevalidation

import (
	"fmt"
	"math"
	"net"
	"strconv"
	"strings"
)

func validateSockoptValue(value any, number int, path string, runtime bool) error {
	if value == nil {
		return nil
	}
	settings, ok := value.(map[string]any)
	if !ok {
		return issue(number, path, "invalid_type", "must be an object")
	}
	for _, key := range []string{"acceptProxyProtocol", "tcpMptcp", "penetrate", "V6Only"} {
		if err := optionalBoolAt(settings, key, number, path); err != nil {
			return err
		}
	}
	if value, exists := settings["tcpFastOpen"]; exists {
		if _, ok := value.(bool); !ok {
			if v, err := integer(value); err != nil || v < 0 {
				return issue(number, path+".tcpFastOpen", "invalid_type", "must be a boolean or non-negative integer")
			}
		}
	}
	for _, key := range []string{"mark", "tcpMaxSeg", "tcpKeepAliveInterval", "tcpKeepAliveIdle", "tcpUserTimeout", "tcpWindowClamp"} {
		if value, exists := settings[key]; exists {
			if v, err := integer(value); err != nil || v < 0 || v > math.MaxInt32 {
				return issue(number, path+"."+key, "invalid_integer", "must be a non-negative integer")
			}
		}
	}
	if err := optionalEnumAt(settings, "tproxy", number, path, "off", "redirect", "tproxy"); err != nil {
		return err
	}
	if err := optionalEnumAt(settings, "domainStrategy", number, path, "AsIs", "UseIP", "UseIPv6v4", "UseIPv6", "UseIPv4v6", "UseIPv4", "ForceIP", "ForceIPv6v4", "ForceIPv6", "ForceIPv4v6", "ForceIPv4"); err != nil {
		return err
	}
	if err := optionalEnumAt(settings, "tcpcongestion", number, path, "bbr", "cubic", "reno"); err != nil {
		return err
	}
	if err := optionalEnumAt(settings, "addressPortStrategy", number, path, "none", "SrvPortOnly", "SrvAddressOnly", "SrvPortAndAddress", "TxtPortOnly", "TxtAddressOnly", "TxtPortAndAddress"); err != nil {
		return err
	}
	for _, key := range []string{"dialerProxy", "interface"} {
		if err := optionalSafeStringAt(settings, key, number, path, 1024); err != nil {
			return err
		}
	}
	if trusted, exists := settings["trustedXForwardedFor"]; exists {
		values, ok := anySlice(trusted)
		if !ok {
			return issue(number, path+".trustedXForwardedFor", "invalid_type", "must be a string array")
		}
		allowedHeaders := allowedSet("CF-Connecting-IP", "X-Real-IP", "True-Client-IP", "X-Client-IP")
		for _, raw := range values {
			text, ok := raw.(string)
			trimmed := strings.TrimSpace(text)
			if !ok || (net.ParseIP(trimmed) == nil && parseCIDR(trimmed) == nil && !allowedHeaders[trimmed]) {
				return issue(number, path+".trustedXForwardedFor", "invalid_network", "contains an unsupported address, network, or trusted client-IP header")
			}
		}
	}
	if happyValue, exists := settings["happyEyeballs"]; exists && happyValue != nil {
		happy, ok := happyValue.(map[string]any)
		if !ok {
			return issue(number, path+".happyEyeballs", "invalid_type", "must be an object")
		}
		for _, key := range []string{"tryDelayMs", "maxConcurrentTry"} {
			if value, exists := happy[key]; exists {
				if v, err := integer(value); err != nil || v < 0 {
					return issue(number, path+".happyEyeballs."+key, "invalid_integer", "must be a non-negative integer")
				}
			}
		}
		if value, exists := happy["interleave"]; exists {
			if v, err := integer(value); err != nil || v < 1 {
				return issue(number, path+".happyEyeballs.interleave", "invalid_integer", "must be a positive integer")
			}
		}
		if err := optionalBoolAt(happy, "prioritizeIPv6", number, path+".happyEyeballs"); err != nil {
			return err
		}
	}
	if customValue, exists := settings["customSockopt"]; exists {
		entries, ok := anySlice(customValue)
		if !ok {
			return issue(number, path+".customSockopt", "invalid_type", "must be an array")
		}
		if len(entries) > 128 {
			return issue(number, path+".customSockopt", "too_many_entries", "contains too many entries")
		}
		for index, raw := range entries {
			entry, ok := raw.(map[string]any)
			entryPath := fmt.Sprintf("%s.customSockopt.%d", path, index)
			if !ok {
				return issue(number, entryPath, "invalid_type", "must be an object")
			}
			if err := optionalEnumAt(entry, "system", number, entryPath, "", "linux", "windows", "darwin"); err != nil {
				return err
			}
			typeValue, ok := entry["type"].(string)
			if !ok || (typeValue != "int" && typeValue != "str") {
				return issue(number, entryPath+".type", "invalid_enum", "must be int or str")
			}
			for _, key := range []string{"level", "opt"} {
				text, ok := entry[key].(string)
				if !ok || strings.TrimSpace(text) == "" || containsControl(text) {
					return issue(number, entryPath+"."+key, "invalid_value", "must be a non-empty string")
				}
			}
			value, exists := entry["value"]
			if !exists {
				return issue(number, entryPath+".value", "missing_value", "is required")
			}
			if typeValue == "int" {
				if _, err := integer(value); err != nil {
					if text, ok := value.(string); !ok || !integerString(text) {
						return issue(number, entryPath+".value", "invalid_integer", "must be an integer")
					}
				}
			} else {
				text, ok := value.(string)
				if !ok || containsControl(text) {
					return issue(number, entryPath+".value", "invalid_string", "must be a string without control characters")
				}
			}
		}
	}
	if !runtime {
		for _, key := range []string{"acceptProxyProtocol", "V6Only", "trustedXForwardedFor"} {
			if _, exists := settings[key]; exists {
				return issue(number, path+"."+key, "scope_violation", "is listener-only and cannot be stored in client sockopt")
			}
		}
	}
	return nil
}

func parseCIDR(value string) *net.IPNet {
	_, network, err := net.ParseCIDR(strings.TrimSpace(value))
	if err != nil {
		return nil
	}
	return network
}

func integerString(value string) bool {
	_, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	return err == nil
}
