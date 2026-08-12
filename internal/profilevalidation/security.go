package profilevalidation

import (
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"os"
	"regexp"
	"strconv"
	"strings"
)

const maxTLSMaterialBytes = 4 << 20

var shortIDPattern = regexp.MustCompile(`^[0-9A-Fa-f]{0,16}$`)

func validateClientSecurity(parent, profile map[string]any, number int) error {
	switch effectiveSecurity(parent, profile) {
	case "tls":
		if value, exists := profile["tlsSettings"]; exists && value != nil {
			tlsSettings, ok := value.(map[string]any)
			if !ok {
				return issue(number, "tlsSettings", "invalid_type", "must be an object")
			}
			return validateTLSClient(tlsSettings, number, "tlsSettings")
		}
	case "reality":
		if value, exists := profile["realitySettings"]; exists && value != nil {
			reality, ok := value.(map[string]any)
			if !ok {
				return issue(number, "realitySettings", "invalid_type", "must be an object")
			}
			return validateRealityClient(reality, number, "realitySettings")
		}
	}
	return nil
}

func validateTLSClient(settings map[string]any, number int, path string) error {
	if err := optionalSafeStringAt(settings, "serverName", number, path, 2048); err != nil {
		return err
	}
	if err := optionalStringArrayAt(settings, "alpn", number, path, allowedSet("h3", "h2", "http/1.1"), true); err != nil {
		return err
	}
	clientValue, exists := settings["settings"]
	if !exists || clientValue == nil {
		return nil
	}
	client, ok := clientValue.(map[string]any)
	if !ok {
		return issue(number, path+".settings", "invalid_type", "must be an object")
	}
	if err := optionalEnumAt(client, "fingerprint", number, path+".settings", "", "chrome", "firefox", "safari", "ios", "android", "edge", "360", "qq", "random", "randomized", "randomizednoalpn", "unsafe"); err != nil {
		return err
	}
	for _, key := range []string{"echConfigList", "verifyPeerCertByName"} {
		if err := optionalSafeStringAt(client, key, number, path+".settings", 16384); err != nil {
			return err
		}
	}
	if err := optionalStringArrayAt(client, "pinnedPeerCertSha256", number, path+".settings", nil, false); err != nil {
		return err
	}
	return optionalBoolAt(client, "allowInsecure", number, path+".settings")
}

func validateRealityClient(settings map[string]any, number int, path string) error {
	if err := optionalStringArrayAt(settings, "serverNames", number, path, nil, false); err != nil {
		return err
	}
	if raw, exists := settings["serverNames"]; exists {
		values, _ := anySlice(raw)
		for _, value := range values {
			text, _ := value.(string)
			if strings.TrimSpace(text) != "" && !validServerName(text) {
				return issue(number, path+".serverNames", "invalid_server_name", "contains an invalid server name")
			}
		}
	}
	if err := optionalStringArrayAt(settings, "shortIds", number, path, nil, true); err != nil {
		return err
	}
	if raw, exists := settings["shortIds"]; exists {
		values, _ := anySlice(raw)
		for _, value := range values {
			text, _ := value.(string)
			if !validShortID(text) {
				return issue(number, path+".shortIds", "invalid_short_id", "contains an invalid hexadecimal short ID")
			}
		}
	}
	clientValue, exists := settings["settings"]
	if !exists || clientValue == nil {
		return nil
	}
	client, ok := clientValue.(map[string]any)
	if !ok {
		return issue(number, path+".settings", "invalid_type", "must be an object")
	}
	for _, key := range []string{"publicKey", "serverName", "shortId", "spiderX", "mldsa65Verify"} {
		if err := optionalSafeStringAt(client, key, number, path+".settings", 16384); err != nil {
			return err
		}
	}
	if err := optionalEnumAt(client, "fingerprint", number, path+".settings", "chrome", "firefox", "safari", "ios", "android", "edge", "360", "qq", "random", "randomized", "randomizednoalpn", "unsafe"); err != nil {
		return err
	}
	if shortID, ok := client["shortId"].(string); ok && !validShortID(shortID) {
		return issue(number, path+".settings.shortId", "invalid_short_id", "must be an even-length hexadecimal string of at most 16 characters")
	}
	return nil
}

