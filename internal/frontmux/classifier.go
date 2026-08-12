package frontmux

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/idna"
)

var http2ClientPreface = []byte("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n")

const (
	classificationUnknown = iota
	classificationTLS
	classificationHTTP1
	classificationHTTP2
	classificationRaw
)

type classification struct {
	kind int
	sni  string
	host string
	path string
}

type classifier struct {
	maxInspect int
	timeout    time.Duration
}

func newClassifier(group Group) classifier {
	return classifier{
		maxInspect: group.MaxInspectBytes,
		timeout:    time.Duration(group.ClassificationMS) * time.Millisecond,
	}
}

func (c classifier) classify(conn net.Conn, hasRaw bool) (classification, []byte, error) {
	if err := conn.SetReadDeadline(time.Now().Add(c.timeout)); err != nil {
		return classification{}, nil, err
	}
	defer func() {
		_ = conn.SetReadDeadline(time.Time{})
	}()

	buffer := make([]byte, 0, min(c.maxInspect, 16*1024))
	temporary := make([]byte, 4096)
	for len(buffer) < c.maxInspect {
		decision, needMore, err := inspectPrefix(buffer, hasRaw, c.maxInspect)
		if err != nil {
			return classification{}, buffer, err
		}
		if !needMore {
			return decision, buffer, nil
		}

		limit := len(temporary)
		if remaining := c.maxInspect - len(buffer); remaining < limit {
			limit = remaining
		}
		n, readErr := conn.Read(temporary[:limit])
		if n > 0 {
			buffer = append(buffer, temporary[:n]...)
		}
		if readErr != nil {
			if errors.Is(readErr, io.EOF) && len(buffer) > 0 && hasRaw {
				return classification{kind: classificationRaw}, buffer, nil
			}
			return classification{}, buffer, readErr
		}
	}
	return classification{}, buffer, fmt.Errorf("classification exceeded %d bytes", c.maxInspect)
}

func inspectPrefix(data []byte, hasRaw bool, maxInspect int) (classification, bool, error) {
	if len(data) == 0 {
		return classification{}, true, nil
	}

	if looksLikeTLS(data) {
		sni, complete, err := parseClientHelloSNI(data, maxInspect)
		if err != nil {
			return classification{}, false, err
		}
		if !complete {
			return classification{}, true, nil
		}
		return classification{kind: classificationTLS, sni: sni}, false, nil
	}

	if len(data) < len(http2ClientPreface) {
		if bytes.HasPrefix(http2ClientPreface, data) {
			return classification{}, true, nil
		}
	} else if bytes.HasPrefix(data, http2ClientPreface) {
		return classification{kind: classificationHTTP2}, false, nil
	}

	if isPossibleHTTP1Prefix(data) {
		if end := bytes.Index(data, []byte("\r\n\r\n")); end >= 0 {
			host, path, err := parseHTTP1Selector(data[:end+4])
			if err != nil {
				// Once the prefix is recognizably HTTP, malformed framing must be
				// rejected instead of falling through to RAW. That fail-closed rule
				// prevents request-smuggling-style ambiguity between HTTP routes and
				// the opaque catch-all backend.
				return classification{}, false, err
			}
			return classification{kind: classificationHTTP1, host: host, path: path}, false, nil
		}
		if len(data) >= maxInspect {
			return classification{}, false, errors.New("HTTP/1 headers exceed inspection limit")
		}
		return classification{}, true, nil
	}

	if hasRaw {
		return classification{kind: classificationRaw}, false, nil
	}
	return classification{}, false, errors.New("connection does not match TLS, HTTP/1 or cleartext HTTP/2 and no raw fallback exists")
}

func looksLikeTLS(data []byte) bool {
	if len(data) == 0 || data[0] != 0x16 {
		return false
	}
	if len(data) < 3 {
		return true
	}
	if data[1] != 0x03 || data[2] > 0x04 {
		return false
	}
	// A TLS handshake record carrying ClientHello always starts with
	// handshake type 1. Waiting for this byte sharply reduces false-positive
	// classification of opaque/raw protocols whose first bytes are random.
	if len(data) < 6 {
		return true
	}
	return data[5] == 0x01
}

