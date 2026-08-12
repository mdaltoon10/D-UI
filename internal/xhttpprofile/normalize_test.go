package xhttpprofile

import "testing"

func TestNormalizeClientSettingsModeCleanup(t *testing.T) {
	tests := []struct {
		name       string
		mode       string
		wantAbsent []string
		want       map[string]any
	}{
		{
			name: "auto",
			mode: modeAuto,
			wantAbsent: []string{
				"scStreamUpServerSecs",
				"uplinkDataPlacement",
				"uplinkDataKey",
			},
			want: map[string]any{
				"scMaxEachPostBytes":   "1024",
				"scMaxBufferedPosts":   float64(30),
				"scMinPostsIntervalMs": "50-150",
			},
		},
		{
			name: "packet-up",
			mode: modePacketUp,
			wantAbsent: []string{
				"scStreamUpServerSecs",
			},
			want: map[string]any{
				"uplinkDataPlacement": "header",
				"uplinkDataKey":       "x_data",
			},
		},
		{
			name: "stream-up",
			mode: modeStreamUp,
			wantAbsent: []string{
				"scMaxEachPostBytes",
				"scMinPostsIntervalMs",
				"uplinkDataPlacement",
				"uplinkDataKey",
			},
			want: map[string]any{
				"scMaxBufferedPosts":   float64(30),
				"scStreamUpServerSecs": "20-80",
			},
		},
		{
			name: "stream-one",
			mode: modeStreamOne,
			wantAbsent: []string{
				"scMaxEachPostBytes",
				"scMaxBufferedPosts",
				"scMinPostsIntervalMs",
				"scStreamUpServerSecs",
				"uplinkDataPlacement",
				"uplinkDataKey",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeClientSettings(map[string]any{
				"mode":                 tt.mode,
				"scMaxEachPostBytes":   "1024",
				"scMaxBufferedPosts":   float64(30),
				"scMinPostsIntervalMs": "50-150",
				"scStreamUpServerSecs": "20-80",
				"uplinkDataPlacement":  "header",
				"uplinkDataKey":        "x_data",
				"uplinkHTTPMethod":     "GET",
				"xPaddingObfsMode":     true,
				"xPaddingKey":          "x_padding",
				"xPaddingHeader":       "X-Padding",
				"xPaddingPlacement":    "header",
				"xPaddingMethod":       "tokenish",
				"sessionIDPlacement":   "header",
				"sessionIDKey":         "x_session",
				"sessionIDTable":       "Base62",
				"sessionIDLength":      "8-16",
				"seqPlacement":         "query",
				"seqKey":               "x_seq",
				"enableXmux":           true,
			})

			if got["mode"] != tt.mode {
				t.Fatalf("mode = %v, want %s", got["mode"], tt.mode)
			}
			for _, key := range tt.wantAbsent {
				if _, exists := got[key]; exists {
					t.Errorf("%s should be absent: %#v", key, got)
				}
			}
			for key, want := range tt.want {
				if got[key] != want {
					t.Errorf("%s = %#v, want %#v", key, got[key], want)
				}
			}
			if _, exists := got["enableXmux"]; exists {
				t.Error("enableXmux is UI-only and must be absent")
			}
			if tt.mode != modePacketUp {
				if _, exists := got["uplinkHTTPMethod"]; exists {
					t.Error("GET must not survive outside packet-up")
				}
			}
		})
	}
}

func TestNormalizeClientSettingsConditionalCleanup(t *testing.T) {
	got := NormalizeClientSettings(map[string]any{
		"mode":                modePacketUp,
		"xPaddingObfsMode":    false,
		"xPaddingKey":         "stale",
		"xPaddingHeader":      "stale",
		"xPaddingPlacement":   "header",
		"xPaddingMethod":      "tokenish",
		"sessionPlacement":    "path",
		"sessionKey":          "stale",
		"sessionIDTable":      "",
		"sessionIDLength":     "8-16",
		"seqPlacement":        "path",
		"seqKey":              "stale",
		"uplinkDataPlacement": "body",
		"uplinkDataKey":       "stale",
	})

	for _, key := range []string{
		"xPaddingKey",
		"xPaddingHeader",
		"xPaddingPlacement",
		"xPaddingMethod",
		"sessionIDKey",
		"sessionIDLength",
		"seqKey",
		"uplinkDataKey",
		"sessionPlacement",
		"sessionKey",
	} {
		if _, exists := got[key]; exists {
			t.Errorf("%s should be absent: %#v", key, got)
		}
	}
	if got["sessionIDPlacement"] != "path" {
		t.Fatalf("legacy session placement was not migrated: %#v", got)
	}
}

func TestNormalizeRuntimeSettingsStripsClientOnlyFields(t *testing.T) {
	got := NormalizeRuntimeSettings(map[string]any{
		"mode":                 modeAuto,
		"headers":              map[string]any{"User-Agent": "x"},
		"uplinkHTTPMethod":     "POST",
		"scMinPostsIntervalMs": "50-150",
		"uplinkChunkSize":      float64(4096),
		"noGRPCHeader":         true,
		"xmux":                 map[string]any{"maxConnections": float64(6)},
		"noSSEHeader":          true,
	})

	for _, key := range []string{
		"headers",
		"uplinkHTTPMethod",
		"scMinPostsIntervalMs",
		"uplinkChunkSize",
		"noGRPCHeader",
		"xmux",
	} {
		if _, exists := got[key]; exists {
			t.Errorf("runtime settings retained client-only %s: %#v", key, got)
		}
	}
	if got["noSSEHeader"] != true {
		t.Fatalf("server field noSSEHeader was lost: %#v", got)
	}
}
