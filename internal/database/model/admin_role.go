package model

import "encoding/json"

const (
	AdminStatusActive   = "active"
	AdminStatusDisabled = "disabled"

	AdminRoleSlugOwner         = "owner"
	AdminRoleSlugAdministrator = "administrator"
	AdminRoleSlugOperator      = "operator"
)

type AdminRole struct {
	Id              int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Name            string `json:"name" gorm:"uniqueIndex;not null"`
	Slug            string `json:"slug" gorm:"uniqueIndex;not null"`
	BuiltIn         bool   `json:"builtIn" gorm:"column:built_in;default:false"`
	OwnerRole       bool   `json:"ownerRole" gorm:"column:owner_role;default:false"`
	PermissionsJSON string `json:"permissions" gorm:"column:permissions;type:text"`
	LimitsJSON      string `json:"limits" gorm:"column:limits;type:text"`
	FeaturesJSON    string `json:"features" gorm:"column:features;type:text"`
	AccessJSON      string `json:"access" gorm:"column:access;type:text"`
	CreatedAt       int64  `json:"createdAt" gorm:"autoCreateTime:milli"`
	UpdatedAt       int64  `json:"updatedAt" gorm:"autoUpdateTime:milli"`
}

func (AdminRole) TableName() string { return "admin_roles" }

func DefaultAdminRoles() []AdminRole {
	return []AdminRole{
		{
			Name:            "owner",
			Slug:            AdminRoleSlugOwner,
			BuiltIn:         true,
			OwnerRole:       true,
			PermissionsJSON: mustRoleJSON(ownerPermissions()),
			LimitsJSON:      mustRoleJSON(defaultRoleLimits()),
			FeaturesJSON:    mustRoleJSON(defaultRoleFeatures()),
			AccessJSON:      mustRoleJSON(allowAllGroupsAccess()),
		},
		{
			Name:            "Administrator",
			Slug:            AdminRoleSlugAdministrator,
			BuiltIn:         true,
			OwnerRole:       false,
			PermissionsJSON: mustRoleJSON(administratorPermissions()),
			LimitsJSON:      mustRoleJSON(administratorLimits()),
			FeaturesJSON:    mustRoleJSON(administratorFeatures()),
			AccessJSON:      mustRoleJSON(administratorAccess()),
		},
		{
			Name:            "Operator",
			Slug:            AdminRoleSlugOperator,
			BuiltIn:         true,
			OwnerRole:       false,
			PermissionsJSON: mustRoleJSON(operatorPermissions()),
			LimitsJSON:      mustRoleJSON(defaultRoleLimits()),
			FeaturesJSON:    mustRoleJSON(operatorFeatures()),
			AccessJSON:      mustRoleJSON(allowAllGroupsAccess()),
		},
	}
}

func mustRoleJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func ownerPermissions() map[string]any {
	return map[string]any{
		"users": map[string]any{
			"view":               "all",
			"viewSimpleList":     "all",
			"create":             true,
			"update":             "all",
			"delete":             "all",
			"resetUsage":         "all",
			"revokeSubscription": "all",
			"setOwner":           "all",
			"activateNextPlan":   "all",
		},
		"admins": map[string]any{
			"view":       true,
			"viewSimple": true,
			"create":     true,
			"update":     true,
			"delete":     true,
			"resetUsage": true,
		},
		"roles": map[string]any{
			"view":       true,
			"viewSimple": true,
			"create":     true,
			"update":     true,
			"delete":     true,
		},
		"nodes": map[string]any{
			"view":           true,
			"viewSimple":     true,
			"create":         true,
			"update":         true,
			"delete":         true,
			"reconnect":      true,
			"updateCore":     true,
			"viewStatistics": true,
			"viewLogs":       true,
		},
		"cores": map[string]any{
			"view":       true,
			"viewSimple": true,
			"create":     true,
			"update":     true,
			"delete":     true,
		},
		"hosts": map[string]any{
			"view":   true,
			"create": true,
			"update": true,
		},
		"groups": map[string]any{
			"view":       true,
			"viewSimple": true,
			"create":     true,
			"update":     true,
			"delete":     true,
		},
		"settings": map[string]any{
			"view":        true,
			"viewGeneral": true,
			"update":      true,
		},
		"system": map[string]any{
			"view": true,
		},
	}
}

func administratorPermissions() map[string]any {
	return allRolePermissions()
}

