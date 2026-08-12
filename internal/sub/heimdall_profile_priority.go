package sub

import (
	"encoding/json"

	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
)

// inboundHasSubscriptionProfiles reports whether the inbound already carries
// Heimdall Multi-Profile / Subscription Profiles in streamSettings.externalProxy.
//
// Heimdall product rule:
//   - Subscription Profiles are the primary, product-facing multi-output feature.
//   - Managed Hosts are only a compatibility/fallback layer.
//   - Therefore Hosts must not override an inbound that already has profiles.
func inboundHasSubscriptionProfiles(inbound *model.Inbound) bool {
	if inbound == nil || inbound.StreamSettings == "" {
		return false
	}

	var stream map[string]any
	if err := json.Unmarshal([]byte(inbound.StreamSettings), &stream); err != nil {
		return false
	}

	profiles, ok := stream["externalProxy"].([]any)
	return ok && len(profiles) > 0
}
