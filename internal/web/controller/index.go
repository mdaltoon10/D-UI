package controller

import (
	"net/http"
	"strings"
	"text/template"
	"time"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/logger"
	"github.com/mdaltoon10/D-UI/v3/internal/util/crypto"
	"github.com/mdaltoon10/D-UI/v3/internal/web/middleware"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service/panel"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service/tgbot"
	"github.com/mdaltoon10/D-UI/v3/internal/web/session"

	"github.com/gin-gonic/gin"
)

// LoginForm represents the login request structure.
type LoginForm struct {
	Username         string `json:"username" form:"username"`
	Password         string `json:"password" form:"password"`
	TwoFactorCode    string `json:"twoFactorCode" form:"twoFactorCode"`
	IsResellerPortal *bool  `json:"isResellerPortal" form:"isResellerPortal"`
	PortalWebPath    string `json:"portalWebPath" form:"portalWebPath"`
}

// IndexController handles the main index and login-related routes.
type IndexController struct {
	BaseController

	settingService service.SettingService
	userService    panel.UserService
	tgbot          tgbot.Tgbot
}

// NewIndexController creates a new IndexController and initializes its routes.
func NewIndexController(g *gin.RouterGroup) *IndexController {
	a := &IndexController{}
	a.initRouter(g)
	return a
}

// initRouter sets up the routes for index, login, logout, and two-factor authentication.
func (a *IndexController) initRouter(g *gin.RouterGroup) {
	g.GET("/", a.index)
	g.GET("/portal/:webPath", a.portalLogin)
	g.GET("/csrf-token", a.csrfToken)

	g.POST("/login", middleware.CSRFMiddleware(), a.login)
	g.POST("/logout", middleware.CSRFMiddleware(), a.logout)
	g.POST("/getTwoFactorEnable", middleware.CSRFMiddleware(), a.getTwoFactorEnable)
}

func (a *IndexController) portalLogin(c *gin.Context) {
	webPath := c.Param("webPath")
	if webPath != "" {
		db := database.GetDB()
		if db != nil {
			var admin model.ResellerAdmin
			if err := db.Where("LOWER(web_path) = LOWER(?)", webPath).First(&admin).Error; err != nil {
				c.String(http.StatusNotFound, "404 Not Found")
				return
			}
			c.Set("is_reseller", true)
			c.Set("reseller_web_path", admin.WebPath)
		}
	}
	if session.IsLogin(c) {
		c.Header("Cache-Control", "no-store")
		// If it's already the correct reseller, redirect to their panel
		if resellerId := session.GetLoginReseller(c); resellerId != "" {
			db := database.GetDB()
			if db != nil {
				var admin model.ResellerAdmin
				if err := db.Where("id = ?", resellerId).First(&admin).Error; err == nil {
					if strings.EqualFold(admin.WebPath, webPath) {
						settingService := service.SettingService{}
						mainBasePath, _ := settingService.GetBasePath()
						if mainBasePath == "" {
							mainBasePath = "/"
						}
						if !strings.HasSuffix(mainBasePath, "/") {
							mainBasePath += "/"
						}
						c.Redirect(http.StatusTemporaryRedirect, mainBasePath+admin.WebPath+"/panel/")
						return
					}
					// If they are logged in as a DIFFERENT reseller, we let them see the login page to switch
				}
			}
		} else if session.GetLoginUser(c) != nil {
			// Master admin is logged in. 
			// We don't redirect them to the main panel automatically if they specifically hit a portal URL.
			// This allows them to log in as a reseller or just see the login page.
		} else {
			c.Redirect(http.StatusTemporaryRedirect, c.GetString("base_path")+"panel/")
			return
		}
	}
	serveDistPage(c, "login.html")
}

// index handles the root route, redirecting logged-in users to the panel or showing the login page.
func (a *IndexController) index(c *gin.Context) {
	if session.IsLogin(c) {
		c.Header("Cache-Control", "no-store")
		
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
					if !strings.HasSuffix(mainBasePath, "/") {
						mainBasePath += "/"
					}
					c.Redirect(http.StatusTemporaryRedirect, mainBasePath+admin.WebPath+"/panel/")
					return
				}
			}
		}
		
		c.Redirect(http.StatusTemporaryRedirect, c.GetString("base_path")+"panel/")
		return
	}
	serveDistPage(c, "login.html")
}

