package session

import (
	"encoding/gob"
	"net/http"
	"strconv"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/logger"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

const (
	loginUserKey      = "LOGIN_USER"
	loginEpochKey     = "LOGIN_EPOCH"
	apiAuthUserKey    = "api_auth_user"
	sessionCookieName = "d-ui"
)


var masterBasePath = "/"

func SetMasterBasePath(path string) {
	masterBasePath = path
}

func getContextKey(c *gin.Context, key string) string {
	// For master admin keys, always use the main panel's base path context
	if key == loginUserKey || key == loginEpochKey {
		bp := masterBasePath
		if bp == "" || bp == "/" {
			return key
		}
		return key + "_" + bp
	}

	// For reseller specific keys, isolate them based on the current request's base_path
	// which allows different resellers to have independent sessions even on the same domain.
	bp := c.GetString("base_path")
	if bp == "" || bp == "/" {
		bp = masterBasePath
	}
	if bp == "" || bp == "/" {
		return key
	}
	return key + "_" + bp
}

func init() {
	gob.Register(model.User{})
}

func SetLoginUser(c *gin.Context, user *model.User) error {
	if user == nil {
		return nil
	}
	s := sessions.Default(c)
	s.Set(getContextKey(c, loginUserKey), user.Id)
	s.Set(getContextKey(c, loginEpochKey), user.LoginEpoch)
	s.Delete(getContextKey(c, loginResellerKey))
	s.Delete(getContextKey(c, loginResellerUsernameKey))
	return s.Save()
}

func SetAPIAuthUser(c *gin.Context, user *model.User) {
	if user == nil {
		return
	}
	c.Set(apiAuthUserKey, user)
}

func GetLoginUser(c *gin.Context) *model.User {
	if v, ok := c.Get(apiAuthUserKey); ok {
		if u, ok2 := v.(*model.User); ok2 {
			return u
		}
	}
	
	s := sessions.Default(c)
	resellerId := GetLoginReseller(c)
	if resellerId != "" {
		return &model.User{Id: 1, Username: "reseller"} // fake user with Id=1 so they can access inbounds
	}
	
	obj := s.Get(getContextKey(c, loginUserKey))
	if obj == nil {
		return nil
	}
	userID, ok := sessionUserID(obj)
	if !ok {
		s.Delete(getContextKey(c, loginUserKey))
		s.Delete(getContextKey(c, loginEpochKey))
		if err := s.Save(); err != nil {
			logger.Warning("session: failed to drop stale user payload:", err)
		}
		return nil
	}
	if legacyUserID, ok := legacySessionUserID(obj); ok {
		s.Set(getContextKey(c, loginUserKey), legacyUserID)
		if err := s.Save(); err != nil {
			logger.Warning("session: failed to migrate legacy user payload:", err)
		}
	}
	user, err := getUserByID(userID)
	if err != nil {
		logger.Warning("session: failed to load user:", err)
		s.Delete(getContextKey(c, loginUserKey))
		s.Delete(getContextKey(c, loginEpochKey))
		if saveErr := s.Save(); saveErr != nil {
			logger.Warning("session: failed to drop missing user:", saveErr)
		}
		return nil
	}
	if !sessionEpochMatches(s.Get(getContextKey(c, loginEpochKey)), user.LoginEpoch) {
		s.Delete(getContextKey(c, loginUserKey))
		s.Delete(getContextKey(c, loginEpochKey))
		if saveErr := s.Save(); saveErr != nil {
			logger.Warning("session: failed to drop stale epoch:", saveErr)
		}
		return nil
	}
	return user
}

func sessionEpochMatches(cookieVal any, userEpoch int64) bool {
	var got int64
	switch v := cookieVal.(type) {
	case nil:
	case int64:
		got = v
	case int:
		got = int64(v)
	case int32:
		got = int64(v)
	case float64:
		got = int64(v)
	default:
		return false
	}
	return got == userEpoch
}

func IsLogin(c *gin.Context) bool {
	return GetLoginUser(c) != nil || IsResellerLogin(c)
}

func sessionUserID(obj any) (int, bool) {
	switch v := obj.(type) {
	case int:
		return v, v > 0
	case int64:
		return int(v), v > 0
	case int32:
		return int(v), v > 0
	case float64:
		id := int(v)
		return id, v == float64(id) && id > 0
	case model.User:
		return v.Id, v.Id > 0
	case *model.User:
		if v == nil {
			return 0, false
		}
		return v.Id, v.Id > 0
	default:
		return 0, false
	}
}

func legacySessionUserID(obj any) (int, bool) {
	switch v := obj.(type) {
	case model.User:
		return v.Id, v.Id > 0
	case *model.User:
		if v == nil {
			return 0, false
		}
		return v.Id, v.Id > 0
	default:
		return 0, false
	}
}

func getUserByID(id int) (*model.User, error) {
	db := database.GetDB()
	if db == nil {
		return nil, http.ErrServerClosed
	}
	user := &model.User{}
	if err := db.Model(model.User{}).Where("id = ?", id).First(user).Error; err != nil {
		return nil, err
	}
	return user, nil
}

func ClearSession(c *gin.Context) error {
	s := sessions.Default(c)
	s.Delete(getContextKey(c, loginUserKey))
	s.Delete(getContextKey(c, loginEpochKey))
	s.Delete(getContextKey(c, loginResellerKey))
	s.Delete(getContextKey(c, loginResellerUsernameKey))
	return s.Save()
}

const (
	loginResellerKey = "LOGIN_RESELLER"
)

func GetLoginReseller(c *gin.Context) string {
	if impersonateID, ok := c.Get("IMPERSONATE_RESELLER_ID"); ok {
		if str, ok := impersonateID.(string); ok {
			return str
		}
	}

	s := sessions.Default(c)
	obj := s.Get(getContextKey(c, loginResellerKey))
	if obj == nil {
		return ""
	}
	if str, ok := obj.(string); ok {
		return str
	}
	switch v := obj.(type) {
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case int32:
		return strconv.FormatInt(int64(v), 10)
	case float64:
		return strconv.FormatInt(int64(v), 10)
	}
	return ""
}

func IsResellerLogin(c *gin.Context) bool {
	return GetLoginReseller(c) != ""
}

const loginResellerUsernameKey = "LOGIN_RESELLER_USERNAME"

func GetLoginResellerUsername(c *gin.Context) string {
	if impersonateUser, ok := c.Get("IMPERSONATE_RESELLER_USERNAME"); ok {
		if str, ok := impersonateUser.(string); ok {
			return str
		}
	}

	s := sessions.Default(c)
	obj := s.Get(getContextKey(c, loginResellerUsernameKey))
	if str, ok := obj.(string); ok {
		return str
	}
	return ""
}


func SetLoginReseller(c *gin.Context, id string, username string) error {
	s := sessions.Default(c)
	s.Set(getContextKey(c, loginResellerKey), id)
	s.Set(getContextKey(c, loginResellerUsernameKey), username)
	s.Delete(getContextKey(c, loginUserKey))
	s.Delete(getContextKey(c, loginEpochKey))
	return s.Save()
}
