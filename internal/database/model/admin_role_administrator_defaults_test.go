package model

import (
	"encoding/json"
	"testing"
)

func TestAdministratorDefaultClientPermissionsOwnWithAdminFilter(t *testing.T) {
	var role *AdminRole
	for i := range DefaultAdminRoles() {
		candidate := DefaultAdminRoles()[i]
		if candidate.Slug == AdminRoleSlugAdministrator {
			role = &candidate
			break
		}
	}

	if role == nil {
		t.Fatal("administrator role not found")
	}

	var permissions map[string]any
	if err := json.Unmarshal([]byte(role.PermissionsJSON), &permissions); err != nil {
		t.Fatalf("decode permissions: %v", err)
	}

	users, ok := permissions["users"].(map[string]any)
	if !ok {
		t.Fatalf("users permissions missing in %#v", permissions)
	}

	for _, action := range []string{
		"read",
		"read_simple",
		"update",
		"delete",
		"reset_usage",
		"revoke_sub",
		"set_owner",
		"activate_next_plan",
	} {
		value, ok := users[action]
		if !ok {
			t.Fatalf("administrator users.%s missing in %#v", action, users)
		}

		scope, ok := value.(map[string]any)
		if !ok {
			t.Fatalf("administrator users.%s = %#v, want scoped own permission", action, value)
		}

		if scope["scope"] != float64(1) {
			t.Fatalf("administrator users.%s scope = %#v, want own scope=1", action, scope["scope"])
		}
	}

	if users["create"] != true {
		t.Fatalf("administrator users.create = %#v, want true", users["create"])
	}

	if users["admin_filter"] != true {
		t.Fatalf("administrator users.admin_filter = %#v, want true", users["admin_filter"])
	}
}
