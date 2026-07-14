package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/util/crypto"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service/panel"
	"github.com/mdaltoon10/D-UI/v3/internal/web/session"
)

type AdminController struct {
	BaseController
	adminService   panel.AdminService
	inboundService service.InboundService
	clientService  service.ClientService
	xrayService    service.XrayService
}

func NewAdminController(g *gin.RouterGroup, inboundService service.InboundService) *AdminController {
	a := &AdminController{
		inboundService: inboundService,
	}
	a.initRouter(g)
	return a
}

func (a *AdminController) initRouter(g *gin.RouterGroup) {
	g.GET("/list", a.list)
	g.POST("/add", a.add)
	g.POST("/update", a.update)
	g.POST("/delete", a.delete)
	g.POST("/resetTraffic", a.resetTraffic)
	g.GET("/self", a.self)
	g.POST("/selfUpdate", a.selfUpdate)
}

func (a *AdminController) list(c *gin.Context) {
	admins, err := a.adminService.GetAllAdmins()
	if err != nil {
		jsonMsg(c, "Failed to get admins", err)
		return
	}

	// Filter out other admins if the user is a reseller
	isReseller := session.IsResellerLogin(c)
	resellerId := session.GetLoginReseller(c)
	if isReseller && resellerId != "" {
		filtered := make([]model.ResellerAdmin, 0)
		for _, ad := range admins {
			if ad.Id == resellerId {
				filtered = append(filtered, ad)
			}
		}
		admins = filtered
	}

	// Convert Inbounds to array for frontend
	type AdminResp struct {
		Id               string   `json:"id"`
		Remark           string   `json:"remark"`
		Username         string   `json:"username"`
		Password         string   `json:"password"`
		VolumeGB         int64    `json:"volumeGB"`
		Days             int      `json:"days"`
		WebPath          string   `json:"webPath"`
		Inbounds         []int    `json:"inbounds"`
		CreatedAt        int64    `json:"createdAt"`
		ExpiryTime       int64    `json:"expiryTime"`
		Enable           bool     `json:"enable"`
		ClientsCount     int      `json:"clientsCount"`
		TrafficUsedBytes int64    `json:"trafficUsedBytes"`
	}

	resp := make([]AdminResp, len(admins))
	for i, ad := range admins {
		var inbounds []int
		_ = json.Unmarshal([]byte(ad.Inbounds), &inbounds)
		if inbounds == nil {
			inbounds = []int{}
		}

		resp[i] = AdminResp{
			Id: ad.Id,
			Remark: ad.Remark,
			Username: ad.Username,
			Password: ad.RawPassword,
			VolumeGB: ad.VolumeGB,
			Days: ad.Days,
			WebPath: ad.WebPath,
			Inbounds: inbounds,
			CreatedAt: ad.CreatedAt,
			ExpiryTime: ad.ExpiryTime,
			Enable: ad.Enable,
			ClientsCount: ad.ClientsCount,
			TrafficUsedBytes: ad.TrafficUsedBytes,
		}
	}
	
	jsonObj(c, resp, nil)
}

type adminForm struct {
	Id         string  `json:"id"`
	Remark     string  `json:"remark"`
	Username   string  `json:"username"`
	Password   string  `json:"password"`
	VolumeGB   int64   `json:"volumeGB"`
	Days       int     `json:"days"`
	WebPath    string  `json:"webPath"`
	Inbounds   []int   `json:"inbounds"`
	Enable     bool    `json:"enable"`
}

func (a *AdminController) add(c *gin.Context) {
	var form adminForm
	if err := c.ShouldBindJSON(&form); err != nil {
		jsonMsg(c, "Invalid JSON", err)
		return
	}
	
	username := strings.TrimSpace(form.Username)
	webPath := strings.TrimSpace(form.WebPath)
	
	if username == "" {
		jsonMsg(c, "Username cannot be empty", errors.New("empty username"))
		return
	}
	if webPath == "" {
		jsonMsg(c, "Web path cannot be empty", errors.New("empty web path"))
		return
	}
	
	inbBytes, _ := json.Marshal(form.Inbounds)
	
	expiry := int64(0)
	if form.Days > 0 {
		expiry = time.Now().UnixMilli() + int64(form.Days)*24*3600*1000
	}
	
	hashedPassword, err := crypto.HashPasswordAsBcrypt(form.Password)
	if err != nil {
		pureJsonMsg(c, http.StatusOK, false, "Failed to hash password")
		return
	}

	admin := &model.ResellerAdmin{
		Remark:      form.Remark,
		Username:    username,
		Password:    hashedPassword,
		RawPassword: form.Password,
		VolumeGB:    form.VolumeGB,
		Days:        form.Days,
		WebPath:    webPath,
		Inbounds:   string(inbBytes),
		CreatedAt:  time.Now().UnixMilli(),
		ExpiryTime: expiry,
		Enable:     form.Enable,
	}
	
	err = a.adminService.AddAdmin(admin)
	if err != nil {
		jsonMsg(c, "Failed to create reseller admin", err)
		return
	}
	jsonMsg(c, "Admin created successfully", nil)
}

