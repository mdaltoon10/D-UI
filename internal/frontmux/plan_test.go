package frontmux

import (
	"strings"
	"testing"
)

func validPlan() Plan {
	return Plan{Groups: []Group{{
		ID:                 "inbound-1-tcp-443",
		Listen:             "0.0.0.0",
		Port:               443,
		ClassificationMS:   3000,
		MaxInspectBytes:    16384,
		MaxConcurrentConns: 4096,
		Routes: []Route{
			{ID: "raw", Backend: "127.64.1.1:31001", Network: "tcp", Security: "none", Kind: KindRaw},
			{ID: "ws", Backend: "127.64.1.2:31002", Network: "ws", Security: "none", Kind: KindHTTP1, Hosts: []string{"ws.example.com"}, Paths: []string{"/ws"}},
			{ID: "grpc", Backend: "127.64.1.3:31003", Network: "grpc", Security: "tls", Kind: KindTLSSNI, SNI: []string{"grpc.example.com"}},
		},
	}}}
}

func TestPlanValidate(t *testing.T) {
	if err := validPlan().Validate(); err != nil {
		t.Fatal(err)
	}
}

func TestPlanRejectsAmbiguousSNI(t *testing.T) {
	plan := validPlan()
	plan.Groups[0].Routes = append(plan.Groups[0].Routes, Route{
		ID: "xhttp", Backend: "127.64.1.4:31004", Network: "xhttp", Security: "reality", Kind: KindTLSSNI,
		SNI: []string{"GRPC.EXAMPLE.COM."},
	})
	if err := plan.Validate(); err == nil || !strings.Contains(err.Error(), "ambiguous") {
		t.Fatalf("error = %v, want ambiguous SNI", err)
	}
}

func TestPlanRejectsMultipleRawRoutes(t *testing.T) {
	plan := validPlan()
	plan.Groups[0].Routes = append(plan.Groups[0].Routes, Route{
		ID: "raw2", Backend: "127.64.1.4:31004", Network: "tcp", Security: "none", Kind: KindRaw,
	})
	if err := plan.Validate(); err == nil || !strings.Contains(err.Error(), "raw catch-all") {
		t.Fatalf("error = %v, want raw catch-all rejection", err)
	}
}

func TestPlanCanonicalEquality(t *testing.T) {
	left := validPlan()
	right := validPlan()
	right.Groups[0].Routes[1].Hosts = []string{"WS.EXAMPLE.COM.", "ws.example.com"}
	if !left.Equal(right) {
		t.Fatalf("plans should be canonically equal\nleft=%+v\nright=%+v", left.Canonical(), right.Canonical())
	}
}

func TestPlanRejectsBackendOverlappingPublicListener(t *testing.T) {
	plan := validPlan()
	plan.Groups[0].Listen = "127.64.1.1"
	plan.Groups[0].Port = 31001
	if err := plan.Validate(); err == nil || !strings.Contains(err.Error(), "overlaps public listener") {
		t.Fatalf("error = %v, want backend/public overlap rejection", err)
	}
}

func TestPlanCanonicalizesHTTPSelectors(t *testing.T) {
	plan := validPlan()
	plan.Groups[0].Routes[1].Hosts = []string{"BÜCHER.Example:443"}
	plan.Groups[0].Routes[1].Paths = []string{"/caf%C3%A9"}
	canonical := plan.Canonical()
	route := canonical.Groups[0].Routes[2] // canonical routes are sorted by ID: grpc, raw, ws
	if route.ID != "ws" || len(route.Hosts) != 1 || route.Hosts[0] != "xn--bcher-kva.example" {
		t.Fatalf("route = %+v", route)
	}
}
