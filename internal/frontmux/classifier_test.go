package frontmux

import (
	"bytes"
	"encoding/binary"
	"strings"
	"testing"
)

func clientHelloForSNI(serverName string, split bool) []byte {
	name := []byte(serverName)
	sniList := make([]byte, 3+len(name))
	sniList[0] = 0
	binary.BigEndian.PutUint16(sniList[1:3], uint16(len(name)))
	copy(sniList[3:], name)
	sniExtension := make([]byte, 4+2+len(sniList))
	binary.BigEndian.PutUint16(sniExtension[0:2], 0)
	binary.BigEndian.PutUint16(sniExtension[2:4], uint16(2+len(sniList)))
	binary.BigEndian.PutUint16(sniExtension[4:6], uint16(len(sniList)))
	copy(sniExtension[6:], sniList)

	body := make([]byte, 0, 128)
	body = append(body, 0x03, 0x03)
	body = append(body, make([]byte, 32)...)
	body = append(body, 0) // session id
	body = append(body, 0, 2, 0x13, 0x01)
	body = append(body, 1, 0)
	body = append(body, byte(len(sniExtension)>>8), byte(len(sniExtension)))
	body = append(body, sniExtension...)

	handshake := []byte{1, byte(len(body) >> 16), byte(len(body) >> 8), byte(len(body))}
	handshake = append(handshake, body...)
	if !split {
		return tlsRecord(handshake)
	}
	cut := len(handshake) / 2
	return append(tlsRecord(handshake[:cut]), tlsRecord(handshake[cut:])...)
}

func tlsRecord(payload []byte) []byte {
	record := []byte{0x16, 0x03, 0x01, byte(len(payload) >> 8), byte(len(payload))}
	return append(record, payload...)
}

func TestParseClientHelloSNI(t *testing.T) {
	for _, split := range []bool{false, true} {
		data := clientHelloForSNI("Grpc.Example.COM", split)
		got, complete, err := parseClientHelloSNI(data, 16384)
		if err != nil || !complete || got != "grpc.example.com" {
			t.Fatalf("split=%v got=%q complete=%v err=%v", split, got, complete, err)
		}
	}
}

func TestInspectPrefixHTTP1(t *testing.T) {
	data := []byte("GET /ws?token=x HTTP/1.1\r\nHost: WS.Example.com:443\r\nUpgrade: websocket\r\n\r\n")
	result, needMore, err := inspectPrefix(data, true, 16384)
	if err != nil || needMore {
		t.Fatalf("needMore=%v err=%v", needMore, err)
	}
	if result.kind != classificationHTTP1 || result.host != "ws.example.com" || result.path != "/ws" {
		t.Fatalf("result=%+v", result)
	}
}

func TestInspectPrefixRaw(t *testing.T) {
	result, needMore, err := inspectPrefix([]byte{0, 1, 2, 3}, true, 16384)
	if err != nil || needMore || result.kind != classificationRaw {
		t.Fatalf("result=%+v needMore=%v err=%v", result, needMore, err)
	}
}

func TestSelectRoutes(t *testing.T) {
	group := validPlan().Groups[0]
	tests := []struct {
		name   string
		input  classification
		route  string
		errSub string
	}{
		{name: "tls", input: classification{kind: classificationTLS, sni: "grpc.example.com"}, route: "grpc"},
		{name: "http", input: classification{kind: classificationHTTP1, host: "ws.example.com", path: "/ws"}, route: "ws"},
		{name: "raw", input: classification{kind: classificationRaw}, route: "raw"},
		{name: "unknown sni", input: classification{kind: classificationTLS, sni: "no.example.com"}, errSub: "no shared-port route"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := selectRoute(group, test.input)
			if test.errSub != "" {
				if err == nil || !strings.Contains(err.Error(), test.errSub) {
					t.Fatalf("route=%+v err=%v", got, err)
				}
				return
			}
			if err != nil || got.ID != test.route {
				t.Fatalf("route=%+v err=%v", got, err)
			}
		})
	}
}

func TestClientHelloParserWaitsForPartialRecord(t *testing.T) {
	data := clientHelloForSNI("x.example.com", false)
	for index := 1; index < len(data); index++ {
		_, complete, err := parseClientHelloSNI(data[:index], 16384)
		if err != nil {
			t.Fatalf("prefix %d: %v", index, err)
		}
		if complete {
			t.Fatalf("prefix %d unexpectedly complete", index)
		}
	}
}

func TestHTTP2Preface(t *testing.T) {
	for index := 1; index <= len(http2ClientPreface); index++ {
		result, needMore, err := inspectPrefix(http2ClientPreface[:index], false, 16384)
		if err != nil {
			t.Fatalf("prefix %d: %v", index, err)
		}
		if index < len(http2ClientPreface) && !needMore {
			t.Fatalf("prefix %d should need more", index)
		}
		if index == len(http2ClientPreface) && (needMore || result.kind != classificationHTTP2) {
			t.Fatalf("result=%+v needMore=%v", result, needMore)
		}
	}
}

func TestHTTP2PrefaceWithFollowingFrameInSameRead(t *testing.T) {
	settings := []byte{0, 0, 0, 4, 0, 0, 0, 0, 0}
	data := append(bytes.Clone(http2ClientPreface), settings...)

	result, needMore, err := inspectPrefix(data, true, 16384)
	if err != nil || needMore || result.kind != classificationHTTP2 {
		t.Fatalf("result=%+v needMore=%v err=%v", result, needMore, err)
	}
}

func TestParseHTTPRejectsDuplicateHost(t *testing.T) {
	_, _, err := parseHTTP1Selector([]byte("GET / HTTP/1.1\r\nHost: a\r\nHost: b\r\n\r\n"))
	if err == nil || !strings.Contains(err.Error(), "duplicate") {
		t.Fatalf("err=%v", err)
	}
}

func FuzzParseClientHelloSNI(f *testing.F) {
	f.Add(clientHelloForSNI("seed.example.com", false))
	f.Add([]byte{0x16, 0x03, 0x01, 0, 1, 0})
	f.Fuzz(func(t *testing.T, data []byte) {
		if len(data) > 65536 {
			t.Skip()
		}
		_, _, _ = parseClientHelloSNI(bytes.Clone(data), 65536)
	})
}

func TestInspectPrefixRejectsMalformedHTTPEvenWithRawFallback(t *testing.T) {
	data := []byte("GET / HTTP/1.1\r\nHost: a.example\r\nHost: b.example\r\n\r\n")
	_, needMore, err := inspectPrefix(data, true, 16384)
	if err == nil || needMore || !strings.Contains(err.Error(), "duplicate") {
		t.Fatalf("needMore=%v err=%v", needMore, err)
	}
}

func TestNormalizeHTTPSelectors(t *testing.T) {
	path, err := NormalizeHTTPPath("/caf%C3%A9")
	if err != nil || path != "/caf%C3%A9" {
		t.Fatalf("path=%q err=%v", path, err)
	}
	if _, err := NormalizeHTTPPath("/ws?route=1"); err == nil {
		t.Fatal("query-bearing selector must be rejected")
	}
	host, err := NormalizeHTTPHost("BÜCHER.Example:443")
	if err != nil || host != "xn--bcher-kva.example" {
		t.Fatalf("host=%q err=%v", host, err)
	}
}
