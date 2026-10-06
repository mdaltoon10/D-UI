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

// DUIController is the main controller for the D-UI panel, serving the SPA shell.
type DUIController struct {
	BaseController
	adminService panel.AdminService
}

// NewXUIController creates a new DUIController and initializes its routes.
func NewXUIController(g *gin.RouterGroup) *DUIController {
	a := &DUIController{
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
func (a *DUIController) initRouter(g *gin.RouterGroup) {
	spaRoutes := []string{
		"/",
		"/inbounds",
		"/clients",
		"/groups",
		"/nodes",
		"/hosts",
		"/settings",
		"/xray",
		"/outbound",
		"/routing",
		"/api-docs",
		"/admin-access",
		"/clients-admin",
		"/authentication",
	}

	// Register routes under /panel/
	panelGroup := g.Group("/panel")
	panelGroup.Use(a.checkLogin)
	panelGroup.Use(middleware.CSRFMiddleware())

	for _, r := range spaRoutes {
		panelGroup.GET(r, a.panelSPA)
	}

	// Register routes under root base path as well (for direct SPA navigation without /panel prefix)
	for _, r := range spaRoutes {
		if r != "/" {
			g.GET(r, a.checkLogin, a.panelSPA)
		}
	}

	// SPA pages built by Vite don't have a server-rendered <meta name="csrf-token">,
	// so they fetch the session token via this endpoint at startup and replay it
	// on subsequent unsafe requests through axios.
	panelGroup.GET("/csrf-token", a.csrfToken)
}

// panelSPA serves the React SPA shell. Every GET under /panel/ that isn't an
// API endpoint returns the same index.html — React Router reads the URL and
// mounts the matching page on the client.
func (a *DUIController) panelSPA(c *gin.Context) {
	serveDistPage(c, "index.html")
}

// HandleNoRoutePanelSPA serves the React shell for client-side routes that were
// not explicitly registered in Gin. It intentionally runs from engine.NoRoute
// instead of a /panel/*path wildcard so explicit JSON/API routes keep their
// normal routing semantics.
func (a *DUIController) HandleNoRoutePanelSPA(c *gin.Context) bool {
	reqPath := c.Request.URL.Path
	if isStaticAssetPath(reqPath) {
		if idx := strings.Index(reqPath, "/assets/"); idx != -1 {
			serveDistAsset(c, reqPath[idx:])
			return true
		}
		return false
	}

	if !isPanelSPAFallbackRequest(c) {
		return false
	}

	basePath := c.GetString("base_path")
	if basePath == "" {
		basePath = "/"
	}

	// 1. Check if it's already been redirected by a reseller middleware/NoRoute
	if c.GetHeader("X-Reseller-Redirected") == "true" {
		if !isStaticAssetPath(reqPath) && !strings.Contains(reqPath, "/api/") && !strings.Contains(reqPath, "/ws") {
			if !session.IsLogin(c) {
				serveDistPage(c, "login.html")
			} else {
				a.panelSPA(c)
			}
			return true
		}
	}

	// 2. Check if this is a sub-path of a reseller (e.g. /Mamad/clients, /Mamad/panel/clients)
	resellerPath, ok := a.isResellerSubPath(c)
	if ok {
		c.Set("base_path", resellerPath)
		c.Set("is_reseller", true)
		basePath = resellerPath
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

				c.Set("base_path", correctBasePath)
				c.Set("is_reseller", true)

				if basePath != correctBasePath {
					suffix := ""
					if idx := strings.Index(reqPath, "/panel"); idx != -1 {
						suffix = reqPath[idx+len("/panel"):]
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
			parts := strings.Split(webPath, "/")
			webPath = parts[len(parts)-1]
			if err := db.Where("LOWER(web_path) = LOWER(?)", webPath).First(&admin).Error; err == nil {
				c.Set("IMPERSONATE_RESELLER_ID", admin.Id)
				c.Set("IMPERSONATE_RESELLER_USERNAME", admin.Username)
			}
		}
	}

	a.panelSPA(c)
	return true
}

func (a *DUIController) isResellerSubPath(c *gin.Context) (string, bool) {
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
	reserved := map[string]bool{
		"panel": true, "assets": true, "api": true, "login": true, "logout": true,
		"portal": true, "csrf-token": true, "getTwoFactorEnable": true, "ws": true, "sub": true,
	}
	if reserved[strings.ToLower(webPath)] {
		return "", false
	}

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

	// Don't serve SPA for static assets, API endpoints, WebSocket, or Subscriptions
	if isStaticAssetPath(reqPath) ||
		strings.Contains(reqPath, "/api/") ||
		strings.HasSuffix(reqPath, "/api") ||
		strings.Contains(reqPath, "/ws") ||
		strings.Contains(reqPath, "/sub/") ||
		strings.HasSuffix(reqPath, "/csrf-token") ||
		strings.Contains(reqPath, "/csrf-token/") ||
		strings.HasSuffix(reqPath, "/login") ||
		strings.HasSuffix(reqPath, "/logout") ||
		strings.HasSuffix(reqPath, "/getTwoFactorEnable") {
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
func (a *DUIController) csrfToken(c *gin.Context) {
	token, err := session.EnsureCSRFToken(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, entity.Msg{Success: false, Msg: err.Error()})
		return
	}
	c.JSON(http.StatusOK, entity.Msg{Success: true, Obj: token})
}
