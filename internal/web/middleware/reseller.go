package middleware

import (
	"strings"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"

	"github.com/gin-gonic/gin"
)

func ResellerPathMiddleware(mainBasePath string) gin.HandlerFunc {
	return func(c *gin.Context) {
		reqPath := c.Request.URL.Path
		if reqPath == "/" || reqPath == "" {
			return
		}

		// Normalize paths for comparison
		trimmedMain := strings.Trim(mainBasePath, "/")
		segments := strings.Split(strings.Trim(reqPath, "/"), "/")
		if len(segments) == 0 {
			return
		}

		// If mainBasePath is not root, skip the main base path segment
		startIndex := 0
		if trimmedMain != "" && segments[0] == trimmedMain {
			startIndex = 1
		}

		if len(segments) <= startIndex {
			return
		}

		webPath := segments[startIndex]
		
		// Reserved segments that are NOT resellers
		reserved := map[string]bool{
			"panel": true, "assets": true, "api": true, "login": true, "logout": true, 
			"portal": true, "csrf-token": true, "getTwoFactorEnable": true,
		}
		if reserved[webPath] {
			return
		}

		var admin model.ResellerAdmin
		db := database.GetDB()
		if db == nil {
			return
		}

		if err := db.Where("LOWER(web_path) = LOWER(?)", webPath).First(&admin).Error; err == nil {
			if !admin.Enable {
				return
			}
			// Found a reseller! 
			// We use the exact case from the database for the base_path to ensure consistency
			resellerBasePath := "/"
			if trimmedMain != "" {
				resellerBasePath += trimmedMain + "/"
			}
			resellerBasePath += admin.WebPath + "/"

			c.Set("base_path", resellerBasePath)
			c.Set("is_reseller", true)
			c.Set("IMPERSONATE_RESELLER_ID", admin.Id)
			c.Set("IMPERSONATE_RESELLER_USERNAME", admin.Username)
		}
	}
}
