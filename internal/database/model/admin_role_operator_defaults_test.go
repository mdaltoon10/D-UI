package model

import (
	"encoding/json"
	"testing"
)

func mustDecodeRoleJSONForTest(t *testing.T, raw string) map[string]any {
	t.Helper()

	var out map[string]any
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		t.Fatalf("decode role json: %v", err)
	}
	return out
}

func requireMapForTest(t *testing.T, root map[string]any, key string) map[string]any {
	t.Helper()

	v, ok := root[key]
	if !ok {
		t.Fatalf("missing key %q in %#v", key, root)
	}
	m, ok := v.(map[string]any)
	if !ok {
		t.Fatalf("key %q is %T, want map[string]any", key, v)
	}
	return m
}

func requireMissingForTest(t *testing.T, root map[string]any, key string) {
	t.Helper()

	if _, ok := root[key]; ok {
		t.Fatalf("key %q should be absent in %#v", key, root)
	}
}

func TestOperatorDefaultPermissions(t *testing.T) {
	roles := DefaultAdminRoles()
	if len(roles) < 3 {
		t.Fatalf("expected built-in operator role")
	}

	operator := roles[2]
	if operator.Slug != AdminRoleSlugOperator {
		t.Fatalf("role[2] slug = %q, want %q", operator.Slug, AdminRoleSlugOperator)
	}

	perms := mustDecodeRoleJSONForTest(t, operator.PermissionsJSON)

	users := requireMapForTest(t, perms, "users")
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
			t.Fatalf("operator users.%s missing in %#v", action, users)
		}

		scope, ok := value.(map[string]any)
		if !ok {
			t.Fatalf("operator users.%s = %#v, want scoped own permission", action, value)
		}

		if scope["scope"] != float64(1) {
			t.Fatalf("operator users.%s scope = %#v, want own scope=1", action, scope["scope"])
		}
	}

	if users["create"] != true {
		t.Fatalf("operator users.create = %#v, want true", users["create"])
	}

	inbounds := requireMapForTest(t, perms, "inbounds")
	if inbounds["read_simple"] != true || len(inbounds) != 1 {
		t.Fatalf("operator inbounds permissions = %#v, want only read_simple=true", inbounds)
	}

	groups := requireMapForTest(t, perms, "groups")
	if groups["read_simple"] != true || len(groups) != 1 {
		t.Fatalf("operator groups permissions = %#v, want only read_simple=true", groups)
	}

	settings := requireMapForTest(t, perms, "settings")
	if settings["read_general"] != true || len(settings) != 1 {
		t.Fatalf("operator settings permissions = %#v, want only read_general=true", settings)
	}

	for _, key := range []string{"admins", "admin_roles", "roles", "nodes", "cores", "hosts", "outbounds", "routing", "system", "hwids"} {
		requireMissingForTest(t, perms, key)
	}
}

func TestOperatorDefaultFeatures(t *testing.T) {
	roles := DefaultAdminRoles()
	operator := roles[2]
	features := mustDecodeRoleJSONForTest(t, operator.FeaturesJSON)

	expected := map[string]any{
		"blockLimitedAdmins":          true,
		"disconnectUsersWhenLimited":  true,
		"disconnectUsersWhenDisabled": true,
		"useResetStrategy":            false,
		"useNextPlan":                 true,
		"can_use_reset_strategy":      false,
		"can_use_next_plan":           true,
	}

	for key, want := range expected {
		if got := features[key]; got != want {
			t.Fatalf("operator feature %s = %#v, want %#v; all=%#v", key, got, want, features)
		}
	}
}

func TestOperatorDefaultKeepsLimitsAndAccess(t *testing.T) {
	roles := DefaultAdminRoles()
	operator := roles[2]

	var limits map[string]any
	if err := json.Unmarshal([]byte(operator.LimitsJSON), &limits); err != nil {
		t.Fatalf("decode limits: %v", err)
	}
	if _, ok := limits["maxUsers"]; !ok {
		t.Fatalf("operator limits changed unexpectedly: %#v", limits)
	}

	access := mustDecodeRoleJSONForTest(t, operator.AccessJSON)
	if access["allowAllGroups"] != true {
		t.Fatalf("operator access changed unexpectedly: %#v", access)
	}
}