// login handles user authentication and session creation.
func (a *IndexController) login(c *gin.Context) {
	var form LoginForm

	if err := c.ShouldBind(&form); err != nil {
		pureJsonMsg(c, http.StatusOK, false, I18nWeb(c, "pages.login.toasts.invalidFormData"))
		return
	}
	if form.Username == "" {
		pureJsonMsg(c, http.StatusOK, false, I18nWeb(c, "pages.login.toasts.emptyUsername"))
		return
	}
	if form.Password == "" {
		pureJsonMsg(c, http.StatusOK, false, I18nWeb(c, "pages.login.toasts.emptyPassword"))
		return
	}

	remoteIP := getRemoteIp(c)
	safeUser := template.HTMLEscapeString(form.Username)
	timeStr := time.Now().Format("2006-01-02 15:04:05")
	if blockedUntil, ok := defaultLoginLimiter.allow(remoteIP, form.Username); !ok {
		reason := "too many failed attempts"
		logger.Warningf("failed login: username=%q, IP=%q, reason=%q, blocked_until=%s", safeUser, remoteIP, reason, blockedUntil.Format(time.RFC3339))
		a.tgbot.UserLoginNotify(tgbot.LoginAttempt{
			Username: safeUser,
			IP:       remoteIP,
			Time:     timeStr,
			Status:   tgbot.LoginFail,
			Reason:   reason,
		})
		pureJsonMsg(c, http.StatusOK, false, I18nWeb(c, "pages.login.toasts.wrongUsernameOrPassword"))
		return
	}

	// Check context: is the user logging in from a reseller portal or the master panel?
	isResellerContext := c.GetBool("is_reseller") ||
		c.GetHeader("X-Reseller-Base-Path") != "" ||
		(form.IsResellerPortal != nil && *form.IsResellerPortal)

	user, checkErr := a.userService.CheckUser(form.Username, form.Password, form.TwoFactorCode)

	if isResellerContext {
		// Context: Reseller Portal (must only authenticate reseller credentials)
		if user != nil && checkErr == nil {
			// Master admin attempted to log in on a reseller portal
			pureJsonMsg(c, http.StatusOK, false, "امکان ورود به پنل اصلی از طریق پورتال نمایندگان وجود ندارد")
			return
		}

		var admin model.ResellerAdmin
		db := database.GetDB()
		if err := db.Where("LOWER(username) = LOWER(?)", form.Username).First(&admin).Error; err != nil || (!crypto.CheckPasswordHash(admin.Password, form.Password) && admin.Password != form.Password) {
			reason := "invalid credentials"
			if blockedUntil, blocked := defaultLoginLimiter.registerFailure(remoteIP, form.Username); blocked {
				logger.Warningf("failed login: username=%q, IP=%q, reason=%q, blocked_until=%s", safeUser, remoteIP, reason, blockedUntil.Format(time.RFC3339))
			} else {
				logger.Warningf("failed login: username=%q, IP=%q, reason=%q", safeUser, remoteIP, reason)
			}
			a.tgbot.UserLoginNotify(tgbot.LoginAttempt{
				Username: safeUser,
				IP:       remoteIP,
				Time:     timeStr,
				Status:   tgbot.LoginFail,
				Reason:   reason,
			})
			pureJsonMsg(c, http.StatusOK, false, I18nWeb(c, "pages.login.toasts.wrongUsernameOrPassword"))
			return
		}

		// Check portal alignment if targeted to a specific reseller webPath
		targetWebPath := c.GetString("reseller_web_path")
		if form.PortalWebPath != "" {
			targetWebPath = form.PortalWebPath
		}
		if targetWebPath != "" && !strings.EqualFold(targetWebPath, admin.WebPath) {
			pureJsonMsg(c, http.StatusOK, false, I18nWeb(c, "pages.login.toasts.wrongUsernameOrPassword"))
			return
		}

		if !admin.Enable {
			pureJsonMsg(c, http.StatusOK, false, "حساب نماینده غیرفعال است")
			return
		}
		if admin.ExpiryTime > 0 && time.Now().UnixMilli() > admin.ExpiryTime {
			pureJsonMsg(c, http.StatusOK, false, "اعتبار حساب نماینده به پایان رسیده است")
			return
		}

		defaultLoginLimiter.registerSuccess(remoteIP, form.Username)
		logger.Infof("Reseller %s logged in successfully, Ip Address: %s\n", safeUser, remoteIP)

		// Set session for reseller
		settingService := service.SettingService{}
		mainBasePath, _ := settingService.GetBasePath()
		if mainBasePath == "" {
			mainBasePath = "/"
		}

		resellerBasePath := "/"
		trimmedMain := strings.Trim(mainBasePath, "/")
		if trimmedMain != "" {
			resellerBasePath += trimmedMain + "/"
		}
		resellerBasePath += admin.WebPath + "/"

		c.Set("base_path", resellerBasePath)
		if err := session.SetLoginReseller(c, admin.Id, admin.Username); err != nil {
			logger.Warning("Unable to save reseller session:", err)
			pureJsonMsg(c, http.StatusOK, false, "Failed to create session")
			return
		}

		jsonMsgObj(c, I18nWeb(c, "pages.login.toasts.successLogin"), gin.H{"isReseller": true, "username": admin.Username, "remark": admin.Remark, "webPath": admin.WebPath}, nil)
		return
	}

	// Context: Main Panel (Master Admin)
	if user == nil {
		// Check if a reseller attempted to login from the main panel
		var admin model.ResellerAdmin
		db := database.GetDB()
		if err := db.Where("LOWER(username) = LOWER(?)", form.Username).First(&admin).Error; err == nil {
			if crypto.CheckPasswordHash(admin.Password, form.Password) || admin.Password == form.Password {
				pureJsonMsg(c, http.StatusOK, false, "ورود نمایندگان فقط از طریق آدرس اختصاصی پورتال نماینده امکان‌پذیر است")
				return
			}
		}

		reason := loginFailureReason(checkErr)
		if blockedUntil, blocked := defaultLoginLimiter.registerFailure(remoteIP, form.Username); blocked {
			logger.Warningf("failed login: username=%q, IP=%q, reason=%q, blocked_until=%s", safeUser, remoteIP, reason, blockedUntil.Format(time.RFC3339))
		} else {
			logger.Warningf("failed login: username=%q, IP=%q, reason=%q", safeUser, remoteIP, reason)
		}
		a.tgbot.UserLoginNotify(tgbot.LoginAttempt{
			Username: safeUser,
			IP:       remoteIP,
			Time:     timeStr,
			Status:   tgbot.LoginFail,
			Reason:   reason,
		})
		pureJsonMsg(c, http.StatusOK, false, I18nWeb(c, "pages.login.toasts.wrongUsernameOrPassword"))
		return
	}

	defaultLoginLimiter.registerSuccess(remoteIP, form.Username)
	logger.Infof("%s logged in successfully, Ip Address: %s\n", safeUser, remoteIP)
	a.tgbot.UserLoginNotify(tgbot.LoginAttempt{
		Username: safeUser,
		IP:       remoteIP,
		Time:     timeStr,
		Status:   tgbot.LoginSuccess,
	})

	if err := session.SetLoginUser(c, user); err != nil {
		logger.Warning("Unable to save session:", err)
		return
	}

	logger.Infof("%s logged in successfully", safeUser)
	jsonMsgObj(c, I18nWeb(c, "pages.login.toasts.successLogin"), gin.H{"isReseller": false}, nil)
}

