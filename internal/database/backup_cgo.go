//go:build cgo

package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/mattn/go-sqlite3"
)

func runSQLiteBackup(ctx context.Context, sourceConn *sql.Conn, dstPath string) error {
	destinationDB, err := sql.Open("sqlite3", dstPath)
	if err != nil {
		return err
	}
	defer destinationDB.Close()
	destinationConn, err := destinationDB.Conn(ctx)
	if err != nil {
		return err
	}
	defer destinationConn.Close()

	return sourceConn.Raw(func(sourceDriver any) error {
		source, ok := sourceDriver.(*sqlite3.SQLiteConn)
		if !ok {
			return fmt.Errorf("unexpected SQLite source connection type %T", sourceDriver)
		}
		return destinationConn.Raw(func(destinationDriver any) error {
			destination, ok := destinationDriver.(*sqlite3.SQLiteConn)
			if !ok {
				return fmt.Errorf("unexpected SQLite destination connection type %T", destinationDriver)
			}
			backup, err := destination.Backup("main", source, "main")
			if err != nil {
				return err
			}
			finished := false
			defer func() {
				if !finished {
					_ = backup.Finish()
				}
			}()
			for {
				done, err := backup.Step(backupSQLiteStepPages())
				if err != nil {
					return err
				}
				if done {
					finished = true
					return backup.Finish()
				}
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(10 * time.Millisecond):
				}
			}
		})
	})
}
