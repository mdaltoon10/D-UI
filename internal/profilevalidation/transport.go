package profilevalidation

import (
	"math"
	"regexp"
	"strings"
)

const sessionMinimumSpace = uint64(2 << 30)

var headerNamePattern = regexp.MustCompile(`^[!#$%&'*+.^_` + "`" + `|~0-9A-Za-z-]+$`)

func validateTransportSettings(parent, profile map[string]any, number int) error {
	network := effectiveNetwork(parent, profile)
	key := transportSettingsKey(network)
	if key == "" {
		return nil
	}
	value, exists := profile[key]
	if !exists || value == nil {
		// Absence means inherit the parent/default transport object.
		return nil
	}
	settings, ok := value.(map[string]any)
	if !ok {
		return issue(number, key, "invalid_type", "must be an object")
	}
	switch key {
	case "tcpSettings":
		return validateTCP(settings, number, key)
	case "wsSettings", "httpupgradeSettings":
		return validateHTTPTransport(settings, number, key)
	case "grpcSettings":
		return validateGRPC(settings, number, key)
	case "xhttpSettings":
		return validateXHTTP(settings, number, key)
	default:
		// KCP is in the current profile schema but its deeper requirements were
		// not part of this parity phase. Keep the object structural-only rather
		// than inventing constraints that differ from the pinned core.
		return nil
	}
}

func validateTCP(settings map[string]any, number int, path string) error {
	if err := optionalBoolAt(settings, "acceptProxyProtocol", number, path); err != nil {
		return err
	}
	headerValue, exists := settings["header"]
	if !exists || headerValue == nil {
		return nil
	}
	header, ok := headerValue.(map[string]any)
	if !ok {
		return issue(number, path+".header", "invalid_type", "must be an object")
	}
	typeValue, ok := header["type"].(string)
	if !ok || (typeValue != "none" && typeValue != "http") {
		return issue(number, path+".header.type", "invalid_enum", "must be none or http")
	}
	if typeValue != "http" {
		return nil
	}
	for _, side := range []string{"request", "response"} {
		value, exists := header[side]
		if !exists || value == nil {
			continue
		}
		object, ok := value.(map[string]any)
		if !ok {
			return issue(number, path+".header."+side, "invalid_type", "must be an object")
		}
		for _, key := range []string{"version", "method", "status", "reason"} {
			if err := optionalSafeStringAt(object, key, number, path+".header."+side, 256); err != nil {
				return err
			}
		}
		if side == "request" {
			if value, exists := object["path"]; exists {
				paths, ok := anySlice(value)
				if !ok || len(paths) == 0 {
					return issue(number, path+".header.request.path", "invalid_path", "must be a non-empty string array")
				}
				for _, raw := range paths {
					text, ok := raw.(string)
					if !ok || !validHTTPPath(text) {
						return issue(number, path+".header.request.path", "invalid_path", "contains an invalid HTTP path")
					}
				}
			}
		}
		if err := validateHeaders(object["headers"], number, path+".header."+side+".headers", true); err != nil {
			return err
		}
	}
	return nil
}

func validateHTTPTransport(settings map[string]any, number int, path string) error {
	if err := optionalBoolAt(settings, "acceptProxyProtocol", number, path); err != nil {
		return err
	}
	if value, exists := settings["path"]; exists {
		text, ok := value.(string)
		if !ok || !validHTTPPath(text) {
			return issue(number, path+".path", "invalid_path", "must start with / and contain no control characters")
		}
	}
	if err := optionalSafeStringAt(settings, "host", number, path, 2048); err != nil {
		return err
	}
	if err := validateHeaders(settings["headers"], number, path+".headers", false); err != nil {
		return err
	}
	if value, exists := settings["heartbeatPeriod"]; exists {
		if v, err := integer(value); err != nil || v < 0 {
			return issue(number, path+".heartbeatPeriod", "invalid_integer", "must be a non-negative integer")
		}
	}
	return nil
}

func validateGRPC(settings map[string]any, number int, path string) error {
	for _, key := range []string{"serviceName", "authority"} {
		if err := optionalSafeStringAt(settings, key, number, path, 2048); err != nil {
			return err
		}
	}
	return optionalBoolAt(settings, "multiMode", number, path)
}

