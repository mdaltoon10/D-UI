package model

import (
	"strings"
	"testing"
)

func TestClientInboundStatEmailDeterministic(t *testing.T) {
	a := ClientInboundStatEmail("Alice@Example.COM", 42)
	b := ClientInboundStatEmail(" alice@example.com ", 42)

	if a == "" || b == "" {
		t.Fatal("stat email must not be empty")
	}
	if a != b {
		t.Fatalf("stat email must normalize case/space: %q != %q", a, b)
	}
	if !strings.HasPrefix(a, ClientInboundStatEmailPrefix+"_42_") {
		t.Fatalf("unexpected prefix: %q", a)
	}
	if len(strings.TrimPrefix(a, ClientInboundStatEmailPrefix+"_42_")) != 16 {
		t.Fatalf("hash suffix must be 16 chars: %q", a)
	}
}

func TestRuntimeClientEmailForInboundSkipsWireGuard(t *testing.T) {
	wg := &Inbound{Id: 7, Protocol: WireGuard}
	if got := RuntimeClientEmailForInbound(wg, "wg-user"); got != "wg-user" {
		t.Fatalf("wireguard email must stay logical, got %q", got)
	}

	vless := &Inbound{Id: 7, Protocol: VLESS}
	if got := RuntimeClientEmailForInbound(vless, "vless-user"); got == "vless-user" {
		t.Fatalf("standard inbound email must be rewritten")
	}
}
