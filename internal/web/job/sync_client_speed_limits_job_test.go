package job

import (
	"encoding/json"
	"path/filepath"
	"testing"
)

func TestStrictestNonZeroLimit(t *testing.T) {
	tests := []struct {
		name     string
		current  int
		incoming int
		want     int
	}{
		{name: "both zero", current: 0, incoming: 0, want: 0},
		{name: "existing unlimited", current: 0, incoming: 20, want: 20},
		{name: "incoming unlimited", current: 20, incoming: 0, want: 20},
		{name: "incoming stricter", current: 20, incoming: 10, want: 10},
		{name: "existing stricter", current: 10, incoming: 20, want: 10},
		{name: "negative incoming", current: 10, incoming: -5, want: 10},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := strictestNonZeroLimit(test.current, test.incoming)
			if got != test.want {
				t.Fatalf(
					"strictestNonZeroLimit(%d, %d) = %d, want %d",
					test.current,
					test.incoming,
					got,
					test.want,
				)
			}
		})
	}
}

func TestNormalizeClientSpeedLimitRows(t *testing.T) {
	rows := []clientSpeedLimitRow{
		{
			Email:        " z@example.com ",
			UploadMbps:   20,
			DownloadMbps: 0,
		},
		{
			Email:        "z@example.com",
			UploadMbps:   10,
			DownloadMbps: 30,
		},
		{
			Email:        "a@example.com",
			UploadMbps:   0,
			DownloadMbps: 5,
		},
		{
			Email:        "",
			UploadMbps:   1,
			DownloadMbps: 1,
		},
		{
			Email:        "ignored@example.com",
			UploadMbps:   -1,
			DownloadMbps: 0,
		},
	}

	got := normalizeClientSpeedLimitRows(rows)

	if len(got) != 2 {
		t.Fatalf("normalized rows = %d, want 2", len(got))
	}

	if got[0].Email != "a@example.com" {
		t.Fatalf("first email = %q, want a@example.com", got[0].Email)
	}

	if got[0].UploadMbps != 0 || got[0].DownloadMbps != 5 {
		t.Fatalf("unexpected first limits: %+v", got[0])
	}

	if got[1].Email != "z@example.com" {
		t.Fatalf("second email = %q, want z@example.com", got[1].Email)
	}

	if got[1].UploadMbps != 10 || got[1].DownloadMbps != 30 {
		t.Fatalf("unexpected second limits: %+v", got[1])
	}
}

func TestBuildClientSpeedLimitsJSON(t *testing.T) {
	data, err := buildClientSpeedLimitsJSON([]clientSpeedLimitRow{
		{
			Email:        "speed@example.com",
			UploadMbps:   12,
			DownloadMbps: 34,
		},
	})
	if err != nil {
		t.Fatalf("build JSON: %v", err)
	}

	var payload clientSpeedLimitsFile
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("decode JSON: %v", err)
	}

	if payload.Version != 1 {
		t.Fatalf("version = %d, want 1", payload.Version)
	}

	limit, found := payload.Clients["speed@example.com"]
	if !found {
		t.Fatal("speed@example.com missing from JSON")
	}

	if limit.UploadMbps != 12 {
		t.Fatalf("uploadMbps = %d, want 12", limit.UploadMbps)
	}

	if limit.DownloadMbps != 34 {
		t.Fatalf("downloadMbps = %d, want 34", limit.DownloadMbps)
	}
}

func TestResolveClientSpeedLimitsPathFromEnvironment(t *testing.T) {
	configured := filepath.Join(
		t.TempDir(),
		"nested",
		"..",
		"client-speed-limits.json",
	)

	t.Setenv(clientSpeedLimitsPathEnv, configured)

	got := resolveClientSpeedLimitsPath()
	want := filepath.Clean(configured)

	if got != want {
		t.Fatalf("resolved path = %q, want %q", got, want)
	}
}
