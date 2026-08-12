package runtime

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRemoteDeleteClientRecordUsesFullDeleteEndpoint(t *testing.T) {
	var paths []string
	var queries []string
	var methods []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		queries = append(queries, r.URL.RawQuery)
		methods = append(methods, r.Method)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"msg":"ok"}`))
	}))
	defer srv.Close()

	r := NewRemote(nodeForPlainServer(t, srv, "verify", "tok"), nil)
	if err := r.DeleteClientRecord(context.Background(), "gogoli1", false); err != nil {
		t.Fatalf("DeleteClient without traffic retention: %v", err)
	}
	if err := r.DeleteClientRecord(context.Background(), "gogoli1", true); err != nil {
		t.Fatalf("DeleteClient with traffic retention: %v", err)
	}

	if len(paths) != 2 {
		t.Fatalf("requests = %d, want 2", len(paths))
	}
	for i := range methods {
		if methods[i] != http.MethodPost {
			t.Fatalf("request %d method = %q, want POST", i, methods[i])
		}
		if paths[i] != "/panel/api/clients/del/gogoli1" {
			t.Fatalf("request %d path = %q", i, paths[i])
		}
	}
	if queries[0] != "" {
		t.Fatalf("default query = %q, want empty", queries[0])
	}
	if queries[1] != "keepTraffic=1" {
		t.Fatalf("keepTraffic query = %q, want keepTraffic=1", queries[1])
	}
}

func TestRemoteDeleteClientRecordIsIdempotentForMissingClient(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":false,"msg":"client not found"}`))
	}))
	defer srv.Close()

	r := NewRemote(nodeForPlainServer(t, srv, "verify", "tok"), nil)
	if err := r.DeleteClientRecord(context.Background(), "already-gone", false); err != nil {
		t.Fatalf("missing client must be an idempotent success: %v", err)
	}
}

func TestRemoteDeleteClientRecordsUsesBulkEndpoint(t *testing.T) {
	var gotPath, gotQuery, gotMethod string
	var gotBody map[string]any
	var decodeErr error
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotQuery = r.URL.RawQuery
		gotMethod = r.Method
		defer r.Body.Close()
		decodeErr = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"obj":{"deleted":2,"skipped":[]}}`))
	}))
	defer srv.Close()

	r := NewRemote(nodeForPlainServer(t, srv, "verify", "tok"), nil)
	if err := r.DeleteClientRecords(context.Background(), []string{"a@x", "b@x"}, true); err != nil {
		t.Fatalf("DeleteClients: %v", err)
	}
	if decodeErr != nil {
		t.Fatalf("decode request body: %v", decodeErr)
	}
	if gotMethod != http.MethodPost || gotPath != "/panel/api/clients/bulkDel" || gotQuery != "" {
		t.Fatalf("request = %s %s?%s", gotMethod, gotPath, gotQuery)
	}
	if keep, ok := gotBody["keepTraffic"].(bool); !ok || !keep {
		t.Fatalf("keepTraffic body = %#v", gotBody["keepTraffic"])
	}
	emails, ok := gotBody["emails"].([]any)
	if !ok || len(emails) != 2 {
		t.Fatalf("emails body = %#v", gotBody["emails"])
	}
}

func TestRemoteDeleteClientRecordsRejectsNonNotFoundSkip(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"obj":{"deleted":1,"skipped":[{"email":"b@x","reason":"database locked"}]}}`))
	}))
	defer srv.Close()

	r := NewRemote(nodeForPlainServer(t, srv, "verify", "tok"), nil)
	if err := r.DeleteClientRecords(context.Background(), []string{"a@x", "b@x"}, false); err == nil {
		t.Fatal("DeleteClients accepted a non-idempotent skipped result")
	}
}

func TestRemoteDeleteClientRuntimeContractDefaultsToNoTrafficRetention(t *testing.T) {
	var gotPath, gotQuery string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"msg":"ok"}`))
	}))
	defer srv.Close()

	r := NewRemote(nodeForPlainServer(t, srv, "verify", "tok"), nil)
	if err := r.DeleteClient(context.Background(), "runtime-contract"); err != nil {
		t.Fatalf("DeleteClient: %v", err)
	}
	if gotPath != "/panel/api/clients/del/runtime-contract" || gotQuery != "" {
		t.Fatalf("request = %s?%s", gotPath, gotQuery)
	}
}