func validateTLSServer(settings map[string]any, number int, path string, checkFiles bool) error {
	if err := validateTLSServerShape(settings, number, path); err != nil {
		return err
	}
	certificates, _ := anySlice(settings["certificates"])
	if len(certificates) == 0 {
		return issue(number, path+".certificates", "missing_certificate", "requires at least one certificate/private-key pair")
	}
	for index, raw := range certificates {
		certificate, _ := raw.(map[string]any)
		certPath := fmt.Sprintf("%s.certificates.%d", path, index)
		fileCert, _ := certificate["certificateFile"].(string)
		fileKey, _ := certificate["keyFile"].(string)
		inlineCert := joinStringArray(certificate["certificate"])
		inlineKey := joinStringArray(certificate["key"])
		fileMode := strings.TrimSpace(fileCert) != "" || strings.TrimSpace(fileKey) != ""
		inlineMode := strings.TrimSpace(inlineCert) != "" || strings.TrimSpace(inlineKey) != ""
		if fileMode == inlineMode {
			return issue(number, certPath, "certificate_mode", "must use exactly one complete file-backed or inline certificate/private-key pair")
		}
		if fileMode {
			if strings.TrimSpace(fileCert) == "" || strings.TrimSpace(fileKey) == "" {
				return issue(number, certPath, "certificate_pair", "requires both certificateFile and keyFile")
			}
			if checkFiles {
				certPEM, certErr := readLimitedTLSMaterial(fileCert)
				keyPEM, keyErr := readLimitedTLSMaterial(fileKey)
				if certErr != nil || keyErr != nil {
					return issue(number, certPath, "certificate_unreadable", "certificateFile and keyFile must both be readable regular files within the size limit")
				}
				if _, err := tls.X509KeyPair(certPEM, keyPEM); err != nil {
					return issue(number, certPath, "certificate_mismatch", "certificate and private key must parse and match")
				}
			}
		} else {
			if strings.TrimSpace(inlineCert) == "" || strings.TrimSpace(inlineKey) == "" {
				return issue(number, certPath, "certificate_pair", "requires both inline certificate and private key")
			}
			if _, err := tls.X509KeyPair([]byte(inlineCert), []byte(inlineKey)); err != nil {
				return issue(number, certPath, "certificate_mismatch", "inline certificate and private key must parse and match")
			}
		}
	}
	return nil
}

func validateTLSServerShape(settings map[string]any, number int, path string) error {
	for _, key := range []string{"serverName", "cipherSuites", "echServerKeys", "masterKeyLog"} {
		if err := optionalSafeStringAt(settings, key, number, path, 65536); err != nil {
			return err
		}
	}
	for _, key := range []string{"rejectUnknownSni", "disableSystemRoot", "enableSessionResumption"} {
		if err := optionalBoolAt(settings, key, number, path); err != nil {
			return err
		}
	}
	if err := optionalEnumAt(settings, "minVersion", number, path, "1.0", "1.1", "1.2", "1.3"); err != nil {
		return err
	}
	if err := optionalEnumAt(settings, "maxVersion", number, path, "1.0", "1.1", "1.2", "1.3"); err != nil {
		return err
	}
	minVersion, _ := settings["minVersion"].(string)
	maxVersion, _ := settings["maxVersion"].(string)
	if minVersion != "" && maxVersion != "" && tlsVersionRank(minVersion) > tlsVersionRank(maxVersion) {
		return issue(number, path+".maxVersion", "version_order", "must not be lower than minVersion")
	}
	if err := optionalStringArrayAt(settings, "alpn", number, path, allowedSet("h3", "h2", "http/1.1"), true); err != nil {
		return err
	}
	if err := optionalStringArrayAt(settings, "curvePreferences", number, path, nil, true); err != nil {
		return err
	}
	if value, exists := settings["certificates"]; exists {
		certificates, ok := anySlice(value)
		if !ok {
			return issue(number, path+".certificates", "invalid_type", "must be an array")
		}
		for index, raw := range certificates {
			certificate, ok := raw.(map[string]any)
			if !ok {
				return issue(number, fmt.Sprintf("%s.certificates.%d", path, index), "invalid_type", "must be an object")
			}
			certPath := fmt.Sprintf("%s.certificates.%d", path, index)
			for _, key := range []string{"certificateFile", "keyFile"} {
				if err := optionalSafeStringAt(certificate, key, number, certPath, 4096); err != nil {
					return err
				}
			}
			for _, key := range []string{"certificate", "key"} {
				if err := optionalStringArrayAt(certificate, key, number, certPath, nil, false); err != nil {
					return err
				}
			}
			if err := optionalEnumAt(certificate, "usage", number, certPath, "encipherment", "verify", "issue"); err != nil {
				return err
			}
			for _, key := range []string{"oneTimeLoading", "buildChain"} {
				if err := optionalBoolAt(certificate, key, number, certPath); err != nil {
					return err
				}
			}
			if value, exists := certificate["ocspStapling"]; exists {
				if v, err := integer(value); err != nil || v < 0 {
					return issue(number, certPath+".ocspStapling", "invalid_integer", "must be a non-negative integer")
				}
			}
		}
	}
	if value, exists := settings["echSockopt"]; exists && value != nil {
		if err := validateSockoptValue(value, number, path+".echSockopt", true); err != nil {
			return err
		}
	}
	return nil
}

