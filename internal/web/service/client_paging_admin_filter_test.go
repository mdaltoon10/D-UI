package service

import "testing"

func TestClientPageScopeAllowsOwnerFilterWithoutChangingActionScopes(t *testing.T) {
	scope := clientPageScope(ClientPageParams{
		Scope: ClientAccessScope{
			AdminID: 7,
			Mode:    ClientAccessOwn,
		},
		AllowOwnerFilter: true,
	})

	if scope.AdminID != 7 {
		t.Fatalf("AdminID = %d, want 7", scope.AdminID)
	}

	if scope.Mode != ClientAccessAll {
		t.Fatalf("Mode = %s, want %s", scope.Mode, ClientAccessAll)
	}
}

func TestRoleUserPermissionKeysAdminFilterAliases(t *testing.T) {
	keys := roleUserPermissionKeys("adminFilter")
	if len(keys) != 2 || keys[0] != "adminFilter" || keys[1] != "admin_filter" {
		t.Fatalf("roleUserPermissionKeys(adminFilter) = %#v", keys)
	}
}
