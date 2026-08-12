package service

import (
	"encoding/json"
	"os"
	"strings"
)

const hiddenOutboundTagsEnv = "XUI_HIDDEN_OUTBOUND_TAGS"

func hiddenOutboundTagRules() []string {
	raw := os.Getenv(hiddenOutboundTagsEnv)
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	rules := make([]string, 0, len(parts))

	for _, part := range parts {
		rule := strings.TrimSpace(part)
		if rule != "" {
			rules = append(rules, rule)
		}
	}

	return rules
}

func IsHiddenOutboundTag(tag string) bool {
	tag = strings.TrimSpace(tag)
	if tag == "" {
		return false
	}

	for _, rule := range hiddenOutboundTagRules() {
		if rule == tag {
			return true
		}

		if strings.HasSuffix(rule, "*") {
			prefix := strings.TrimSuffix(rule, "*")
			if prefix != "" && strings.HasPrefix(tag, prefix) {
				return true
			}
		}
	}

	return false
}

func outboundTagFromAny(outbound any) string {
	if outbound == nil {
		return ""
	}

	if m, ok := outbound.(map[string]any); ok {
		if tag, ok := m["tag"].(string); ok {
			return tag
		}
		return ""
	}

	raw, err := json.Marshal(outbound)
	if err != nil {
		return ""
	}

	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return ""
	}

	if tag, ok := m["tag"].(string); ok {
		return tag
	}

	return ""
}

func filterVisibleOutboundObjects(outbounds []any) []any {
	if len(outbounds) == 0 || len(hiddenOutboundTagRules()) == 0 {
		return outbounds
	}

	visible := make([]any, 0, len(outbounds))

	for _, outbound := range outbounds {
		tag := outboundTagFromAny(outbound)
		if IsHiddenOutboundTag(tag) {
			continue
		}

		visible = append(visible, outbound)
	}

	return visible
}

func filterVisibleOutboundTags(tags []string) []string {
	if len(tags) == 0 || len(hiddenOutboundTagRules()) == 0 {
		return tags
	}

	visible := make([]string, 0, len(tags))

	for _, tag := range tags {
		if IsHiddenOutboundTag(tag) {
			continue
		}

		visible = append(visible, tag)
	}

	return visible
}

func FilterVisibleOutboundObjects(outbounds []any) []any {
	return filterVisibleOutboundObjects(outbounds)
}

func FilterVisibleOutboundTags(tags []string) []string {
	return filterVisibleOutboundTags(tags)
}

func FilterVisibleOutboundsInXraySetting(xraySetting string) string {
	if len(hiddenOutboundTagRules()) == 0 || strings.TrimSpace(xraySetting) == "" {
		return xraySetting
	}

	var cfg map[string]any
	if err := json.Unmarshal([]byte(xraySetting), &cfg); err != nil {
		return xraySetting
	}

	outbounds, ok := cfg["outbounds"].([]any)
	if !ok {
		return xraySetting
	}

	cfg["outbounds"] = filterVisibleOutboundObjects(outbounds)

	raw, err := json.Marshal(cfg)
	if err != nil {
		return xraySetting
	}

	return string(raw)
}

func MergeHiddenOutboundsIntoXraySetting(submittedSetting string, currentSetting string) (string, error) {
	if len(hiddenOutboundTagRules()) == 0 || strings.TrimSpace(submittedSetting) == "" || strings.TrimSpace(currentSetting) == "" {
		return submittedSetting, nil
	}

	var submitted map[string]any
	if err := json.Unmarshal([]byte(submittedSetting), &submitted); err != nil {
		return submittedSetting, err
	}

	var current map[string]any
	if err := json.Unmarshal([]byte(currentSetting), &current); err != nil {
		return submittedSetting, nil
	}

	currentOutbounds, _ := current["outbounds"].([]any)
	if len(currentOutbounds) == 0 {
		return submittedSetting, nil
	}

	submittedOutbounds, _ := submitted["outbounds"].([]any)

	hiddenBeforeTag := make(map[string][]any)
	hiddenTail := make([]any, 0)
	pendingHidden := make([]any, 0)

	for _, outbound := range currentOutbounds {
		tag := outboundTagFromAny(outbound)

		if IsHiddenOutboundTag(tag) {
			pendingHidden = append(pendingHidden, outbound)
			continue
		}

		if tag != "" && len(pendingHidden) > 0 {
			hiddenBeforeTag[tag] = append(hiddenBeforeTag[tag], pendingHidden...)
			pendingHidden = nil
		}
	}

	if len(pendingHidden) > 0 {
		hiddenTail = append(hiddenTail, pendingHidden...)
	}

	usedAnchors := make(map[string]bool)
	merged := make([]any, 0, len(submittedOutbounds)+len(currentOutbounds))

	for _, outbound := range submittedOutbounds {
		tag := outboundTagFromAny(outbound)

		if IsHiddenOutboundTag(tag) {
			continue
		}

		if tag != "" && !usedAnchors[tag] {
			if hiddenGroup, ok := hiddenBeforeTag[tag]; ok {
				merged = append(merged, hiddenGroup...)
				usedAnchors[tag] = true
			}
		}

		merged = append(merged, outbound)
	}

	for tag, hiddenGroup := range hiddenBeforeTag {
		if !usedAnchors[tag] {
			merged = append(merged, hiddenGroup...)
		}
	}

	merged = append(merged, hiddenTail...)

	submitted["outbounds"] = merged

	raw, err := json.Marshal(submitted)
	if err != nil {
		return submittedSetting, err
	}

	return string(raw), nil
}

func IsHiddenOutboundJSON(outboundJSON string) bool {
	if len(hiddenOutboundTagRules()) == 0 || strings.TrimSpace(outboundJSON) == "" {
		return false
	}

	var outbound map[string]any
	if err := json.Unmarshal([]byte(outboundJSON), &outbound); err != nil {
		return false
	}

	return IsHiddenOutboundTag(outboundTagFromAny(outbound))
}

// ContainsHiddenOutboundJSONList reports whether a JSON array submitted to the
// batch tester contains any outbound hidden by SECX visibility rules.
func ContainsHiddenOutboundJSONList(outboundsJSON string) bool {
	if len(hiddenOutboundTagRules()) == 0 || strings.TrimSpace(outboundsJSON) == "" {
		return false
	}

	var outbounds []any
	if err := json.Unmarshal([]byte(outboundsJSON), &outbounds); err != nil {
		return false
	}

	for _, outbound := range outbounds {
		if IsHiddenOutboundTag(outboundTagFromAny(outbound)) {
			return true
		}
	}

	return false
}