func loginFailureReason(err error) string {
	if err != nil && err.Error() == "invalid 2fa code" {
		return "invalid 2FA code"
	}
	return "invalid credentials"
}

func (a *IndexController) logout(c *gin.Context) {
	settingService := service.SettingService{}
	mainBasePath, _ := settingService.GetBasePath()
	if mainBasePath == "" {
		mainBasePath = "/"
	}

	isReseller := c.GetBool("is_reseller") ||
		c.GetHeader("X-Reseller-Base-Path") != "" ||
		(c.GetString("base_path") != "" && c.GetString("base_path") != mainBasePath) ||
		session.IsResellerLogin(c)

	if isReseller {
		logger.Infof("Reseller logged out successfully")
		if err := session.ClearResellerSession(c); err != nil {
			logger.Warning("Unable to clear reseller session on logout:", err)
		}
	} else {
		user := session.GetLoginUser(c)
		if user != nil {
			logger.Infof("%s logged out successfully", user.Username)
		}
		if err := session.ClearAdminSession(c); err != nil {
			logger.Warning("Unable to clear admin session on logout:", err)
		}
	}
	c.SetCookie("reseller_portal", "", -1, "/", "", false, true)
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// csrfToken returns the session CSRF token. Public — the login page
// needs a token before authenticating.
func (a *IndexController) csrfToken(c *gin.Context) {
	token, err := session.EnsureCSRFToken(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "msg": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "obj": token})
}

// getTwoFactorEnable retrieves the current status of two-factor authentication.
func (a *IndexController) getTwoFactorEnable(c *gin.Context) {
	status, err := a.settingService.GetTwoFactorEnable()
	if err == nil {
		jsonObj(c, status, nil)
	}
}