func parseClientHelloSNI(data []byte, maxInspect int) (string, bool, error) {
	handshake := make([]byte, 0, min(len(data), maxInspect))
	offset := 0
	for {
		if len(data)-offset < 5 {
			return "", false, nil
		}
		if data[offset] != 0x16 {
			return "", false, errors.New("TLS handshake uses an unexpected record type before ClientHello")
		}
		recordLength := int(data[offset+3])<<8 | int(data[offset+4])
		if recordLength < 1 || recordLength > 18432 {
			return "", false, fmt.Errorf("invalid TLS record length %d", recordLength)
		}
		if offset+5+recordLength > len(data) {
			return "", false, nil
		}
		handshake = append(handshake, data[offset+5:offset+5+recordLength]...)
		if len(handshake) > maxInspect {
			return "", false, errors.New("TLS ClientHello exceeds inspection limit")
		}
		if len(handshake) >= 4 {
			if handshake[0] != 0x01 {
				return "", false, fmt.Errorf("expected TLS ClientHello, got handshake type %d", handshake[0])
			}
			handshakeLength := int(handshake[1])<<16 | int(handshake[2])<<8 | int(handshake[3])
			if handshakeLength > maxInspect-4 {
				return "", false, errors.New("TLS ClientHello exceeds inspection limit")
			}
			if len(handshake) >= 4+handshakeLength {
				return parseClientHelloBodySNI(handshake[4 : 4+handshakeLength])
			}
		}
		offset += 5 + recordLength
		if offset >= len(data) {
			return "", false, nil
		}
	}
}

func parseClientHelloBodySNI(body []byte) (string, bool, error) {
	// legacy_version + random
	if len(body) < 34 {
		return "", false, errors.New("truncated TLS ClientHello")
	}
	offset := 34

	if offset >= len(body) {
		return "", false, errors.New("truncated TLS session id")
	}
	sessionLength := int(body[offset])
	offset++
	if offset+sessionLength > len(body) {
		return "", false, errors.New("truncated TLS session id")
	}
	offset += sessionLength

	if offset+2 > len(body) {
		return "", false, errors.New("truncated TLS cipher suites")
	}
	cipherLength := int(body[offset])<<8 | int(body[offset+1])
	offset += 2
	if cipherLength == 0 || cipherLength%2 != 0 || offset+cipherLength > len(body) {
		return "", false, errors.New("invalid TLS cipher suites")
	}
	offset += cipherLength

	if offset >= len(body) {
		return "", false, errors.New("truncated TLS compression methods")
	}
	compressionLength := int(body[offset])
	offset++
	if compressionLength == 0 || offset+compressionLength > len(body) {
		return "", false, errors.New("invalid TLS compression methods")
	}
	offset += compressionLength

	if offset == len(body) {
		return "", true, nil
	}
	if offset+2 > len(body) {
		return "", false, errors.New("truncated TLS extensions")
	}
	extensionsLength := int(body[offset])<<8 | int(body[offset+1])
	offset += 2
	if offset+extensionsLength != len(body) {
		return "", false, errors.New("invalid TLS extensions length")
	}
	end := offset + extensionsLength
	serverName := ""
	seenServerName := false
	for offset < end {
		if offset+4 > end {
			return "", false, errors.New("truncated TLS extension")
		}
		extensionType := int(body[offset])<<8 | int(body[offset+1])
		extensionLength := int(body[offset+2])<<8 | int(body[offset+3])
		offset += 4
		if offset+extensionLength > end {
			return "", false, errors.New("truncated TLS extension body")
		}
		switch extensionType {
		case 0: // server_name
			if seenServerName {
				return "", false, errors.New("duplicate TLS server_name extension")
			}
			seenServerName = true
			value, err := parseServerNameExtension(body[offset : offset+extensionLength])
			if err != nil {
				return "", false, err
			}
			serverName = value
		case 0xfe0d: // encrypted_client_hello
			return "", false, errors.New("TLS ECH is not supported on an SNI-routed shared port")
		}
		offset += extensionLength
	}
	return serverName, true, nil
}

