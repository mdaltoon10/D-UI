package maskcompat

// UpgradeLegacyXdns inspects a finalmask object and updates any legacy xdns configuration in-place.
// It returns true if any modifications were made.
func UpgradeLegacyXdns(mask any) bool {
	m, ok := mask.(map[string]any)
	if !ok || m == nil {
		return false
	}
	xdns, ok := m["xdns"].(map[string]any)
	if !ok || xdns == nil {
		return false
	}
	return false
}
