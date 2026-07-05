package controller

import (
	"net/http"
	"strings"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/web/middleware"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service/panel"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service/tgbot"
	"github.com/mdaltoon10/D-UI/v3/internal/web/session"

	"github.com/gin-gonic/gin"
)

// APIController handles the main API routes for the d-ui panel, including inbounds and server management.
type APIController struct {
	BaseController
	inboundController     *InboundController
	serverController      *ServerController
	nodeController        *NodeController
	hostController        *HostController
	settingController     *SettingController
	xraySettingController *XraySettingController
	userService           panel.UserService
	apiTokenService       panel.ApiTokenService
	Tgbot                 tgbot.Tgbot
}

// NewAPIController creates a new APIController instance and initializes its routes.
func NewAPIController(g *gin.RouterGroup) *APIController {
	a := &APIController{}
	a.initRouter(g)
	return a
}

func (a *APIController) checkAPIAuth(c *gin.Context) {
	// A verified client certificate (a completed mTLS handshake) authenticates
	// the caller, equivalent to a valid bearer token. api_authed must be set so
	// the CSRF middleware lets cert-authed mutations through.
	if c.Request.TLS != nil && len(c.Request.TLS.VerifiedChains) > 0 {
		if u, err := a.userService.GetFirstUser(); err == nil {
			session.SetAPIAuthUser(c, u)
		}
		c.Set("api_authed", true)
		c.Next()
		return
	}
	auth := c.GetHeader("Authorization")
	if after, ok := strings.CutPrefix(auth, "Bearer "); ok {
		tok := after
		if a.apiTokenService.Match(tok) {
			if u, err := a.userService.GetFirstUser(); err == nil {
				session.SetAPIAuthUser(c, u)
			}
			c.Set("api_authed", true)
			c.Next()
			return
		}
	}
	if !session.IsLogin(c) {
		if c.GetHeader("X-Requested-With") == "XMLHttpRequest" {
			c.AbortWithStatus(http.StatusUnauthorized)
		} else {
			c.String(http.StatusNotFound, "404 Not Found")
		}
		return
	}

	if session.IsResellerLogin(c) {
		resellerId := session.GetLoginReseller(c)
		var admin model.ResellerAdmin
		if err := database.GetDB().Where("id = ? AND enable = ?", resellerId, true).First(&admin).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"success": false, "msg": "Reseller account is disabled or not found"})
			return
		}
		path := c.Request.URL.Path
		isAllowed := strings.Contains(path, "/panel/api/clients/") ||
			strings.HasSuffix(path, "/panel/api/inbounds/list") ||
			strings.HasSuffix(path, "/panel/api/inbounds/list/slim") ||
			strings.HasSuffix(path, "/panel/api/inbounds/options") ||
			strings.HasSuffix(path, "/panel/api/setting/defaultSettings") ||
			strings.HasSuffix(path, "/panel/api/setting/all") ||
			strings.HasSuffix(path, "/panel/api/server/status") ||
			strings.HasSuffix(path, "/panel/api/server/getPanelUpdateInfo") ||
			strings.HasSuffix(path, "/panel/api/server/getUpdateStatus") ||
			strings.HasSuffix(path, "/panel/api/server/xrayMetricsState") ||
			strings.HasSuffix(path, "/panel/api/server/xrayObservatory") ||
			strings.Contains(path, "/panel/api/server/xrayMetricsHistory/") ||
			strings.Contains(path, "/panel/api/server/xrayObservatoryHistory/") ||
			strings.Contains(path, "/panel/api/server/history/") ||
			strings.Contains(path, "/panel/api/server/xraylogs/") ||
			strings.Contains(path, "/panel/api/server/logs/") ||
			strings.HasSuffix(path, "/panel/api/server/getXrayVersion")

		if !isAllowed {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"success": false, "msg": "Reseller not authorized for this action"})
			return
		}
	}

	c.Next()
}

// initRouter sets up the API routes for inbounds, server, and other endpoints.
func (a *APIController) initRouter(g *gin.RouterGroup) {
	// Main API group
	api := g.Group("/panel/api")
	api.Use(a.checkAPIAuth)
	// Decode + verify the node config envelope (zstd + X-Config-Sha256) and
	// advertise support, before CSRF/handlers read the body.
	api.Use(middleware.ConfigEnvelopeMiddleware())
	api.Use(middleware.CSRFMiddleware())

	// Inbounds API
	inbounds := api.Group("/inbounds")
	a.inboundController = NewInboundController(inbounds)

	clients := api.Group("/clients")
	NewClientController(clients)
	NewGroupController(clients)

	// Server API
	server := api.Group("/server")
	a.serverController = NewServerController(server)

	// Nodes API — multi-panel management
	nodes := api.Group("/nodes")
	a.nodeController = NewNodeController(nodes)

	// Hosts API — per-inbound override endpoints for subscription links
	hosts := api.Group("/hosts")
	a.hostController = NewHostController(hosts)

	// Admins API
	admins := api.Group("/admins")
	NewAdminController(admins, a.inboundController.inboundService)

	// Settings + Xray config management live under the API surface too, so the
	// same API token drives them. Paths are /panel/api/setting/* and
	// /panel/api/xray/*.
	a.settingController = NewSettingController(api)
	a.xraySettingController = NewXraySettingController(api)

	// Extra routes
	api.POST("/backuptotgbot", a.BackuptoTgbot)
}

// BackuptoTgbot sends a backup of the panel data to Telegram bot admins.
func (a *APIController) BackuptoTgbot(c *gin.Context) {
	a.Tgbot.SendBackupToAdmins()
}
