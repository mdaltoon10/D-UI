package dbtest

import (
	"testing"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
)

// InitDB initializes a temporary database for testing and registers cleanup.
func InitDB(t testing.TB, dbPath string) {
	t.Helper()
	if err := database.InitDB(dbPath); err != nil {
		t.Fatalf("dbtest.InitDB: %v", err)
	}
	t.Cleanup(func() {
		_ = database.CloseDB()
	})
}
