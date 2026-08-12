package profilevalidation

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

func optionalBool(object map[string]any, key string, number int) error {
	return optionalBoolAt(object, key, number, "")
}

func optionalBoolAt(object map[string]any, key string, number int, base string) error {
	value, exists := object[key]
	if !exists || value == nil {
		return nil
	}
	if _, ok := value.(bool); !ok {
		return issue(number, joinPath(base, key), "invalid_type", "must be a boolean")
	}
	return nil
}

func optionalEnum(object map[string]any, key string, number int, values ...string) error {
	return optionalEnumAt(object, key, number, "", values...)
}

func optionalEnumAt(object map[string]any, key string, number int, base string, values ...string) error {
	value, exists := object[key]
	if !exists || value == nil {
		return nil
	}
	text, ok := value.(string)
	if !ok {
		return issue(number, joinPath(base, key), "invalid_type", "must be a string")
	}
	for _, candidate := range values {
		if text == candidate {
			return nil
		}
	}
	return issue(number, joinPath(base, key), "invalid_enum", "contains an unsupported option")
}

func optionalSafeString(object map[string]any, key string, number, maxLength int) error {
	return optionalSafeStringAt(object, key, number, "", maxLength)
}

func optionalSafeStringAt(object map[string]any, key string, number int, base string, maxLength int) error {
	value, exists := object[key]
	if !exists || value == nil {
		return nil
	}
	text, ok := value.(string)
	if !ok {
		return issue(number, joinPath(base, key), "invalid_type", "must be a string")
	}
	if containsControl(text) || !utf8.ValidString(text) || len(text) > maxLength {
		return issue(number, joinPath(base, key), "invalid_string", "contains invalid characters or exceeds the size limit")
	}
	return nil
}

func optionalStringArray(object map[string]any, key string, number int, allowed map[string]bool, unique bool) error {
	return optionalStringArrayAt(object, key, number, "", allowed, unique)
}

func optionalStringArrayAt(object map[string]any, key string, number int, base string, allowed map[string]bool, unique bool) error {
	value, exists := object[key]
	if !exists || value == nil {
		return nil
	}
	values, ok := anySlice(value)
	if !ok {
		return issue(number, joinPath(base, key), "invalid_type", "must be a string array")
	}
	seen := make(map[string]struct{}, len(values))
	for _, raw := range values {
		text, ok := raw.(string)
		if !ok || containsControl(text) || len(text) > 65536 {
			return issue(number, joinPath(base, key), "invalid_string", "contains an invalid string value")
		}
		if allowed != nil && !allowed[text] {
			return issue(number, joinPath(base, key), "invalid_enum", "contains an unsupported option")
		}
		if unique {
			if _, exists := seen[text]; exists {
				return issue(number, joinPath(base, key), "duplicate_value", "contains duplicate values")
			}
			seen[text] = struct{}{}
		}
	}
	return nil
}

func integer(value any) (int64, error) {
	switch typed := value.(type) {
	case json.Number:
		return typed.Int64()
	case float64:
		if math.IsNaN(typed) || math.IsInf(typed, 0) || math.Trunc(typed) != typed || typed < math.MinInt64 || typed > math.MaxInt64 {
			return 0, fmt.Errorf("not an integer")
		}
		return int64(typed), nil
	case float32:
		value := float64(typed)
		if math.Trunc(value) != value {
			return 0, fmt.Errorf("not an integer")
		}
		return int64(value), nil
	case int:
		return int64(typed), nil
	case int64:
		return typed, nil
	case int32:
		return int64(typed), nil
	case uint:
		if uint64(typed) > math.MaxInt64 {
			return 0, fmt.Errorf("integer overflow")
		}
		return int64(typed), nil
	case uint64:
		if typed > math.MaxInt64 {
			return 0, fmt.Errorf("integer overflow")
		}
		return int64(typed), nil
	default:
		return 0, fmt.Errorf("not an integer")
	}
}

func integerOrZero(value any) (int64, error) {
	if value == nil {
		return 0, nil
	}
	return integer(value)
}

func scalarRange(value any, minimum, maximum int64, allowEmpty bool) (int64, int64, error) {
	if value == nil {
		if allowEmpty {
			return 0, 0, nil
		}
		return 0, 0, fmt.Errorf("empty")
	}
	if integerValue, err := integer(value); err == nil {
		if integerValue < minimum || integerValue > maximum {
			return 0, 0, fmt.Errorf("range")
		}
		return integerValue, integerValue, nil
	}
	text, ok := value.(string)
	if !ok {
		return 0, 0, fmt.Errorf("type")
	}
	text = strings.TrimSpace(text)
	if text == "" {
		if allowEmpty {
			return 0, 0, nil
		}
		return 0, 0, fmt.Errorf("empty")
	}
	parts := strings.Split(text, "-")
	if len(parts) > 2 || len(parts) == 0 {
		return 0, 0, fmt.Errorf("syntax")
	}
	from, err := strconv.ParseInt(strings.TrimSpace(parts[0]), 10, 64)
	if err != nil {
		return 0, 0, err
	}
	to := from
	if len(parts) == 2 {
		to, err = strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64)
		if err != nil {
			return 0, 0, err
		}
	}
	if from < minimum || to < from || to > maximum {
		return 0, 0, fmt.Errorf("range")
	}
	return from, to, nil
}

func containsControl(value string) bool {
	if !utf8.ValidString(value) {
		return true
	}
	for _, current := range value {
		if unicode.IsControl(current) {
			return true
		}
	}
	return false
}

func containsUnsafeHeaderValue(value string) bool {
	if !utf8.ValidString(value) {
		return true
	}
	for _, current := range value {
		// RFC 9110 permits horizontal tab in a field value but no other C0,
		// DEL or Unicode control character.
		if current != '\t' && unicode.IsControl(current) {
			return true
		}
	}
	return false
}

func anySlice(value any) ([]any, bool) {
	switch typed := value.(type) {
	case []any:
		return typed, true
	case []string:
		out := make([]any, len(typed))
		for index, item := range typed {
			out[index] = item
		}
		return out, true
	case []map[string]any:
		out := make([]any, len(typed))
		for index, item := range typed {
			out[index] = item
		}
		return out, true
	default:
		return nil, false
	}
}

func allowedSet(values ...string) map[string]bool {
	out := make(map[string]bool, len(values))
	for _, value := range values {
		out[value] = true
	}
	return out
}

func joinPath(base, key string) string {
	if base == "" {
		return key
	}
	return base + "." + key
}