func (a *AdminController) update(c *gin.Context) {
	var form adminForm
	if err := c.ShouldBindJSON(&form); err != nil {
		jsonMsg(c, "Invalid JSON", err)
		return
	}
	
	username := strings.TrimSpace(form.Username)
	webPath := strings.TrimSpace(form.WebPath)
	
	if username == "" {
		jsonMsg(c, "Username cannot be empty", errors.New("empty username"))
		return
	}
	if webPath == "" {
		jsonMsg(c, "Web path cannot be empty", errors.New("empty web path"))
		return
	}
	
	inbBytes, _ := json.Marshal(form.Inbounds)
	
	expiry := int64(0)
	if form.Days > 0 {
		expiry = time.Now().UnixMilli() + int64(form.Days)*24*3600*1000
	}
	
	password := form.Password
	if password != "" {
		hashed, err := crypto.HashPasswordAsBcrypt(password)
		if err != nil {
			pureJsonMsg(c, http.StatusOK, false, "Failed to hash password")
			return
		}
		password = hashed
	}

	admin := &model.ResellerAdmin{
		Id:          form.Id,
		Remark:      form.Remark,
		Username:    username,
		Password:    password,
		RawPassword: form.Password,
		VolumeGB:    form.VolumeGB,
		Days:        form.Days,
		WebPath:    webPath,
		Inbounds:   string(inbBytes),
		ExpiryTime: expiry,
		Enable:     form.Enable,
	}
	
	err := a.adminService.UpdateAdmin(admin)
	if err != nil {
		jsonMsg(c, "Failed to update reseller admin", err)
		return
	}

	if admin.Enable {
		// Try to re-enable clients if admin is now enabled
		// This handles the "Turn back on when recharged/reset" request
		// It will only re-enable clients that were previously disabled
		_, _, err := a.inboundService.EnableClientsByCreator(nil, admin.Username)
		if err != nil {
			// Just log the error, don't fail the update
			// logger.Warning("Failed to re-enable clients for admin:", admin.Username, err)
		}
	} else {
		// Disable clients if admin is disabled
		_, _, err := a.inboundService.DisableClientsByCreator(nil, admin.Username)
		if err != nil {
			// Just log the error, don't fail the update
			// logger.Warning("Failed to disable clients for admin:", admin.Username, err)
		}
	}

	jsonMsg(c, "Admin updated successfully", nil)
}

func (a *AdminController) delete(c *gin.Context) {
	var form struct {
		Id string `json:"id"`
	}
	if err := c.ShouldBindJSON(&form); err != nil {
		jsonMsg(c, "Invalid JSON", err)
		return
	}
	
	// Get the admin username before deleting to clean up their clients
	db := database.GetDB()
	var admin model.ResellerAdmin
	if err := db.Where("id = ?", form.Id).First(&admin).Error; err == nil {
		var clients []model.ClientRecord
		if err := db.Where("created_by = ?", admin.Username).Find(&clients).Error; err == nil && len(clients) > 0 {
			emails := make([]string, 0, len(clients))
			for _, cl := range clients {
				if cl.Email != "" {
					emails = append(emails, cl.Email)
				}
			}
			if len(emails) > 0 {
				_, needRestart, _ := a.clientService.BulkDelete(&a.inboundService, emails, false)
				if needRestart {
					_ = a.xrayService.RestartXray(false)
				}
			}
		}
	}

	err := a.adminService.DeleteAdmin(form.Id)
	jsonMsg(c, "Success", err)
}

func (a *AdminController) resetTraffic(c *gin.Context) {
	var form struct {
		Id string `json:"id"`
	}
	if err := c.ShouldBindJSON(&form); err != nil {
		jsonMsg(c, "Invalid JSON", err)
		return
	}

	// Security check for resellers
	isReseller := session.IsResellerLogin(c)
	resellerId := session.GetLoginReseller(c)
	if isReseller && resellerId != form.Id {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"success": false, "msg": "Cannot reset traffic for another reseller"})
		return
	}

	db := database.GetDB()
	var admin model.ResellerAdmin
	if err := db.Where("id = ?", form.Id).First(&admin).Error; err != nil {
		jsonMsg(c, "Admin not found", err)
		return
	}

	// Reset the admin's traffic without resetting its clients
	var totalClientsTraffic int64
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

	for _, r := range trafficRows {
		totalClientsTraffic += r.Up + r.Down
	}

	// Offset the deleted traffic bytes to negative current clients traffic, so the sum becomes 0
	if err := db.Model(&admin).Update("deleted_traffic_bytes", -totalClientsTraffic).Error; err != nil {
		jsonMsg(c, "Failed to reset traffic", err)
		return
	}

	jsonMsg(c, "Traffic reset successfully", nil)
}

