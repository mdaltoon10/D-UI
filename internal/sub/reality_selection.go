package sub

import "strings"

// realityClientSelection returns the deterministic client-facing REALITY SNI
// and short ID for every subscription format. Explicit preferred values under
// realitySettings.settings win when they are valid for the configured list;
// otherwise the first non-empty configured value is used. Empty and malformed
// lists are handled safely and produce empty output instead of indexing a
// zero-length slice.
func realityClientSelection(realitySettings map[string]any) (serverName, shortID string) {
	if realitySettings == nil {
		return "", ""
	}
	clientSettings, _ := realitySettings["settings"].(map[string]any)
	serverName = preferredRealityListValue(
		realitySettings["serverNames"],
		stringValue(clientSettings["serverName"]),
	)
	shortID = preferredRealityListValue(
		realitySettings["shortIds"],
		stringValue(clientSettings["shortId"]),
	)
	return serverName, shortID
}

func preferredRealityListValue(rawList any, preferred string) string {
	values := nonEmptyStringValues(rawList)
	preferred = strings.TrimSpace(preferred)
	if preferred != "" {
		if len(values) == 0 {
			return preferred
		}
		for _, value := range values {
			if value == preferred {
				return preferred
			}
		}
	}
	if len(values) > 0 {
		return values[0]
	}
	return ""
}

func nonEmptyStringValues(value any) []string {
	var values []string
	switch typed := value.(type) {
	case []any:
		values = make([]string, 0, len(typed))
		for _, item := range typed {
			if text, ok := item.(string); ok {
				text = strings.TrimSpace(text)
				if text != "" {
					values = append(values, text)
				}
			}
		}
	case []string:
		values = make([]string, 0, len(typed))
		for _, text := range typed {
			text = strings.TrimSpace(text)
			if text != "" {
				values = append(values, text)
			}
		}
	}
	return values
}
