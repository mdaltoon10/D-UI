package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/util/crypto"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service/panel"
)

type AdminController struct {
	BaseController
	adminService   panel.AdminService
	inboundService service.InboundService
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
}

func (a *AdminController) list(c *gin.Context) {
	admins, err := a.adminService.GetAllAdmins()
	if err != nil {
		jsonMsg(c, "Failed to get admins", err)
		return
	}

	// Convert Inbounds to array for frontend
	type AdminResp struct {
		Id               string   `json:"id"`
		Remark           string   `json:"remark"`
		Username         string   `json:"username"`
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
		Remark:     form.Remark,
		Username:   username,
		Password:   hashedPassword,
		VolumeGB:   form.VolumeGB,
		Days:       form.Days,
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
		Id:         form.Id,
		Remark:     form.Remark,
		Username:   username,
		Password:   password,
		VolumeGB:   form.VolumeGB,
		Days:       form.Days,
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
	
	err := a.adminService.DeleteAdmin(form.Id)
	jsonMsg(c, "Success", err)
}