type selfUpdateForm struct {
	OldPassword     string `json:"oldPassword"`
	NewUsername     string `json:"newUsername"`
	NewPassword     string `json:"newPassword"`
	TwoFactorEnable *bool  `json:"twoFactorEnable"`
}

func (a *AdminController) self(c *gin.Context) {
	isReseller := session.IsResellerLogin(c)
	if isReseller {
		resellerId := session.GetLoginReseller(c)
		var admin model.ResellerAdmin
		if err := database.GetDB().Where("id = ?", resellerId).First(&admin).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Reseller admin not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "obj": admin})
		return
	}

	// It's the master admin
	masterUser := session.GetLoginUser(c)
	if masterUser == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Unauthorized"})
		return
	}

	// Wrap the master admin in a ResellerAdmin representation so the frontend is happy
	admin := model.ResellerAdmin{
		Id:       strconv.Itoa(masterUser.Id),
		Remark:   "Master Administrator",
		Username: masterUser.Username,
		Enable:   true,
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "obj": admin})
}

func (a *AdminController) selfUpdate(c *gin.Context) {
	var form selfUpdateForm
	if err := c.ShouldBindJSON(&form); err != nil {
		jsonMsg(c, "Invalid JSON", err)
		return
	}

	isReseller := session.IsResellerLogin(c)
	db := database.GetDB()

	if isReseller {
		resellerId := session.GetLoginReseller(c)
		var admin model.ResellerAdmin
		if err := db.Where("id = ?", resellerId).First(&admin).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Reseller admin not found"})
			return
		}

		// If modifying username or password, verify old password
		if form.NewUsername != "" || form.NewPassword != "" {
			if !crypto.CheckPasswordHash(admin.Password, form.OldPassword) {
				c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Incorrect current password"})
				return
			}
		}

		// Update username if requested
		if form.NewUsername != "" {
			newU := strings.TrimSpace(form.NewUsername)
			if newU == "" {
				c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Username cannot be empty"})
				return
			}
			// Check unique constraint
			var exists int64
			db.Model(&model.ResellerAdmin{}).Where("username = ? AND id <> ?", newU, admin.Id).Count(&exists)
			if exists > 0 {
				c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Username already in use"})
				return
			}
			admin.Username = newU
		}

		// Update password if requested
		if form.NewPassword != "" {
			newP := strings.TrimSpace(form.NewPassword)
			if len(newP) < 4 {
				c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Password must be at least 4 characters"})
				return
			}
			hashed, err := crypto.HashPasswordAsBcrypt(newP)
			if err != nil {
				c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Failed to hash password"})
				return
			}
			admin.Password = hashed
		}

		if err := db.Save(&admin).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Failed to update profile", "error": err.Error()})
			return
		}

		// Update session reseller username if changed
		if form.NewUsername != "" {
			_ = session.SetLoginReseller(c, admin.Id, admin.Username)
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "obj": admin})
		return
	}

	// Master Admin path
	masterUser := session.GetLoginUser(c)
	if masterUser == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Unauthorized"})
		return
	}

	// If modifying username or password, verify old password
	if form.NewUsername != "" || form.NewPassword != "" {
		if !crypto.CheckPasswordHash(masterUser.Password, form.OldPassword) {
			c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Incorrect current password"})
			return
		}
	}

	// Update username if requested
	if form.NewUsername != "" {
		newU := strings.TrimSpace(form.NewUsername)
		if newU == "" {
			c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Username cannot be empty"})
			return
		}
		// Check unique constraint in User table
		var exists int64
		db.Model(&model.User{}).Where("username = ? AND id <> ?", newU, masterUser.Id).Count(&exists)
		if exists > 0 {
			c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Username already in use"})
			return
		}
		masterUser.Username = newU
	}

	// Update password if requested
	if form.NewPassword != "" {
		newP := strings.TrimSpace(form.NewPassword)
		if len(newP) < 4 {
			c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Password must be at least 4 characters"})
			return
		}
		hashed, err := crypto.HashPasswordAsBcrypt(newP)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Failed to hash password"})
			return
		}
		masterUser.Password = hashed
	}

	if err := db.Save(masterUser).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "msg": "Failed to update profile", "error": err.Error()})
		return
	}

	// Update session
	_ = session.SetLoginUser(c, masterUser)

	// Wrap in ResellerAdmin representation for response
	admin := model.ResellerAdmin{
		Id:       strconv.Itoa(masterUser.Id),
		Remark:   "Master Administrator",
		Username: masterUser.Username,
		Enable:   true,
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "obj": admin})
}
