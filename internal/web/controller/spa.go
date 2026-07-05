package controller

import (
	"net/http"
	"path"
	"strings"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/web/entity"
	"github.com/mdaltoon10/D-UI/v3/internal/web/middleware"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service/panel"
	"github.com/mdaltoon10/D-UI/v3/internal/web/session"

	"github.com/gin-gonic/gin"
)

// XUIController is the main controller for the Daltoon-UI panel, serving the SPA shell.
type XUIController struct {
	BaseController
	adminService panel.AdminService
}

// NewXUIController creates a new XUIController and initializes its routes.
func NewXUIController(g *gin.RouterGroup) *XUIController {
	a := &XUIController{
		adminService: panel.AdminService{},
	}
	a.initRouter(g)
	return a
}

// initRouter sets up the main panel routes and initializes sub-controllers.
//
// The HTML routes all hand the same single-page-app shell (index.html) to the
// browser; React Router takes over and renders the correct page from the URL.
// The /panel/api, /panel/setting, /panel/xray sub-routers register POST/JSON
// endpoints on different paths and stay untouched by the shell handler.
func (a *XUIController) initRouter(g *gin.RouterGroup) {
	g = g.Group("/panel")
	g.Use(a.checkLogin)
	g.Use(middleware.CSRFMiddleware())

	g.GET("/", a.panelSPA)
	g.GET("/inbounds", a.panelSPA)
	g.GET("/clients", a.panelSPA)
	g.GET("/groups", a.panelSPA)
	g.GET("/nodes", a.panelSPA)
	g.GET("/settings", a.panelSPA)
	g.GET("/xray", a.panelSPA)
	g.GET("/outbound", a.panelSPA)
	g.GET("/routing", a.panelSPA)
	g.GET("/api-docs", a.panelSPA)

	// SPA pages built by Vite don't have a server-rendered <meta name="csrf-token">,
	// so they fetch the session token via this endpoint at startup and replay it
	// on subsequent unsafe requests through axios.
	g.GET("/csrf-token", a.csrfToken)
}

// panelSPA serves the React SPA shell. Every GET under /panel/ that isn't an
// API endpoint returns the same index.html — React Router reads the URL and
// mounts the matching page on the client.
func (a *XUIController) panelSPA(c *gin.Context) {
	serveDistPage(c, "index.html")
}

// HandleNoRoutePanelSPA serves the React shell for client-side routes that were
// not explicitly registered in Gin. It intentionally runs from engine.NoRoute
// instead of a /panel/*path wildcard so explicit JSON/API routes keep their
// normal routing semantics.
func (a *XUIController) HandleNoRoutePanelSPA(c *gin.Context) bool {
	reqPath := c.Request.URL.Path
	if isStaticAssetPath(reqPath) {
		if idx := strings.Index(reqPath, "/assets/"); idx != -1 {
			serveDistAsset(c, reqPath[idx:])
			return true
		}
	}
	basePath := c.GetString("base_path")
	if basePath == "" {
		basePath = "/"
	}

	// 1. Check if it's already been redirected by a reseller middleware/NoRoute
	if c.GetHeader("X-Reseller-Redirected") == "true" {
		if !isStaticAssetPath(reqPath) && !strings.Contains(reqPath, "/api/") && !strings.Contains(reqPath, "/ws/") {
			if !session.IsLogin(c) {
				serveDistPage(c, "login.html")
			} else {
				a.panelSPA(c)
			}
			return true
		}
	}

	// 3. Check if this is a sub-path of a reseller (e.g. /Mamad/clients)
	resellerPath, ok := a.isResellerSubPath(c)
	if ok {
		c.Set("base_path", resellerPath)
		c.Set("is_reseller", true)
		if !session.IsLogin(c) {
			if isAjax(c) {
				pureJsonMsg(c, http.StatusUnauthorized, false, I18nWeb(c, "pages.login.loginAgain"))
			} else {
				serveDistPage(c, "login.html")
			}
			c.Abort()
			return true
		}
		a.panelSPA(c)
		return true
	}

	if !isPanelSPAFallbackRequest(c) {
		return false
	}



	if !session.IsLogin(c) {
		if isAjax(c) {
			pureJsonMsg(c, http.StatusUnauthorized, false, I18nWeb(c, "pages.login.loginAgain"))
		} else {
			c.Header("Cache-Control", "no-store")
			c.Redirect(http.StatusTemporaryRedirect, c.GetString("base_path"))
		}
		c.Abort()
		return true
	}

	if resellerId := session.GetLoginReseller(c); resellerId != "" {
		db := database.GetDB()
		if db != nil {
			var admin model.ResellerAdmin
			if err := db.Where("id = ?", resellerId).First(&admin).Error; err == nil {
				settingService := service.SettingService{}
				mainBasePath, _ := settingService.GetBasePath()
				if mainBasePath == "" {
					mainBasePath = "/"
				}
				correctBasePath := "/"
				trimmedMain := strings.Trim(mainBasePath, "/")
				if trimmedMain != "" {
					correctBasePath += trimmedMain + "/"
				}
				correctBasePath += admin.WebPath + "/"
				if basePath != correctBasePath {
					suffix := ""
					if strings.HasPrefix(reqPath, "/panel") {
						suffix = strings.TrimPrefix(reqPath, "/panel")
					}
					c.Redirect(http.StatusTemporaryRedirect, correctBasePath+"panel"+suffix)
					return true
				}
			}
		}
	}

	// Impersonate the reseller if a master admin is visiting the reseller's panel
	if basePath != "/" && session.GetLoginUser(c) != nil {
		db := database.GetDB()
		if db != nil {
			var admin model.ResellerAdmin
			webPath := strings.Trim(basePath, "/")
			if err := db.Where("web_path = ?", webPath).First(&admin).Error; err == nil {
				c.Set("IMPERSONATE_RESELLER_ID", admin.Id)
				c.Set("IMPERSONATE_RESELLER_USERNAME", admin.Username)
			}
		}
	}

	a.panelSPA(c)
	return true
}

