package profilevalidation

import (
	"fmt"
	"math"
	"strings"
)

func validateFinalMask(value any, number int, path string) error {
	if value == nil {
		return nil
	}
	settings, ok := value.(map[string]any)
	if !ok {
		return issue(number, path, "invalid_type", "must be an object or null")
	}
	for _, key := range []string{"tcp", "udp"} {
		raw, exists := settings[key]
		if !exists || raw == nil {
			continue
		}
		entries, ok := anySlice(raw)
		if !ok {
			return issue(number, path+"."+key, "invalid_type", "must be an array")
		}
		for index, rawEntry := range entries {
			entry, ok := rawEntry.(map[string]any)
			entryPath := fmt.Sprintf("%s.%s.%d", path, key, index)
			if !ok {
				return issue(number, entryPath, "invalid_type", "must be an object")
			}
			kind, ok := entry["type"].(string)
			if !ok || strings.TrimSpace(kind) == "" || containsControl(kind) {
				return issue(number, entryPath+".type", "invalid_value", "must be a non-empty mask type")
			}
			if rawSettings, exists := entry["settings"]; exists && rawSettings != nil {
				if _, ok := rawSettings.(map[string]any); !ok {
					return issue(number, entryPath+".settings", "invalid_type", "must be an object")
				}
			}
		}
	}
	quicValue, exists := settings["quicParams"]
	if !exists || quicValue == nil {
		return nil
	}
	quic, ok := quicValue.(map[string]any)
	if !ok {
		return issue(number, path+".quicParams", "invalid_type", "must be an object")
	}
	if err := optionalEnumAt(quic, "congestion", number, path+".quicParams", "reno", "bbr", "brutal", "force-brutal"); err != nil {
		return err
	}
	if err := optionalEnumAt(quic, "bbrProfile", number, path+".quicParams", "conservative", "standard", "aggressive"); err != nil {
		return err
	}
	if err := optionalBoolAt(quic, "debug", number, path+".quicParams"); err != nil {
		return err
	}
	if err := optionalBoolAt(quic, "disablePathMTUDiscovery", number, path+".quicParams"); err != nil {
		return err
	}
	for _, key := range []string{"brutalUp", "brutalDown"} {
		if value, exists := quic[key]; exists {
			switch typed := value.(type) {
			case string:
				if containsControl(typed) || len(typed) > 256 {
					return issue(number, path+".quicParams."+key, "invalid_value", "contains invalid characters or exceeds the size limit")
				}
			default:
				if v, err := integer(value); err != nil || v < 0 {
					return issue(number, path+".quicParams."+key, "invalid_value", "must be a bandwidth string or non-negative integer")
				}
			}
		}
	}
	for _, pair := range [][2]string{{"initStreamReceiveWindow", "maxStreamReceiveWindow"}, {"initConnectionReceiveWindow", "maxConnectionReceiveWindow"}} {
		var initial, maximum int64
		var hasInitial, hasMaximum bool
		if value, exists := quic[pair[0]]; exists {
			hasInitial = true
			initial, _ = integerOrZero(value)
			if _, err := integer(value); err != nil || initial < 16384 {
				return issue(number, path+".quicParams."+pair[0], "invalid_integer", "must be an integer of at least 16384")
			}
		}
		if value, exists := quic[pair[1]]; exists {
			hasMaximum = true
			maximum, _ = integerOrZero(value)
			if _, err := integer(value); err != nil || maximum < 16384 {
				return issue(number, path+".quicParams."+pair[1], "invalid_integer", "must be an integer of at least 16384")
			}
		}
		if hasInitial && hasMaximum && initial > maximum {
			return issue(number, path+".quicParams."+pair[1], "window_order", "must be greater than or equal to the initial window")
		}
	}
	for key, bounds := range map[string][2]int64{
		"maxIdleTimeout":     {4, 120},
		"keepAlivePeriod":    {2, 60},
		"maxIncomingStreams": {8, math.MaxInt32},
	} {
		if value, exists := quic[key]; exists {
			v, err := integer(value)
			if err != nil || v < bounds[0] || v > bounds[1] {
				return issue(number, path+".quicParams."+key, "invalid_integer", "is outside the supported range")
			}
		}
	}
	if hopValue, exists := quic["udpHop"]; exists && hopValue != nil {
		hop, ok := hopValue.(map[string]any)
		if !ok {
			return issue(number, path+".quicParams.udpHop", "invalid_type", "must be an object")
		}
		if value, exists := hop["ports"]; exists {
			if _, _, err := scalarRange(value, 1, 65535, false); err != nil {
				return issue(number, path+".quicParams.udpHop.ports", "invalid_range", "must be a port or port range between 1 and 65535")
			}
		}
		if value, exists := hop["interval"]; exists {
			if _, _, err := scalarRange(value, 1, math.MaxInt32, false); err != nil {
				return issue(number, path+".quicParams.udpHop.interval", "invalid_range", "must be a positive scalar or range")
			}
		}
	}
	return nil
}