func validateXHTTP(settings map[string]any, number int, path string) error {
	if err := optionalEnumAt(settings, "mode", number, path, "auto", "packet-up", "stream-up", "stream-one"); err != nil {
		return err
	}
	mode, _ := settings["mode"].(string)
	if mode == "" {
		mode = "auto"
	}
	if value, exists := settings["path"]; exists {
		text, ok := value.(string)
		if !ok || !validHTTPPath(text) {
			return issue(number, path+".path", "invalid_path", "must start with / and contain no control characters")
		}
	}
	if err := optionalSafeStringAt(settings, "host", number, path, 2048); err != nil {
		return err
	}
	if value, exists := settings["xPaddingBytes"]; exists {
		if _, _, err := scalarRange(value, 0, math.MaxInt32, true); err != nil {
			return issue(number, path+".xPaddingBytes", "invalid_range", "must be a valid non-negative scalar or range")
		}
	}

	activeRangeFields := []string{}
	switch mode {
	case "auto", "packet-up":
		activeRangeFields = append(activeRangeFields, "scMaxEachPostBytes", "scMinPostsIntervalMs")
	case "stream-up":
		activeRangeFields = append(activeRangeFields, "scStreamUpServerSecs")
	}
	for _, key := range activeRangeFields {
		if value, exists := settings[key]; exists {
			if _, _, err := scalarRange(value, 0, math.MaxInt32, true); err != nil {
				return issue(number, path+"."+key, "invalid_range", "must be a valid non-negative scalar or range")
			}
		}
	}
	if mode != "stream-one" {
		if value, exists := settings["scMaxBufferedPosts"]; exists {
			if v, err := integer(value); err != nil || v < 0 || v > math.MaxInt32 {
				return issue(number, path+".scMaxBufferedPosts", "invalid_integer", "must be a non-negative integer")
			}
		}
	}
	for _, key := range []string{"serverMaxHeaderBytes", "uplinkChunkSize"} {
		if value, exists := settings[key]; exists {
			if v, err := integer(value); err != nil || v < 0 || v > math.MaxInt32 {
				return issue(number, path+"."+key, "invalid_integer", "must be a non-negative integer")
			}
		}
	}
	for _, key := range []string{"xPaddingObfsMode", "noSSEHeader", "noGRPCHeader", "enableXmux"} {
		if err := optionalBoolAt(settings, key, number, path); err != nil {
			return err
		}
	}

	if err := optionalEnumAt(settings, "sessionIDPlacement", number, path, "", "path", "header", "cookie", "query"); err != nil {
		return err
	}
	if err := optionalEnumAt(settings, "seqPlacement", number, path, "", "path", "header", "cookie", "query"); err != nil {
		return err
	}
	for placementKey, valueKey := range map[string]string{
		"sessionIDPlacement": "sessionIDKey",
		"seqPlacement":       "seqKey",
	} {
		placement, _ := settings[placementKey].(string)
		if placementRequiresKey(placement) {
			value, ok := settings[valueKey].(string)
			if !ok || strings.TrimSpace(value) == "" || containsControl(value) {
				return issue(number, path+"."+valueKey, "missing_dependency", "is required for the selected placement")
			}
		}
	}

	if mode == "packet-up" {
		if err := optionalEnumAt(settings, "uplinkDataPlacement", number, path, "", "body", "header", "cookie", "query"); err != nil {
			return err
		}
		placement, _ := settings["uplinkDataPlacement"].(string)
		if placementRequiresKey(placement) {
			value, ok := settings["uplinkDataKey"].(string)
			if !ok || strings.TrimSpace(value) == "" || containsControl(value) {
				return issue(number, path+".uplinkDataKey", "missing_dependency", "is required for the selected placement")
			}
		}
	}

	paddingEnabled, _ := settings["xPaddingObfsMode"].(bool)
	if paddingEnabled {
		if err := optionalEnumAt(settings, "xPaddingPlacement", number, path, "", "queryInHeader", "header", "cookie", "query"); err != nil {
			return err
		}
		if err := optionalEnumAt(settings, "xPaddingMethod", number, path, "", "repeat-x", "tokenish"); err != nil {
			return err
		}
		for _, key := range []string{"xPaddingKey", "xPaddingHeader"} {
			if err := optionalSafeStringAt(settings, key, number, path, 8192); err != nil {
				return err
			}
		}
	}

	if err := optionalEnumAt(settings, "uplinkHTTPMethod", number, path, "", "POST", "PUT", "GET"); err != nil {
		return err
	}
	if table, exists := settings["sessionIDTable"]; exists {
		text, ok := table.(string)
		if !ok || containsNonASCII(text) || containsControl(text) {
			return issue(number, path+".sessionIDTable", "invalid_table", "must be an ASCII string without control characters")
		}
		if text != "" {
			if length, ok := settings["sessionIDLength"]; ok {
				from, to, err := scalarRange(length, 1, math.MaxInt32, false)
				if err != nil {
					return issue(number, path+".sessionIDLength", "invalid_range", "must be a positive scalar or range")
				}
				if !sessionRoomLargeEnough(text, from, to) {
					return issue(number, path+".sessionIDLength", "insufficient_space", "does not provide enough session identifier space")
				}
			}
		}
	}
	if err := validateHeaders(settings["headers"], number, path+".headers", false); err != nil {
		return err
	}
	if xmuxValue, exists := settings["xmux"]; exists && xmuxValue != nil {
		xmux, ok := xmuxValue.(map[string]any)
		if !ok {
			return issue(number, path+".xmux", "invalid_type", "must be an object")
		}
		var concurrencyUpper, connectionsUpper int64
		for _, key := range []string{"maxConcurrency", "maxConnections", "cMaxReuseTimes", "hMaxRequestTimes", "hMaxReusableSecs"} {
			if value, exists := xmux[key]; exists {
				_, upper, err := scalarRange(value, 0, math.MaxInt32, true)
				if err != nil {
					return issue(number, path+".xmux."+key, "invalid_range", "must be a valid non-negative scalar or range")
				}
				if key == "maxConcurrency" {
					concurrencyUpper = upper
				}
				if key == "maxConnections" {
					connectionsUpper = upper
				}
			}
		}
		if concurrencyUpper > 0 && connectionsUpper > 0 {
			return issue(number, path+".xmux", "mutually_exclusive", "maxConcurrency and maxConnections cannot both be active")
		}
		if value, exists := xmux["hKeepAlivePeriod"]; exists {
			if v, err := integer(value); err != nil || v < 0 || v > math.MaxInt32 {
				return issue(number, path+".xmux.hKeepAlivePeriod", "invalid_integer", "must be a non-negative integer")
			}
		}
	}
	return nil
}