func parseServerNameExtension(data []byte) (string, error) {
	if len(data) < 2 {
		return "", errors.New("truncated TLS server_name extension")
	}
	listLength := int(data[0])<<8 | int(data[1])
	if listLength != len(data)-2 {
		return "", errors.New("invalid TLS server_name list length")
	}
	offset := 2
	serverName := ""
	for offset < len(data) {
		if offset+3 > len(data) {
			return "", errors.New("truncated TLS server_name entry")
		}
		nameType := data[offset]
		nameLength := int(data[offset+1])<<8 | int(data[offset+2])
		offset += 3
		if offset+nameLength > len(data) {
			return "", errors.New("truncated TLS server_name value")
		}
		if nameType == 0 {
			if serverName != "" {
				return "", errors.New("duplicate TLS host_name entry")
			}
			normalized, err := NormalizeServerName(string(data[offset : offset+nameLength]))
			if err != nil {
				return "", err
			}
			serverName = normalized
		}
		offset += nameLength
	}
	return serverName, nil
}

func NormalizeServerName(value string) (string, error) {
	value = strings.TrimSpace(strings.TrimSuffix(value, "."))
	if value == "" {
		return "", nil
	}
	if strings.ContainsAny(value, "\x00\r\n") {
		return "", errors.New("SNI contains control characters")
	}
	ascii, err := idna.Lookup.ToASCII(value)
	if err != nil {
		return "", fmt.Errorf("invalid SNI %q: %w", value, err)
	}
	ascii = strings.ToLower(strings.TrimSuffix(ascii, "."))
	if net.ParseIP(ascii) != nil {
		return "", fmt.Errorf("SNI %q must be a DNS name, not an IP literal", value)
	}
	if len(ascii) > 253 {
		return "", fmt.Errorf("SNI %q is too long", value)
	}
	return ascii, nil
}

func isPossibleHTTP1Prefix(data []byte) bool {
	if len(data) == 0 {
		return true
	}
	limit := len(data)
	if limit > 16 {
		limit = 16
	}
	for index := 0; index < limit; index++ {
		b := data[index]
		if b == ' ' {
			return index >= 3
		}
		if b < 'A' || b > 'Z' {
			return false
		}
	}
	return len(data) < 16
}

func parseHTTP1Selector(header []byte) (string, string, error) {
	lines := bytes.Split(header, []byte("\r\n"))
	if len(lines) < 2 {
		return "", "", errors.New("invalid HTTP/1 request")
	}
	requestParts := bytes.Fields(lines[0])
	if len(requestParts) != 3 || !bytes.HasPrefix(requestParts[2], []byte("HTTP/1.")) {
		return "", "", errors.New("invalid HTTP/1 request line")
	}
	rawTarget := string(requestParts[1])
	if !strings.HasPrefix(rawTarget, "/") {
		return "", "", errors.New("HTTP absolute-form and authority-form request targets are not supported")
	}
	parsedTarget, err := url.ParseRequestURI(rawTarget)
	if err != nil {
		return "", "", fmt.Errorf("invalid HTTP request target: %w", err)
	}
	path := parsedTarget.EscapedPath()
	if path == "" {
		path = "/"
	}

	host := ""
	for _, line := range lines[1:] {
		if len(line) == 0 {
			break
		}
		separator := bytes.IndexByte(line, ':')
		if separator <= 0 {
			return "", "", errors.New("invalid HTTP/1 header line")
		}
		name := strings.TrimSpace(string(line[:separator]))
		value := strings.TrimSpace(string(line[separator+1:]))
		if strings.EqualFold(name, "host") {
			if host != "" {
				return "", "", errors.New("duplicate HTTP Host header")
			}
			host, err = NormalizeHTTPHost(value)
			if err != nil {
				return "", "", err
			}
		}
	}
	return host, path, nil
}

