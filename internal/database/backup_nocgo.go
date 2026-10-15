//go:build !cgo

package database

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

func runSQLiteBackup(ctx context.Context, sourceConn *sql.Conn, dstPath string) error {
	escapedPath := strings.ReplaceAll(dstPath, "'", "''")
	_, err := sourceConn.ExecContext(ctx, fmt.Sprintf("VACUUM INTO '%s'", escapedPath))
	return err
}
