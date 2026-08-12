package sub

import "testing"

func TestRealityClientSelectionHandlesEmptyAndMalformedLists(t *testing.T) {
	tests := []struct {
		name     string
		settings map[string]any
		wantSNI  string
		wantSID  string
	}{
		{name: "nil"},
		{
			name: "empty arrays",
			settings: map[string]any{
				"serverNames": []any{},
				"shortIds":    []any{},
				"settings":    map[string]any{},
			},
		},
		{
			name: "malformed entries are ignored",
			settings: map[string]any{
				"serverNames": []any{nil, 42, "", " valid.example "},
				"shortIds":    []any{false, "", " abcd "},
				"settings":    map[string]any{},
			},
			wantSNI: "valid.example",
			wantSID: "abcd",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotSNI, gotSID := realityClientSelection(tt.settings)
			if gotSNI != tt.wantSNI || gotSID != tt.wantSID {
				t.Fatalf("selection = (%q, %q), want (%q, %q)", gotSNI, gotSID, tt.wantSNI, tt.wantSID)
			}
		})
	}
}

func TestRealityClientSelectionUsesValidPreferredValues(t *testing.T) {
	settings := map[string]any{
		"serverNames": []any{"first.example", "preferred.example"},
		"shortIds":    []any{"1111", "aabb"},
		"settings": map[string]any{
			"serverName": "preferred.example",
			"shortId":    "aabb",
		},
	}
	gotSNI, gotSID := realityClientSelection(settings)
	if gotSNI != "preferred.example" || gotSID != "aabb" {
		t.Fatalf("selection = (%q, %q), want preferred values", gotSNI, gotSID)
	}
}

func TestRealityClientSelectionFallsBackDeterministically(t *testing.T) {
	settings := map[string]any{
		"serverNames": []any{"first.example", "second.example"},
		"shortIds":    []any{"1111", "2222"},
		"settings": map[string]any{
			"serverName": "not-allowed.example",
			"shortId":    "ffff",
		},
	}
	for i := 0; i < 20; i++ {
		gotSNI, gotSID := realityClientSelection(settings)
		if gotSNI != "first.example" || gotSID != "1111" {
			t.Fatalf("iteration %d selection = (%q, %q), want deterministic first values", i, gotSNI, gotSID)
		}
	}
}

func TestApplyShareRealityParamsDoesNotIndexEmptyArrays(t *testing.T) {
	stream := map[string]any{
		"realitySettings": map[string]any{
			"serverNames": []any{},
			"shortIds":    []any{},
			"settings": map[string]any{
				"publicKey":   "public",
				"fingerprint": "chrome",
				"spiderX":     "/seed",
			},
		},
	}
	params := map[string]string{}
	applyShareRealityParams(stream, params, "client")
	if _, exists := params["sni"]; exists {
		t.Fatalf("unexpected sni for empty serverNames: %q", params["sni"])
	}
	if _, exists := params["sid"]; exists {
		t.Fatalf("unexpected sid for empty shortIds: %q", params["sid"])
	}
	if params["security"] != "reality" {
		t.Fatalf("security = %q, want reality", params["security"])
	}
}
