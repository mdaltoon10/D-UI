package service

import (
	"strings"
	"time"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/logger"
	"github.com/mdaltoon10/D-UI/v3/internal/util/common"
	"github.com/mdaltoon10/D-UI/v3/internal/xray"

	"gorm.io/gorm"
)

func (s *ClientService) ResetTrafficByEmail(inboundSvc *InboundService, email string) (bool, error) {
	if email == "" {
		return false, common.NewError("client email is required")
	}
	rec, err := s.GetRecordByEmail(nil, email)
	if err != nil {
		return false, err
	}
	inboundIds, err := s.GetInboundIdsForRecord(rec.Id)
	if err != nil {
		return false, err
	}

	needRestart := false
	if !rec.Enable {
		updated := rec.ToClient()
		updated.Enable = true
		nr, uErr := s.Update(inboundSvc, rec.Id, *updated)
		if uErr != nil {
			logger.Warning("Failed to auto-enable client during traffic reset:", uErr)
		}
		if nr {
			needRestart = true
		}
	}

	if len(inboundIds) == 0 {
		if rErr := inboundSvc.ResetClientTrafficByEmail(email); rErr != nil {
			return false, rErr
		}
		return needRestart, nil
	}

	for _, ibId := range inboundIds {
		nr, rErr := inboundSvc.ResetClientTraffic(ibId, email)
		if rErr != nil {
			return needRestart, rErr
		}
		if nr {
			needRestart = true
		}
	}
	return needRestart, nil
}

func (s *ClientService) BulkResetTraffic(inboundSvc *InboundService, emails []string) (int, error) {
	if len(emails) == 0 {
		return 0, nil
	}
	seen := map[string]struct{}{}
	cleanEmails := make([]string, 0, len(emails))
	for _, e := range emails {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		if _, ok := seen[e]; ok {
			continue
		}
		seen[e] = struct{}{}
		cleanEmails = append(cleanEmails, e)
	}
	if len(cleanEmails) == 0 {
		return 0, nil
	}

	for _, e := range cleanEmails {
		rec, err := s.GetRecordByEmail(nil, e)
		if err == nil && !rec.Enable {
			updated := rec.ToClient()
			updated.Enable = true
			_, _ = s.Update(inboundSvc, rec.Id, *updated)
		}
	}

	affected := 0
	err := submitTrafficWrite(func() error {
		db := database.GetDB()
		return db.Transaction(func(tx *gorm.DB) error {
			if err := adjustGroupBaselinesForRemovedTraffic(tx, cleanEmails); err != nil {
				return err
			}
			for _, batch := range chunkStrings(cleanEmails, sqlInChunk) {
				res := tx.Model(xray.ClientTraffic{}).
					Where("email IN ?", batch).
					Updates(map[string]any{"enable": true, "up": 0, "down": 0})
				if res.Error != nil {
					return res.Error
				}
				affected += int(res.RowsAffected)
			}
			if err := clearGlobalTraffic(tx, cleanEmails...); err != nil {
				return err
			}
			for _, batch := range chunkStrings(cleanEmails, sqlInChunk) {
				if err := tx.Where("email IN ?", batch).Delete(&model.NodeClientTraffic{}).Error; err != nil {
					return err
				}
			}
			return nil
		})
	})
	if err != nil {
		return 0, err
	}
	return affected, nil
}

func (s *ClientService) ResetAllClientTraffics(inboundSvc *InboundService, id int) error {
	return submitTrafficWrite(func() error {
		return s.resetAllClientTrafficsLocked(id)
	})
}

func (s *ClientService) resetAllClientTrafficsLocked(id int) error {
	db := database.GetDB()
	now := time.Now().Unix() * 1000

	if err := db.Transaction(func(tx *gorm.DB) error {
		// client_traffics.inbound_id is stale: it reflects the inbound the row was
		// first inserted under and is never refreshed. Use the client_inbounds join
		// as the authoritative source for which emails belong to a given inbound.
		var resetEmails []string
		if id == -1 {
			if err := tx.Model(xray.ClientTraffic{}).Pluck("email", &resetEmails).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Table("client_inbounds ci").
				Select("c.email").
				Joins("JOIN clients c ON c.id = ci.client_id").
				Where("ci.inbound_id = ?", id).
				Pluck("c.email", &resetEmails).Error; err != nil {
				return err
			}
		}
		if len(resetEmails) == 0 {
			return nil
		}

		if err := adjustGroupBaselinesForRemovedTraffic(tx, resetEmails); err != nil {
			return err
		}

		result := tx.Model(xray.ClientTraffic{}).
			Where("email IN ?", resetEmails).
			Updates(map[string]any{"enable": true, "up": 0, "down": 0})

		if result.Error != nil {
			return result.Error
		}

		if err := clearGlobalTraffic(tx, resetEmails...); err != nil {
			return err
		}

		for _, batch := range chunkStrings(resetEmails, sqlInChunk) {
			if err := tx.Where("email IN ?", batch).Delete(&model.NodeClientTraffic{}).Error; err != nil {
				return err
			}
		}

		inboundWhereText := "id "
		if id == -1 {
			inboundWhereText += " > ?"
		} else {
			inboundWhereText += " = ?"
		}

		result = tx.Model(model.Inbound{}).
			Where(inboundWhereText, id).
			Update("last_traffic_reset_time", now)

		return result.Error
	}); err != nil {
		return err
	}
	return nil
}

func (s *ClientService) ResetAllTraffics(adminUsernames ...string) (bool, error) {
	adminUsername := ""
	if len(adminUsernames) > 0 {
		adminUsername = strings.TrimSpace(adminUsernames[0])
	}

	db := database.GetDB()
	if adminUsername == "*" || strings.EqualFold(adminUsername, "all") {
		res := db.Model(&xray.ClientTraffic{}).
			Where("1 = 1").
			Updates(map[string]any{"up": 0, "down": 0})
		if res.Error != nil {
			return false, res.Error
		}
		if err := db.Where("1 = 1").Delete(&model.ClientGlobalTraffic{}).Error; err != nil {
			return false, err
		}
		return res.RowsAffected > 0, nil
	}

	// Filter by CreatedBy to avoid crosstalk between main panel and reseller admins
	var records []model.ClientRecord
	query := db.Model(&model.ClientRecord{})
	if adminUsername == "" {
		query = query.Where("created_by = '' OR created_by IS NULL")
	} else {
		query = query.Where("LOWER(created_by) = LOWER(?)", adminUsername)
	}

	if err := query.Find(&records).Error; err != nil {
		return false, err
	}
	if len(records) == 0 {
		return false, nil
	}

	emails := make([]string, 0, len(records))
	for _, r := range records {
		if r.Email != "" {
			emails = append(emails, r.Email)
		}
	}
	if len(emails) == 0 {
		return false, nil
	}

	var rowsAffected int64
	for _, batch := range chunkStrings(emails, sqlInChunk) {
		res := db.Model(&xray.ClientTraffic{}).
			Where("email IN ?", batch).
			Updates(map[string]any{"up": 0, "down": 0})
		if res.Error != nil {
			return false, res.Error
		}
		rowsAffected += res.RowsAffected
		if err := db.Where("email IN ?", batch).Delete(&model.ClientGlobalTraffic{}).Error; err != nil {
			return false, err
		}
	}
	return rowsAffected > 0, nil
}