// NormalizeHTTPPath canonicalizes one exact HTTP path selector without
// decoding percent escapes. Query strings are intentionally not part of route
// selection, and fragments are invalid in an HTTP request target.
func NormalizeHTTPPath(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		value = "/"
	}
	if !strings.HasPrefix(value, "/") || strings.ContainsAny(value, "\x00\r\n?#") {
		return "", fmt.Errorf("HTTP path %q must be an exact absolute path without query, fragment or control characters", value)
	}
	parsed, err := url.ParseRequestURI(value)
	if err != nil {
		return "", fmt.Errorf("invalid HTTP path %q: %w", value, err)
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("HTTP path %q must not contain a query or fragment", value)
	}
	path := parsed.EscapedPath()
	if path == "" {
		path = "/"
	}
	return path, nil
}

// NormalizeHTTPHost canonicalizes an optional exact HTTP Host selector. DNS
// names are IDNA-normalized, IP literals are canonicalized, and an optional
// numeric port is stripped because the listener port is already fixed by the
// group.
func NormalizeHTTPHost(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	if strings.ContainsAny(value, "\x00\r\n") {
		return "", errors.New("HTTP Host contains control characters")
	}

	host := value
	if parsedHost, port, err := net.SplitHostPort(value); err == nil {
		if _, err := strconv.Atoi(port); err != nil {
			return "", fmt.Errorf("invalid HTTP Host port %q", port)
		}
		host = parsedHost
	} else if strings.HasPrefix(value, "[") && strings.HasSuffix(value, "]") {
		host = strings.Trim(value, "[]")
	}
	host = strings.TrimSpace(strings.TrimSuffix(host, "."))
	if host == "" {
		return "", errors.New("HTTP Host is empty")
	}
	if ip := net.ParseIP(strings.Trim(host, "[]")); ip != nil {
		return ip.String(), nil
	}
	ascii, err := idna.Lookup.ToASCII(host)
	if err != nil {
		return "", fmt.Errorf("invalid HTTP Host %q: %w", value, err)
	}
	ascii = strings.ToLower(strings.TrimSuffix(ascii, "."))
	if ascii == "" || len(ascii) > 253 {
		return "", fmt.Errorf("invalid HTTP Host %q", value)
	}
	return ascii, nil
}

func selectRoute(group Group, result classification) (Route, error) {
	canonical := group.canonical()
	switch result.kind {
	case classificationTLS:
		sni, err := NormalizeServerName(result.sni)
		if err != nil {
			return Route{}, err
		}
		if sni == "" {
			return Route{}, errors.New("TLS ClientHello does not contain SNI")
		}
		for _, route := range canonical.Routes {
			if route.Kind != KindTLSSNI {
				continue
			}
			for _, candidate := range route.SNI {
				if candidate == sni {
					return route, nil
				}
			}
		}
		return Route{}, fmt.Errorf("no shared-port route for SNI %q", sni)
	case classificationHTTP1:
		host, err := NormalizeHTTPHost(result.host)
		if err != nil {
			return Route{}, err
		}
		path := result.path
		var matched *Route
		for index := range canonical.Routes {
			route := &canonical.Routes[index]
			if route.Kind != KindHTTP1 || !containsString(route.Paths, path) {
				continue
			}
			if len(route.Hosts) > 0 && !containsString(route.Hosts, host) {
				continue
			}
			if matched != nil {
				return Route{}, fmt.Errorf("ambiguous HTTP route for host=%q path=%q", host, path)
			}
			copy := *route
			matched = &copy
		}
		if matched == nil {
			return Route{}, fmt.Errorf("no shared-port HTTP route for host=%q path=%q", host, path)
		}
		return *matched, nil
	case classificationHTTP2:
		for _, route := range canonical.Routes {
			if route.Kind == KindHTTP2 {
				return route, nil
			}
		}
		return Route{}, errors.New("no shared-port cleartext HTTP/2 route")
	case classificationRaw:
		for _, route := range canonical.Routes {
			if route.Kind == KindRaw {
				return route, nil
			}
		}
		return Route{}, errors.New("no shared-port raw fallback route")
	default:
		return Route{}, errors.New("unknown shared-port classification")
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
