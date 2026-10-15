package service

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/web/runtime"
	"gorm.io/gorm"
)

const inboundFanoutConcurrency = 8

func addFanoutLimit(hasTunnel bool) int {
	if hasTunnel {
		return 1
	}
	return inboundFanoutConcurrency
}

func fanoutInboundResults[T any](ids []int, concurrency int, fn func(i int) T) ([]T, []error) {
	n := len(ids)
	if n == 0 {
		return nil, nil
	}
	if concurrency <= 0 {
		concurrency = 1
	}
	if concurrency > n {
		concurrency = n
	}

	results := make([]T, n)
	panics := make([]error, n)

	if concurrency == 1 {
		for i := 0; i < n; i++ {
			func(idx int) {
				defer func() {
					if r := recover(); r != nil {
						panics[idx] = fmt.Errorf("panic: %v", r)
					}
				}()
				results[idx] = fn(idx)
			}(i)
		}
		return results, panics
	}

	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	wg.Add(n)

	for i := 0; i < n; i++ {
		sem <- struct{}{}
		go func(idx int) {
			defer wg.Done()
			defer func() { <-sem }()
			defer func() {
				if r := recover(); r != nil {
					panics[idx] = fmt.Errorf("panic: %v", r)
				}
			}()
			results[idx] = fn(idx)
		}(i)
	}
	wg.Wait()
	return results, panics
}

func trimmedUniqueEmails(emails []string) []string {
	seen := make(map[string]struct{}, len(emails))
	clean := make([]string, 0, len(emails))
	for _, e := range emails {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		if _, ok := seen[e]; ok {
			continue
		}
		seen[e] = struct{}{}
		clean = append(clean, e)
	}
	return clean
}

func clientRecordsByEmail(db *gorm.DB, emails []string) (map[string]*model.ClientRecord, error) {
	if db == nil {
		db = database.GetDB()
	}
	var records []model.ClientRecord
	for _, batch := range chunkStrings(emails, sqlInChunk) {
		var rows []model.ClientRecord
		if err := db.Where("email IN ?", batch).Find(&rows).Error; err != nil {
			return nil, err
		}
		records = append(records, rows...)
	}
	recordsByEmail := make(map[string]*model.ClientRecord, len(records))
	for i := range records {
		recordsByEmail[records[i].Email] = &records[i]
	}
	return recordsByEmail, nil
}

func sortedInboundIds[V any](m map[int]V) []int {
	ids := make([]int, 0, len(m))
	for id := range m {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	return ids
}

func commitInboundClientSettings(tx *gorm.DB, inbound *model.Inbound, prevSettings string) error {
	if prevSettings != "" {
		res := tx.Model(&model.Inbound{}).Where("id = ? AND settings = ?", inbound.Id, prevSettings).Update("settings", inbound.Settings)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected > 0 {
			return nil
		}
	}
	return tx.Save(inbound).Error
}

func droppedClientNeedsRestart() bool {
	restart, _ := (&SettingService{}).GetRestartXrayOnClientDisable()
	return restart
}

func advancePushedInbound(rt runtime.Runtime, prevSettings, newSettings string, ib *model.Inbound) {
}

type inboundApply struct {
	id  int
	run func() (bool, error)
}

func fanoutInboundApplies(applies []inboundApply) (bool, error) {
	if len(applies) == 0 {
		return false, nil
	}
	needRestart := false
	var firstErr error
	for _, a := range applies {
		if a.run == nil {
			continue
		}
		nr, err := a.run()
		if nr {
			needRestart = true
		}
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return needRestart, firstErr
}
