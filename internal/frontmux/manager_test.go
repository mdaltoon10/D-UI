package frontmux

import (
	"bufio"
	"bytes"
	"io"
	"net"
	"strconv"
	"sync"
	"testing"
	"time"
)

func freeTCPPort(t *testing.T) int {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}
	return port
}

type backendCapture struct {
	address string
	data    chan []byte
	close   func()
}

func startBackendCapture(t *testing.T) backendCapture {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	data := make(chan []byte, 1)
	var once sync.Once
	stop := make(chan struct{})
	go func() {
		conn, acceptErr := listener.Accept()
		if acceptErr != nil {
			return
		}
		defer conn.Close()
		_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		reader := bufio.NewReader(conn)
		proxyLine, readErr := reader.ReadString('\n')
		if readErr != nil {
			data <- []byte("READ_ERROR:" + readErr.Error())
			return
		}
		payload, _ := io.ReadAll(reader)
		data <- append([]byte(proxyLine), payload...)
		select {
		case <-stop:
		default:
		}
	}()
	return backendCapture{
		address: listener.Addr().String(),
		data:    data,
		close: func() {
			once.Do(func() {
				close(stop)
				_ = listener.Close()
			})
		},
	}
}

func TestManagerRoutesHTTPAndPreservesInspectedBytes(t *testing.T) {
	rawBackend := startBackendCapture(t)
	defer rawBackend.close()
	httpBackend := startBackendCapture(t)
	defer httpBackend.close()

	port := freeTCPPort(t)
	manager := NewManager(func(err error) { t.Log(err) })
	plan := Plan{Groups: []Group{{
		ID:                 "test-http",
		Listen:             "127.0.0.1",
		Port:               port,
		ClassificationMS:   1000,
		MaxInspectBytes:    16 * 1024,
		MaxConcurrentConns: 32,
		Routes: []Route{
			{ID: "raw", Backend: rawBackend.address, Network: "tcp", Security: "none", Kind: KindRaw},
			{ID: "ws", Backend: httpBackend.address, Network: "ws", Security: "none", Kind: KindHTTP1, Hosts: []string{"ws.example.com"}, Paths: []string{"/ws"}},
		},
	}}}
	if err := manager.Start(plan); err != nil {
		t.Fatal(err)
	}
	defer manager.Stop()

	request := []byte("GET /ws?token=1 HTTP/1.1\r\nHost: ws.example.com\r\nUpgrade: websocket\r\n\r\nbody")
	conn, err := net.DialTimeout(
		"tcp",
		net.JoinHostPort("127.0.0.1", strconv.Itoa(port)),
		time.Second,
	)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Write(request); err != nil {
		t.Fatal(err)
	}
	_ = conn.(*net.TCPConn).CloseWrite()
	_ = conn.Close()

	select {
	case captured := <-httpBackend.data:
		lineEnd := bytes.Index(captured, []byte("\r\n"))
		if lineEnd < 0 || !bytes.HasPrefix(captured, []byte("PROXY TCP4 ")) {
			t.Fatalf("missing PROXY v1 header: %q", captured)
		}
		if !bytes.Equal(captured[lineEnd+2:], request) {
			t.Fatalf("inspected bytes changed\n got: %q\nwant: %q", captured[lineEnd+2:], request)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("HTTP backend did not receive routed connection")
	}
}

func TestManagerRoutesCoalescedHTTP2PrefaceAndFrame(t *testing.T) {
	rawBackend := startBackendCapture(t)
	defer rawBackend.close()
	grpcBackend := startBackendCapture(t)
	defer grpcBackend.close()

	port := freeTCPPort(t)
	manager := NewManager(func(err error) { t.Log(err) })
	plan := Plan{Groups: []Group{{
		ID:                 "test-http2-coalesced",
		Listen:             "127.0.0.1",
		Port:               port,
		ClassificationMS:   1000,
		MaxInspectBytes:    4096,
		MaxConcurrentConns: 8,
		Routes: []Route{
			{ID: "raw", Backend: rawBackend.address, Network: "tcp", Security: "none", Kind: KindRaw},
			{ID: "grpc", Backend: grpcBackend.address, Network: "grpc", Security: "none", Kind: KindHTTP2},
		},
	}}}
	if err := manager.Start(plan); err != nil {
		t.Fatal(err)
	}
	defer manager.Stop()

	settings := []byte{0, 0, 0, 4, 0, 0, 0, 0, 0}
	payload := append(bytes.Clone(http2ClientPreface), settings...)
	conn, err := net.DialTimeout(
		"tcp",
		net.JoinHostPort("127.0.0.1", strconv.Itoa(port)),
		time.Second,
	)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Write(payload); err != nil {
		t.Fatal(err)
	}
	_ = conn.(*net.TCPConn).CloseWrite()
	_ = conn.Close()

	select {
	case captured := <-grpcBackend.data:
		lineEnd := bytes.Index(captured, []byte("\r\n"))
		if lineEnd < 0 || !bytes.HasPrefix(captured, []byte("PROXY TCP4 ")) {
			t.Fatalf("missing PROXY v1 header: %q", captured)
		}
		if !bytes.Equal(captured[lineEnd+2:], payload) {
			t.Fatalf("HTTP/2 payload changed\n got: %q\nwant: %q", captured[lineEnd+2:], payload)
		}
	case captured := <-rawBackend.data:
		t.Fatalf("coalesced HTTP/2 payload was routed to RAW: %q", captured)
	case <-time.After(3 * time.Second):
		t.Fatal("gRPC backend did not receive coalesced HTTP/2 connection")
	}
}

func TestManagerRoutesRawFallback(t *testing.T) {
	rawBackend := startBackendCapture(t)
	defer rawBackend.close()
	httpBackend := startBackendCapture(t)
	defer httpBackend.close()

	port := freeTCPPort(t)
	manager := NewManager(nil)
	plan := Plan{Groups: []Group{{
		ID:                 "test-raw",
		Listen:             "127.0.0.1",
		Port:               port,
		ClassificationMS:   1000,
		MaxInspectBytes:    4096,
		MaxConcurrentConns: 8,
		Routes: []Route{
			{ID: "raw", Backend: rawBackend.address, Network: "tcp", Security: "none", Kind: KindRaw},
			{ID: "ws", Backend: httpBackend.address, Network: "ws", Security: "none", Kind: KindHTTP1, Paths: []string{"/ws"}},
		},
	}}}
	if err := manager.Start(plan); err != nil {
		t.Fatal(err)
	}
	defer manager.Stop()

	payload := []byte{0, 1, 2, 3, 4, 5}
	conn, err := net.DialTimeout("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = conn.Write(payload)
	_ = conn.(*net.TCPConn).CloseWrite()
	_ = conn.Close()

	select {
	case captured := <-rawBackend.data:
		lineEnd := bytes.Index(captured, []byte("\r\n"))
		if lineEnd < 0 || !bytes.Equal(captured[lineEnd+2:], payload) {
			t.Fatalf("raw payload mismatch: %q", captured)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("raw backend did not receive routed connection")
	}
}

func TestManagerStopReleasesListenerForRestart(t *testing.T) {
	backendA := startBackendCapture(t)
	defer backendA.close()
	backendB := startBackendCapture(t)
	defer backendB.close()
	port := freeTCPPort(t)
	plan := Plan{Groups: []Group{{
		ID:                 "restart",
		Listen:             "127.0.0.1",
		Port:               port,
		ClassificationMS:   1000,
		MaxInspectBytes:    4096,
		MaxConcurrentConns: 8,
		Routes: []Route{
			{ID: "raw", Backend: backendA.address, Network: "tcp", Security: "none", Kind: KindRaw},
			{ID: "grpc", Backend: backendB.address, Network: "grpc", Security: "none", Kind: KindHTTP2},
		},
	}}}
	manager := NewManager(nil)
	if err := manager.Start(plan); err != nil {
		t.Fatal(err)
	}
	if err := manager.Stop(); err != nil {
		t.Fatal(err)
	}
	if err := manager.Start(plan); err != nil {
		t.Fatalf("listener was not released for restart: %v", err)
	}
	if err := manager.Stop(); err != nil {
		t.Fatal(err)
	}
}

func TestWriteProxyV1MixedFamiliesUsesUnknown(t *testing.T) {
	var buffer bytes.Buffer
	err := writeProxyV1(
		&buffer,
		&net.TCPAddr{IP: net.ParseIP("192.0.2.1"), Port: 1234},
		&net.TCPAddr{IP: net.ParseIP("2001:db8::1"), Port: 443},
	)
	if err != nil {
		t.Fatal(err)
	}
	if got := buffer.String(); got != "PROXY UNKNOWN\r\n" {
		t.Fatalf("header = %q", got)
	}
}

func TestManagerRoutesTLSByExactSNIAndPreservesClientHello(t *testing.T) {
	rawBackend := startBackendCapture(t)
	defer rawBackend.close()
	tlsBackend := startBackendCapture(t)
	defer tlsBackend.close()

	port := freeTCPPort(t)
	manager := NewManager(func(err error) { t.Log(err) })
	plan := Plan{Groups: []Group{{
		ID:                 "test-tls",
		Listen:             "127.0.0.1",
		Port:               port,
		ClassificationMS:   1000,
		MaxInspectBytes:    32 * 1024,
		MaxConcurrentConns: 32,
		Routes: []Route{
			{ID: "raw", Backend: rawBackend.address, Network: "tcp", Security: "none", Kind: KindRaw},
			{ID: "grpc", Backend: tlsBackend.address, Network: "grpc", Security: "tls", Kind: KindTLSSNI, SNI: []string{"grpc.example.com"}},
		},
	}}}
	if err := manager.Start(plan); err != nil {
		t.Fatal(err)
	}
	defer manager.Stop()

	clientHello := clientHelloForSNI("GRPC.EXAMPLE.COM", true)
	conn, err := net.DialTimeout("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Write(clientHello); err != nil {
		t.Fatal(err)
	}
	_ = conn.(*net.TCPConn).CloseWrite()
	_ = conn.Close()

	select {
	case captured := <-tlsBackend.data:
		lineEnd := bytes.Index(captured, []byte("\r\n"))
		if lineEnd < 0 || !bytes.HasPrefix(captured, []byte("PROXY TCP4 ")) {
			t.Fatalf("missing PROXY v1 header: %q", captured)
		}
		if !bytes.Equal(captured[lineEnd+2:], clientHello) {
			t.Fatalf("ClientHello changed during routing")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("TLS backend did not receive routed connection")
	}
}
