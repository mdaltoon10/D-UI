package profilefinalmask

import (
	"encoding/json"
	"fmt"
	"strings"
)

const MKCPLegacyType = "mkcp-legacy"

// DefaultMKCPLegacy returns a fresh compatibility mask for an explicit mKCP
// profile. Each caller receives an independent map that it may safely mutate.
func DefaultMKCPLegacy() map[string]any {
	return map[string]any{
		"udp": []any{
			map[string]any{
				"type": MKCPLegacyType,
				"settings": map[string]any{
					"header": "",
					"value":  "",
				},
			},
		},
	}
}

func normalizeNetwork(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "mkcp" {
		return "kcp"
	}
	return value
}

// ExplicitNetwork returns the transport explicitly owned by a profile. Blank
// and "same" deliberately preserve parent inheritance semantics.
func ExplicitNetwork(profile map[string]any) (string, bool) {
	if profile == nil {
		return "", false
	}
	raw, ok := profile["network"].(string)
	if !ok {
		return "", false
	}
	network := normalizeNetwork(raw)
	if network == "" || network == "same" {
		return "", false
	}
	return network, true
}

// Apply projects the profile-owned FinalMask onto an already cloned effective
// stream. An explicit transport first detaches from the parent's wrapper. An
// explicit profile object then wins; null intentionally clears all masks. An
// explicit mKCP profile with no finalmask receives mkcp-legacy so runtime and
// subscription output always use the same UDP wire format.
func Apply(stream, profile map[string]any, effectiveNetwork string) error {
	if stream == nil || profile == nil {
		return nil
	}

	_, ownsTransport := ExplicitNetwork(profile)
	if ownsTransport {
		delete(stream, "finalmask")
	}

	if raw, exists := profile["finalmask"]; exists {
		switch value := raw.(type) {
		case nil:
			delete(stream, "finalmask")
		case map[string]any:
			cloned, err := cloneMap(value)
			if err != nil {
				return fmt.Errorf("clone finalmask: %w", err)
			}
			stream["finalmask"] = cloned
		default:
			return fmt.Errorf("finalmask must be an object or null")
		}
		return nil
	}

	if ownsTransport && normalizeNetwork(effectiveNetwork) == "kcp" {
		stream["finalmask"] = DefaultMKCPLegacy()
	}
	return nil
}

func cloneMap(value map[string]any) (map[string]any, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	var cloned map[string]any
	if err := json.Unmarshal(data, &cloned); err != nil {
		return nil, err
	}
	if cloned == nil {
		cloned = map[string]any{}
	}
	return cloned, nil
}
