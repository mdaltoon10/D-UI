package panel

import (
	"errors"
	"github.com/google/uuid"
	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
)

type AdminService struct{}

func (s *AdminService) GetAllAdmins() ([]model.ResellerAdmin, error) {
	db := database.GetDB()
	var admins []model.ResellerAdmin
	err := db.Find(&admins).Error
	
	if err == nil {
		for i := range admins {
			admin := &admins[i]
			var clientsCount int64
			db.Model(&model.ClientRecord{}).Where("created_by = ?", admin.Username).Count(&clientsCount)
			admin.ClientsCount = int(clientsCount)
			
			// Not calculating TrafficUsedBytes for now to keep it simple and performant,
			// or could do a query on xray_client_traffic.
			type trafficRow struct {
				Up   int64
				Down int64
			}
			var trafficRows []trafficRow
			db.Table("client_traffics").
				Select("client_traffics.up, client_traffics.down").
				Joins("JOIN client_records ON client_records.email = client_traffics.email").
				Where("client_records.created_by = ?", admin.Username).
				Scan(&trafficRows)
			for _, r := range trafficRows {
				admin.TrafficUsedBytes += r.Up + r.Down
			}
		}
	}
	
	return admins, err
}

func (s *AdminService) AddAdmin(admin *model.ResellerAdmin) error {
	db := database.GetDB()
	var count int64
	db.Model(&model.ResellerAdmin{}).Where("LOWER(username) = LOWER(?) OR web_path = ?", admin.Username, admin.WebPath).Count(&count)
	if count > 0 {
		return errors.New("admin with this username or web_path already exists")
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
	var count int64
	db.Model(&model.ResellerAdmin{}).Where("(LOWER(username) = LOWER(?) OR web_path = ?) AND id != ?", admin.Username, admin.WebPath, admin.Id).Count(&count)
	if count > 0 {
		return errors.New("admin with this username or web_path already exists")
	}

	existing.Username = admin.Username
	existing.Remark = admin.Remark
	if admin.Password != "" {
		existing.Password = admin.Password
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
