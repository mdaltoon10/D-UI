package panel

import (
	"reflect"
	"testing"
)

func TestNormalizeDelegatedAPITokenScopesAcceptsCustomPanelManage(t *testing.T) {
	scopes, err := normalizeDelegatedAPITokenScopes([]string{
		ApiTokenScopeCustomPanelManage,
		ApiTokenScopeClientsRead,
		ApiTokenScopeCustomPanelManage,
	})
	if err != nil {
		t.Fatalf("normalize scopes: %v", err)
	}
	want := []string{ApiTokenScopeClientsRead, ApiTokenScopeCustomPanelManage}
	if !reflect.DeepEqual(scopes, want) {
		t.Fatalf("scopes = %#v, want %#v", scopes, want)
	}
}
