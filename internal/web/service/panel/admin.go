package panel

import (
	"errors"
	"strings"
	"github.com/google/uuid"
	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
)

type AdminService struct{}

func (s *AdminService) GetAllAdmins() ([]model.ResellerAdmin, error) {
	db := database.GetDB()
	var admins []model.ResellerAdmin
	// Sort by CreatedAt ASC so new admins appear at the bottom of the list.
	err := db.Order("created_at ASC").Find(&admins).Error
	
	if err == nil {
		for i := range admins {
			admin := &admins[i]
			var clientsCount int64
			db.Model(&model.ClientRecord{}).Where("created_by = ?", admin.Username).Count(&clientsCount)
			admin.ClientsCount = int(clientsCount)
			
			type trafficRow struct {
				Email string
				Up    int64
				Down  int64
			}
			var trafficRows []trafficRow
			db.Table("client_traffics").
				Select("client_traffics.email, client_traffics.up, client_traffics.down").
				Joins("JOIN clients ON clients.email = client_traffics.email").
				Where("clients.created_by = ?", admin.Username).
				Scan(&trafficRows)

			if len(trafficRows) > 0 {
				var emails []string
				trafficMap := make(map[string]*trafficRow, len(trafficRows))
				for j := range trafficRows {
					email := strings.ToLower(trafficRows[j].Email)
					emails = append(emails, trafficRows[j].Email)
					trafficMap[email] = &trafficRows[j]
				}

				type globalRow struct {
					Email string
					Up    int64
					Down  int64
				}
				var globalRows []globalRow
				if err := db.Table("client_global_traffics").
					Select("email, up, down").
					Where("email IN ?", emails).
					Scan(&globalRows).Error; err == nil {
					for _, g := range globalRows {
						emailKey := strings.ToLower(g.Email)
						if r, exists := trafficMap[emailKey]; exists {
							if g.Up > r.Up {
								r.Up = g.Up
							}
							if g.Down > r.Down {
								r.Down = g.Down
							}
						}
					}
				}
			}

			admin.TrafficUsedBytes = admin.DeletedTrafficBytes
			for _, r := range trafficRows {
				admin.TrafficUsedBytes += r.Up + r.Down
			}
		}
	}
	
	return admins, err
}

func (s *AdminService) AddAdmin(admin *model.ResellerAdmin) error {
	db := database.GetDB()

	// Reserved paths
	reserved := map[string]bool{
		"panel": true, "assets": true, "api": true, "login": true, "logout": true,
		"portal": true, "csrf-token": true, "getTwoFactorEnable": true,
	}
	if reserved[admin.WebPath] {
		return errors.New("this web_path is reserved and cannot be used")
	}

	// Check against master admin username
	var masterUser model.User
	if err := db.Where("LOWER(username) = LOWER(?)", admin.Username).First(&masterUser).Error; err == nil {
		return errors.New("username is already used by the master admin")
	}

	var count int64
	db.Model(&model.ResellerAdmin{}).Where("LOWER(username) = LOWER(?) OR web_path = ? OR remark = ?", admin.Username, admin.WebPath, admin.Remark).Count(&count)
	if count > 0 {
		return errors.New("admin with this username, web_path or remark already exists")
	}
	if admin.Id == "" {
		admin.Id = uuid.NewString()
	}
	return db.Create(admin).Error
}

func (s *AdminService) UpdateAdmin(admin *model.ResellerAdmin) error {
	db := database.GetDB()
	var existing model.ResellerAdmin
	if err := db.First(&existing, "id = ?", admin.Id).Error; err != nil {
		return err
	}
	// Check unique constraints except for self
	reserved := map[string]bool{
		"panel": true, "assets": true, "api": true, "login": true, "logout": true,
		"portal": true, "csrf-token": true, "getTwoFactorEnable": true,
	}
	if reserved[admin.WebPath] {
		return errors.New("this web_path is reserved and cannot be used")
	}

	var masterUser model.User
	if err := db.Where("LOWER(username) = LOWER(?)", admin.Username).First(&masterUser).Error; err == nil {
		return errors.New("username is already used by the master admin")
	}

	var count int64
	db.Model(&model.ResellerAdmin{}).Where("(LOWER(username) = LOWER(?) OR web_path = ? OR remark = ?) AND id != ?", admin.Username, admin.WebPath, admin.Remark, admin.Id).Count(&count)
	if count > 0 {
		return errors.New("admin with this username, web_path or remark already exists")
	}

	existing.Username = admin.Username
	existing.Remark = admin.Remark
	if admin.Password != "" {
		existing.Password = admin.Password
		existing.RawPassword = admin.RawPassword
	}
	existing.VolumeGB = admin.VolumeGB
	existing.Days = admin.Days
	existing.WebPath = admin.WebPath
	existing.Inbounds = admin.Inbounds
	existing.Enable = admin.Enable
	if admin.ExpiryTime != 0 {
		existing.ExpiryTime = admin.ExpiryTime
	}

	return db.Save(&existing).Error
}

func (s *AdminService) DeleteAdmin(id string) error {
	db := database.GetDB()
	return db.Delete(&model.ResellerAdmin{}, "id = ?", id).Error
}

func (s *AdminService) GetAdminByWebPath(webPath string) (*model.ResellerAdmin, error) {
	db := database.GetDB()
	var admin model.ResellerAdmin
	err := db.Where("web_path = ?", webPath).First(&admin).Error
	if err != nil {
		return nil, err
	}
	return &admin, nil
}

func (s *AdminService) GetAdminByUsername(username string) (*model.ResellerAdmin, error) {
	db := database.GetDB()
	var admin model.ResellerAdmin
	err := db.Where("LOWER(username) = LOWER(?)", username).First(&admin).Error
	if err != nil {
		return nil, err
	}
	return &admin, nil
}