func (a *XUIController) isResellerSubPath(c *gin.Context) (string, bool) {
	reqPath := c.Request.URL.Path
	if reqPath == "/" || reqPath == "" {
		return "", false
	}
	segments := strings.Split(strings.Trim(reqPath, "/"), "/")
	if len(segments) < 1 {
		return "", false
	}

	settingService := service.SettingService{}
	mainBasePath, err := settingService.GetBasePath()
	if err != nil || mainBasePath == "" {
		mainBasePath = "/"
	}

	trimmedMain := strings.Trim(mainBasePath, "/")
	startIndex := 0
	if trimmedMain != "" && segments[0] == trimmedMain {
		startIndex = 1
	}

	if len(segments) <= startIndex {
		return "", false
	}

	// Check if segment at startIndex is a reseller
	webPath := segments[startIndex]
	admin, err := a.adminService.GetAdminByWebPath(webPath)
	if err != nil || admin == nil {
		return "", false
	}

	resellerBasePath := "/"
	if trimmedMain != "" {
		resellerBasePath += trimmedMain + "/"
	}
	resellerBasePath += admin.WebPath + "/"

	return resellerBasePath, true
}

func isPanelSPAFallbackRequest(c *gin.Context) bool {
	if c.Request.Method != http.MethodGet {
		return false
	}
	if !acceptsHTML(c.GetHeader("Accept")) {
		return false
	}

	reqPath := c.Request.URL.Path
	isReseller := c.GetBool("is_reseller")

	// If it's not a reseller path and doesn't start with /panel, don't serve SPA
	if !isReseller && !strings.HasPrefix(reqPath, "/panel") {
		return false
	}

	// Don't serve SPA for API/WS/Assets
	if isStaticAssetPath(reqPath) || strings.Contains(reqPath, "/api/") || strings.Contains(reqPath, "/ws/") {
		return false
	}

	return true
}

var staticAssetExts = map[string]struct{}{
	".js": {}, ".mjs": {}, ".cjs": {}, ".css": {}, ".map": {}, ".json": {},
	".png": {}, ".jpg": {}, ".jpeg": {}, ".gif": {}, ".svg": {}, ".ico": {},
	".webp": {}, ".avif": {}, ".woff": {}, ".woff2": {}, ".ttf": {}, ".eot": {},
	".otf": {}, ".wasm": {}, ".txt": {}, ".xml": {}, ".webmanifest": {},
}

func isStaticAssetPath(reqPath string) bool {
	ext := strings.ToLower(path.Ext(reqPath))
	if ext == "" {
		return false
	}
	_, ok := staticAssetExts[ext]
	return ok
}

func acceptsHTML(accept string) bool {
	if accept == "" {
		return true
	}
	accept = strings.ToLower(accept)
	return strings.Contains(accept, "text/html") || strings.Contains(accept, "*/*")
}

// csrfToken returns the session CSRF token to authenticated SPA clients.
// The endpoint is GET (a safe method) so it bypasses CSRFMiddleware itself,
// but checkLogin still gates the response — anonymous callers get 401/redirect.
func (a *XUIController) csrfToken(c *gin.Context) {
	token, err := session.EnsureCSRFToken(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, entity.Msg{Success: false, Msg: err.Error()})
		return
	}
	c.JSON(http.StatusOK, entity.Msg{Success: true, Obj: token})
}
