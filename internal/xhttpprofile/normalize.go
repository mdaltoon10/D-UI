package xhttpprofile

import "strings"

const (
	modeAuto      = "auto"
	modePacketUp  = "packet-up"
	modeStreamUp  = "stream-up"
	modeStreamOne = "stream-one"
)

// NormalizeClientSettings returns a shallow-cloned xHTTP settings map with
// mode- and toggle-inactive fields removed. Nested values are not mutated.
func NormalizeClientSettings(source map[string]any) map[string]any {
	settings := cloneMap(source)
	normalizeCommon(settings)
	return settings
}

// NormalizeRuntimeSettings applies the common cleanup and removes fields that
// belong only to an outbound/client configuration. A synthetic inbound should
// not persist them even when they exist in a subscription profile draft.
func NormalizeRuntimeSettings(source map[string]any) map[string]any {
	settings := NormalizeClientSettings(source)
	for _, key := range []string{
		"headers",
		"uplinkHTTPMethod",
		"scMinPostsIntervalMs",
		"uplinkChunkSize",
		"noGRPCHeader",
		"xmux",
	} {
		delete(settings, key)
	}
	return settings
}

func cloneMap(source map[string]any) map[string]any {
	if source == nil {
		return map[string]any{}
	}
	cloned := make(map[string]any, len(source))
	for key, value := range source {
		cloned[key] = value
	}
	return cloned
}

func normalizeCommon(settings map[string]any) {
	migrateLegacySessionFields(settings)
	mode := normalizedMode(settings["mode"])
	settings["mode"] = mode

	switch mode {
	case modeAuto:
		delete(settings, "scStreamUpServerSecs")
		delete(settings, "uplinkDataPlacement")
		delete(settings, "uplinkDataKey")
	case modePacketUp:
		delete(settings, "scStreamUpServerSecs")
		if !placementRequiresKey(settings["uplinkDataPlacement"]) {
			delete(settings, "uplinkDataKey")
		}
	case modeStreamUp:
		delete(settings, "scMaxEachPostBytes")
		delete(settings, "scMinPostsIntervalMs")
		delete(settings, "uplinkDataPlacement")
		delete(settings, "uplinkDataKey")
	case modeStreamOne:
		delete(settings, "scMaxEachPostBytes")
		delete(settings, "scMaxBufferedPosts")
		delete(settings, "scMinPostsIntervalMs")
		delete(settings, "scStreamUpServerSecs")
		delete(settings, "uplinkDataPlacement")
		delete(settings, "uplinkDataKey")
	}

	if mode != modePacketUp && strings.EqualFold(stringValue(settings["uplinkHTTPMethod"]), "GET") {
		delete(settings, "uplinkHTTPMethod")
	}

	if enabled, _ := settings["xPaddingObfsMode"].(bool); !enabled {
		for _, key := range []string{
			"xPaddingKey",
			"xPaddingHeader",
			"xPaddingPlacement",
			"xPaddingMethod",
		} {
			delete(settings, key)
		}
	}

	if !placementRequiresKey(settings["sessionIDPlacement"]) {
		delete(settings, "sessionIDKey")
	}
	if strings.TrimSpace(stringValue(settings["sessionIDTable"])) == "" {
		delete(settings, "sessionIDLength")
	}
	if !placementRequiresKey(settings["seqPlacement"]) {
		delete(settings, "seqKey")
	}

	delete(settings, "enableXmux")
}

func migrateLegacySessionFields(settings map[string]any) {
	if _, exists := settings["sessionIDPlacement"]; !exists {
		if value, legacyExists := settings["sessionPlacement"]; legacyExists {
			settings["sessionIDPlacement"] = value
		}
	}
	if _, exists := settings["sessionIDKey"]; !exists {
		if value, legacyExists := settings["sessionKey"]; legacyExists {
			settings["sessionIDKey"] = value
		}
	}
	delete(settings, "sessionPlacement")
	delete(settings, "sessionKey")
}

func normalizedMode(value any) string {
	switch strings.ToLower(strings.TrimSpace(stringValue(value))) {
	case modePacketUp:
		return modePacketUp
	case modeStreamUp:
		return modeStreamUp
	case modeStreamOne:
		return modeStreamOne
	default:
		return modeAuto
	}
}

func placementRequiresKey(value any) bool {
	switch strings.ToLower(strings.TrimSpace(stringValue(value))) {
	case "header", "cookie", "query":
		return true
	default:
		return false
	}
}

func stringValue(value any) string {
	text, _ := value.(string)
	return text
}
