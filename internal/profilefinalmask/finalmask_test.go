package profilefinalmask

import (
	"reflect"
	"testing"
)

func TestApplyExplicitKCPDefaultsOwnedLegacyMask(t *testing.T) {
	stream := map[string]any{
		"network": "kcp",
		"finalmask": map[string]any{
			"tcp": []any{map[string]any{"type": "sudoku"}},
		},
	}
	profile := map[string]any{"network": "kcp"}

	if err := Apply(stream, profile, "kcp"); err != nil {
		t.Fatal(err)
	}
	finalmask, _ := stream["finalmask"].(map[string]any)
	if _, inherited := finalmask["tcp"]; inherited {
		t.Fatalf("parent mask leaked into explicit profile: %#v", finalmask)
	}
	udp, _ := finalmask["udp"].([]any)
	if len(udp) != 1 || udp[0].(map[string]any)["type"] != MKCPLegacyType {
		t.Fatalf("unexpected mKCP default: %#v", finalmask)
	}
}

func TestApplySameTransportInheritsParentMask(t *testing.T) {
	parent := map[string]any{
		"udp": []any{map[string]any{"type": "salamander"}},
	}
	stream := map[string]any{"network": "kcp", "finalmask": parent}

	if err := Apply(stream, map[string]any{"network": "same"}, "kcp"); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(stream["finalmask"], parent) {
		t.Fatalf("same transport must retain parent inheritance: got %#v want %#v", stream["finalmask"], parent)
	}
}

func TestApplyExplicitObjectWins(t *testing.T) {
	profileMask := map[string]any{
		"udp": []any{map[string]any{"type": "salamander"}},
	}
	stream := map[string]any{
		"network": "kcp",
		"finalmask": map[string]any{
			"tcp": []any{map[string]any{"type": "sudoku"}},
		},
	}

	if err := Apply(stream, map[string]any{
		"network":   "kcp",
		"finalmask": profileMask,
	}, "kcp"); err != nil {
		t.Fatal(err)
	}
	finalmask := stream["finalmask"].(map[string]any)
	if _, inherited := finalmask["tcp"]; inherited {
		t.Fatalf("parent mask leaked into explicit object: %#v", finalmask)
	}
	finalmask["probe"] = true
	if _, mutated := profileMask["probe"]; mutated {
		t.Fatal("profile finalmask was not cloned")
	}
}

func TestApplyExplicitNullClearsWithoutDefault(t *testing.T) {
	stream := map[string]any{
		"network": "kcp",
		"finalmask": map[string]any{
			"udp": []any{map[string]any{"type": "salamander"}},
		},
	}

	if err := Apply(stream, map[string]any{
		"network":   "kcp",
		"finalmask": nil,
	}, "kcp"); err != nil {
		t.Fatal(err)
	}
	if _, exists := stream["finalmask"]; exists {
		t.Fatalf("explicit null did not clear finalmask: %#v", stream)
	}
}
