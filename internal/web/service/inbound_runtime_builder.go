package service

import (
	"encoding/json"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/xray"
	"gorm.io/gorm"
)

// buildInboundForLocalRuntime clones inbound and builds the local runtime payload:
// - injects fallbacks if applicable (VLESS/Trojan/HTTP/etc.)
// - strips disabled/depleted clients from settings for local xray/runtime
func (s *InboundService) buildInboundForLocalRuntime(db *gorm.DB, ib *model.Inbound) (*model.Inbound, error) {
	if ib == nil {
		return nil, nil
	}
	clone := *ib
	if db == nil {
		db = database.GetDB()
	}

	supportsFallbacks := true
	if clone.StreamSettings != "" {
		var streamMap map[string]any
		if err := json.Unmarshal([]byte(clone.StreamSettings), &streamMap); err == nil {
			if net, _ := streamMap["network"].(string); net == "ws" || net == "grpc" {
				supportsFallbacks = false
			}
		}
	}
	if supportsFallbacks && (clone.Protocol == model.VLESS || clone.Protocol == model.Trojan) {
		fallbacks, err := s.fallbackService.BuildFallbacksJSON(db, clone.Id)
		if err == nil && len(fallbacks) > 0 {
			var settingsMap map[string]any
			if clone.Settings == "" {
				settingsMap = make(map[string]any)
			} else {
				_ = json.Unmarshal([]byte(clone.Settings), &settingsMap)
			}
			if settingsMap == nil {
				settingsMap = make(map[string]any)
			}
			settingsMap["fallbacks"] = fallbacks
			if updatedSettings, err := json.Marshal(settingsMap); err == nil {
				clone.Settings = string(updatedSettings)
			}
		}
	}

	if clone.Settings != "" {
		var settingsMap map[string]any
		if err := json.Unmarshal([]byte(clone.Settings), &settingsMap); err == nil && settingsMap != nil {
			if rawClients, ok := settingsMap["clients"].([]any); ok && len(rawClients) > 0 {
				var disabledEmails map[string]struct{}
				var disabledRows []xray.ClientTraffic
				if err := db.Model(xray.ClientTraffic{}).
					Where("inbound_id = ? AND enable = ?", clone.Id, false).
					Select("email").
					Find(&disabledRows).Error; err == nil && len(disabledRows) > 0 {
					disabledEmails = make(map[string]struct{}, len(disabledRows))
					for _, row := range disabledRows {
						disabledEmails[row.Email] = struct{}{}
					}
				}

				keptClients := make([]any, 0, len(rawClients))
				for _, c := range rawClients {
					cm, ok := c.(map[string]any)
					if !ok {
						keptClients = append(keptClients, c)
						continue
					}
					email, _ := cm["email"].(string)
					enable, hasEnable := cm["enable"].(bool)
					if hasEnable && !enable {
						continue
					}
					if email != "" && disabledEmails != nil {
						if _, disabled := disabledEmails[email]; disabled {
							continue
						}
					}
					keptClients = append(keptClients, c)
				}
				settingsMap["clients"] = keptClients
				if updated, err := json.Marshal(settingsMap); err == nil {
					clone.Settings = string(updated)
				}
			}
		}
	}

	return &clone, nil
}

// buildInboundForNodePush clones inbound for pushing to a remote node:
// - keeps disabled/depleted clients intact so node knows about them
// - injects fallbacks if applicable
func (s *InboundService) buildInboundForNodePush(db *gorm.DB, ib *model.Inbound) (*model.Inbound, error) {
	if ib == nil {
		return nil, nil
	}
	clone := *ib
	if db == nil {
		db = database.GetDB()
	}

	supportsFallbacks := true
	if clone.StreamSettings != "" {
		var streamMap map[string]any
		if err := json.Unmarshal([]byte(clone.StreamSettings), &streamMap); err == nil {
			if net, _ := streamMap["network"].(string); net == "ws" || net == "grpc" {
				supportsFallbacks = false
			}
		}
	}
	if supportsFallbacks && (clone.Protocol == model.VLESS || clone.Protocol == model.Trojan) {
		fallbacks, err := s.fallbackService.BuildFallbacksJSON(db, clone.Id)
		if err == nil && len(fallbacks) > 0 {
			var settingsMap map[string]any
			if clone.Settings == "" {
				settingsMap = make(map[string]any)
			} else {
				_ = json.Unmarshal([]byte(clone.Settings), &settingsMap)
			}
			if settingsMap == nil {
				settingsMap = make(map[string]any)
			}
			settingsMap["fallbacks"] = fallbacks
			if updatedSettings, err := json.Marshal(settingsMap); err == nil {
				clone.Settings = string(updatedSettings)
			}
		}
	}

	return &clone, nil
}
