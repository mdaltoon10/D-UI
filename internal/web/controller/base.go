// Package controller provides HTTP request handlers and controllers for the d-ui web management panel.
// It handles routing, authentication, and API endpoints for managing Xray inbounds, settings, and more.
package controller

import (
	"net/http"
	"strings"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/logger"
	"github.com/mdaltoon10/D-UI/v3/internal/web/locale"
	"github.com/mdaltoon10/D-UI/v3/internal/web/session"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service"

	"github.com/gin-gonic/gin"
)

// BaseController provides common functionality for all controllers, including authentication checks.
type BaseController struct{}

// checkLogin is a middleware that verifies user authentication and handles unauthorized access.
func (a *BaseController) checkLogin(c *gin.Context) {
	if !session.IsLogin(c) {
		if isAjax(c) {
			pureJsonMsg(c, http.StatusUnauthorized, false, I18nWeb(c, "pages.login.loginAgain"))
		} else {
			c.Header("Cache-Control", "no-store")
			c.Redirect(http.StatusTemporaryRedirect, c.GetString("base_path"))
		}
		c.Abort()
		return
	}

	// Enforce role-based path/base_path alignment
	if session.IsResellerLogin(c) {
		resellerId := session.GetLoginReseller(c)
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
				currentBasePath := c.GetString("base_path")
				if currentBasePath != correctBasePath {
					if isAjax(c) {
						pureJsonMsg(c, http.StatusForbidden, false, "Unauthorized context")
					} else {
						reqPath := c.Request.URL.Path
						suffix := ""
						if strings.HasPrefix(reqPath, "/panel") {
							suffix = strings.TrimPrefix(reqPath, "/panel")
						}
						c.Redirect(http.StatusTemporaryRedirect, correctBasePath+"panel"+suffix)
					}
					c.Abort()
					return
				}
			}
		}
	} else if session.GetLoginUser(c) != nil {
		// Master admin - check if they are visiting a reseller path to impersonate them
		currentBasePath := c.GetString("base_path")
		settingService := service.SettingService{}
		mainBasePath, err := settingService.GetBasePath()
		if err != nil || mainBasePath == "" {
			mainBasePath = "/"
		}
		if currentBasePath != mainBasePath {
			db := database.GetDB()
			if db != nil {
				var admin model.ResellerAdmin
				webPath := strings.Trim(currentBasePath, "/")
				if err := db.Where("web_path = ?", webPath).First(&admin).Error; err == nil {
					// Impersonate the reseller for this request
					c.Set("IMPERSONATE_RESELLER_ID", admin.Id)
					c.Set("IMPERSONATE_RESELLER_USERNAME", admin.Username)
				}
			}
		}
	}

	c.Next()
}

// I18nWeb retrieves an internationalized message for the web interface based on the current locale.
func I18nWeb(c *gin.Context, name string, params ...string) string {
	anyfunc, funcExists := c.Get("I18n")
	if !funcExists {
		logger.Warning("I18n function not exists in gin context!")
		return ""
	}
	i18nFunc, _ := anyfunc.(func(i18nType locale.I18nType, key string, keyParams ...string) string)
	msg := i18nFunc(locale.Web, name, params...)
	return msg
}