func validateRealityServer(settings map[string]any, number int, path string) error {
	if err := validateRealityServerShape(settings, number, path); err != nil {
		return err
	}
	target, _ := settings["target"].(string)
	if strings.TrimSpace(target) == "" {
		target, _ = settings["dest"].(string)
	}
	if !validHostPort(target) {
		return issue(number, path+".target", "invalid_target", "must be a host:port destination")
	}
	if privateKey, _ := settings["privateKey"].(string); strings.TrimSpace(privateKey) == "" {
		return issue(number, path+".privateKey", "missing_secret", "is required")
	}
	serverNames, _ := anySlice(settings["serverNames"])
	if len(serverNames) == 0 {
		return issue(number, path+".serverNames", "missing_server_name", "requires at least one server name")
	}
	return nil
}

func validateRealityServerShape(settings map[string]any, number int, path string) error {
	for _, key := range []string{"target", "dest", "privateKey", "minClientVer", "maxClientVer", "mldsa65Seed", "masterKeyLog"} {
		if err := optionalSafeStringAt(settings, key, number, path, 65536); err != nil {
			return err
		}
	}
	if err := optionalBoolAt(settings, "show", number, path); err != nil {
		return err
	}
	for _, key := range []string{"xver", "maxTimediff"} {
		if value, exists := settings[key]; exists {
			if v, err := integer(value); err != nil || v < 0 {
				return issue(number, path+"."+key, "invalid_integer", "must be a non-negative integer")
			}
		}
	}
	if err := optionalStringArrayAt(settings, "serverNames", number, path, nil, false); err != nil {
		return err
	}
	if raw, exists := settings["serverNames"]; exists {
		values, _ := anySlice(raw)
		for _, value := range values {
			text, _ := value.(string)
			if !validServerName(text) {
				return issue(number, path+".serverNames", "invalid_server_name", "contains an invalid server name")
			}
		}
	}
	if err := optionalStringArrayAt(settings, "shortIds", number, path, nil, true); err != nil {
		return err
	}
	if raw, exists := settings["shortIds"]; exists {
		values, _ := anySlice(raw)
		for _, value := range values {
			text, _ := value.(string)
			if !validShortID(text) {
				return issue(number, path+".shortIds", "invalid_short_id", "contains an invalid hexadecimal short ID")
			}
		}
	}
	minVersion, _ := settings["minClientVer"].(string)
	maxVersion, _ := settings["maxClientVer"].(string)
	if minVersion != "" && !validDottedVersion(minVersion) {
		return issue(number, path+".minClientVer", "invalid_version", "must be a dotted numeric version with one to four bounded components")
	}
	if maxVersion != "" && !validDottedVersion(maxVersion) {
		return issue(number, path+".maxClientVer", "invalid_version", "must be a dotted numeric version with one to four bounded components")
	}
	if minVersion != "" && maxVersion != "" && compareVersions(minVersion, maxVersion) > 0 {
		return issue(number, path+".maxClientVer", "version_order", "must not be lower than minClientVer")
	}
	for _, key := range []string{"limitFallbackUpload", "limitFallbackDownload"} {
		if value, exists := settings[key]; exists && value != nil {
			limit, ok := value.(map[string]any)
			if !ok {
				return issue(number, path+"."+key, "invalid_type", "must be an object")
			}
			for _, field := range []string{"afterBytes", "bytesPerSec", "burstBytesPerSec"} {
				if value, exists := limit[field]; exists {
					if v, err := integer(value); err != nil || v < 0 {
						return issue(number, path+"."+key+"."+field, "invalid_integer", "must be a non-negative integer")
					}
				}
			}
			bytesPerSec, _ := integerOrZero(limit["bytesPerSec"])
			burst, _ := integerOrZero(limit["burstBytesPerSec"])
			if burst > 0 && bytesPerSec == 0 {
				return issue(number, path+"."+key+".burstBytesPerSec", "missing_dependency", "requires bytesPerSec to be greater than zero")
			}
		}
	}
	return nil
}