func validateHeaders(value any, number int, path string, arrayValues bool) error {
	if value == nil {
		return nil
	}
	headers, ok := value.(map[string]any)
	if !ok {
		return issue(number, path, "invalid_type", "must be an object")
	}
	if len(headers) > 128 {
		return issue(number, path, "too_many_headers", "contains too many headers")
	}
	for name, raw := range headers {
		if !headerNamePattern.MatchString(name) {
			return issue(number, path, "unsafe_header", "contains an invalid header name")
		}
		if arrayValues {
			values, ok := anySlice(raw)
			if !ok || len(values) == 0 {
				return issue(number, path, "invalid_header", "header values must be a non-empty string array")
			}
			for _, value := range values {
				text, ok := value.(string)
				if !ok || len(text) > 65536 || containsUnsafeHeaderValue(text) {
					return issue(number, path, "unsafe_header", "contains an invalid or oversized header value")
				}
			}
		} else {
			text, ok := raw.(string)
			if !ok || len(text) > 65536 || containsUnsafeHeaderValue(text) {
				return issue(number, path, "unsafe_header", "header values must be bounded strings without unsafe control characters")
			}
		}
	}
	return nil
}

func sessionRoomLargeEnough(table string, from, to int64) bool {
	alphabet := int64(sessionAlphabetSize(table))
	if alphabet < 2 || from < 1 || to < from {
		return false
	}

	// The required room is only 2^31. For every alphabet with at least two
	// symbols, any single identifier of length 31 already reaches that bound.
	// Cap both exponentiation and summation at the threshold so an adversarial
	// sessionIDLength cannot trigger an enormous big.Int allocation.
	if from >= 31 {
		return true
	}
	if to > 31 {
		to = 31
	}
	var total uint64
	for length := from; length <= to; length++ {
		term := saturatedPow(uint64(alphabet), length, sessionMinimumSpace)
		if term >= sessionMinimumSpace-total {
			return true
		}
		total += term
	}
	return total >= sessionMinimumSpace
}

func saturatedPow(base uint64, exponent int64, limit uint64) uint64 {
	result := uint64(1)
	for index := int64(0); index < exponent; index++ {
		if result >= limit/base {
			return limit
		}
		result *= base
	}
	return result
}

func sessionAlphabetSize(table string) int {
	predefined := map[string]int{
		"ALPHABET": 52, "Alphabet": 52, "BASE36": 36, "Base62": 62,
		"HEX": 16, "alphabet": 26, "base36": 36, "hex": 16, "number": 10,
	}
	if size, ok := predefined[table]; ok {
		return size
	}
	seen := make(map[byte]struct{}, len(table))
	for index := 0; index < len(table); index++ {
		seen[table[index]] = struct{}{}
	}
	return len(seen)
}

func validHTTPPath(value string) bool {
	return strings.HasPrefix(value, "/") && !containsControl(value) && len(value) <= 8192
}

func containsNonASCII(value string) bool {
	for index := 0; index < len(value); index++ {
		if value[index] > 0x7f {
			return true
		}
	}
	return false
}

func placementRequiresKey(value string) bool {
	return value == "header" || value == "cookie" || value == "query"
}