func allRolePermissions() map[string]any {
	return map[string]any{
		"inbounds": map[string]any{
			"read":        true,
			"read_simple": true,
			"create":      true,
			"update":      true,
			"delete":      true,
			"reset_usage": true,
		},
		"users": map[string]any{
			"read":               map[string]any{"scope": 1},
			"read_simple":        map[string]any{"scope": 1},
			"create":             true,
			"update":             map[string]any{"scope": 1},
			"delete":             map[string]any{"scope": 1},
			"reset_usage":        map[string]any{"scope": 1},
			"revoke_sub":         map[string]any{"scope": 1},
			"set_owner":          map[string]any{"scope": 1},
			"activate_next_plan": map[string]any{"scope": 1},
			"admin_filter":       true,
		},
		"groups": map[string]any{
			"read":        true,
			"read_simple": true,
			"create":      true,
			"update":      true,
			"delete":      true,
		},
		"nodes": map[string]any{
			"read":        true,
			"read_simple": true,
			"create":      true,
			"update":      true,
			"delete":      true,
			"reconnect":   true,
			"update_core": true,
			"stats":       true,
			"logs":        true,
		},
		"admins": map[string]any{
			"read":        true,
			"read_simple": true,
			"create":      true,
			"update":      true,
			"delete":      true,
			"reset_usage": true,
		},
		"admin_roles": map[string]any{
			"read":        true,
			"read_simple": true,
			"create":      true,
			"update":      true,
			"delete":      true,
		},
		"outbounds": map[string]any{
			"read":   true,
			"create": true,
			"update": true,
			"delete": true,
		},
		"routing": map[string]any{
			"read":   true,
			"create": true,
			"update": true,
			"delete": true,
		},
		"settings": map[string]any{
			"read":         true,
			"read_general": true,
			"update":       true,
		},
		"cores": map[string]any{
			"read":        true,
			"read_simple": true,
			"create":      true,
			"update":      true,
			"delete":      true,
		},
		"hosts": map[string]any{
			"read":   true,
			"create": true,
			"update": true,
		},
		"system": map[string]any{
			"read": true,
		},
	}
}

func operatorPermissions() map[string]any {
	return map[string]any{
		"inbounds": map[string]any{
			"read_simple": true,
		},
		"users": map[string]any{
			"read":               map[string]any{"scope": 1},
			"read_simple":        map[string]any{"scope": 1},
			"create":             true,
			"update":             map[string]any{"scope": 1},
			"delete":             map[string]any{"scope": 1},
			"reset_usage":        map[string]any{"scope": 1},
			"revoke_sub":         map[string]any{"scope": 1},
			"set_owner":          map[string]any{"scope": 1},
			"activate_next_plan": map[string]any{"scope": 1},
		},
		"groups": map[string]any{
			"read_simple": true,
		},
		"settings": map[string]any{
			"read_general": true,
		},
	}
}

func operatorFeatures() map[string]any {
	return map[string]any{
		"blockLimitedAdmins":          true,
		"disconnectUsersWhenLimited":  true,
		"disconnectUsersWhenDisabled": true,
		"useResetStrategy":            false,
		"useNextPlan":                 true,
		"can_use_reset_strategy":      false,
		"can_use_next_plan":           true,
	}
}

func defaultRoleLimits() map[string]any {
	return map[string]any{
		"maxUsers":             nil,
		"minDataLimit":         nil,
		"maxDataLimit":         nil,
		"minExpireDays":        nil,
		"maxExpireDays":        nil,
		"minOnHoldTimeoutDays": nil,
		"maxOnHoldTimeoutDays": nil,
	}
}

func administratorLimits() map[string]any {
	return map[string]any{}
}

func defaultRoleFeatures() map[string]any {
	return map[string]any{
		"blockLimitedAdmins":          false,
		"disconnectUsersWhenLimited":  true,
		"disconnectUsersWhenDisabled": true,
		"useResetStrategy":            true,
		"useNextPlan":                 true,
	}
}

func administratorFeatures() map[string]any {
	return map[string]any{
		"blockLimitedAdmins":          true,
		"disconnectUsersWhenLimited":  true,
		"disconnectUsersWhenDisabled": true,
		"useResetStrategy":            true,
		"useNextPlan":                 true,
		"can_use_reset_strategy":      true,
		"can_use_next_plan":           true,
	}
}

func allowAllGroupsAccess() map[string]any {
	return map[string]any{
		"allowAllGroups": true,
		"allowedGroups":  []string{},
	}
}

func administratorAccess() map[string]any {
	return map[string]any{
		"allowed_inbound_ids": nil,
	}
}