func validShortID(value string) bool {
	value = strings.TrimSpace(value)
	return shortIDPattern.MatchString(value) && len(value)%2 == 0
}

func validServerName(value string) bool {
	value = strings.TrimSpace(value)
	return value != "" && len(value) <= 253 && !containsControl(value) && !strings.ContainsAny(value, "/:@?# ")
}

func validHostPort(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" || strings.Contains(value, "://") || containsControl(value) {
		return false
	}
	host, portText, err := net.SplitHostPort(value)
	if err != nil || strings.TrimSpace(host) == "" {
		return false
	}
	port, err := strconv.Atoi(portText)
	return err == nil && port >= 1 && port <= 65535
}

func joinStringArray(value any) string {
	values, _ := anySlice(value)
	parts := make([]string, 0, len(values))
	for _, raw := range values {
		if text, ok := raw.(string); ok {
			parts = append(parts, text)
		}
	}
	return strings.Join(parts, "\n")
}

func validDottedVersion(value string) bool {
	if len(value) == 0 || len(value) > 64 {
		return false
	}
	parts := strings.Split(value, ".")
	if len(parts) == 0 || len(parts) > 4 {
		return false
	}
	for _, part := range parts {
		if part == "" {
			return false
		}
		for _, current := range part {
			if current < '0' || current > '9' {
				return false
			}
		}
		if _, err := strconv.ParseUint(part, 10, 32); err != nil {
			return false
		}
	}
	return true
}

func compareVersions(left, right string) int {
	parse := func(value string) []uint64 {
		parts := strings.Split(value, ".")
		out := make([]uint64, len(parts))
		for index, part := range parts {
			out[index], _ = strconv.ParseUint(part, 10, 32)
		}
		return out
	}
	leftParts := parse(left)
	rightParts := parse(right)
	length := len(leftParts)
	if len(rightParts) > length {
		length = len(rightParts)
	}
	for index := 0; index < length; index++ {
		var l, r uint64
		if index < len(leftParts) {
			l = leftParts[index]
		}
		if index < len(rightParts) {
			r = rightParts[index]
		}
		if l < r {
			return -1
		}
		if l > r {
			return 1
		}
	}
	return 0
}

func readLimitedTLSMaterial(path string) ([]byte, error) {
	info, err := os.Stat(path)
	if err != nil || !info.Mode().IsRegular() || info.Size() < 0 || info.Size() > maxTLSMaterialBytes {
		return nil, fmt.Errorf("unreadable TLS material")
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("unreadable TLS material")
	}
	defer file.Close()
	material, err := io.ReadAll(io.LimitReader(file, maxTLSMaterialBytes+1))
	if err != nil || len(material) > maxTLSMaterialBytes {
		return nil, fmt.Errorf("unreadable TLS material")
	}
	return material, nil
}

func tlsVersionRank(value string) int {
	switch value {
	case "1.0":
		return 10
	case "1.1":
		return 11
	case "1.2":
		return 12
	case "1.3":
		return 13
	default:
		return 0
	}
}
