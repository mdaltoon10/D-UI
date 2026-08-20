package controller

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service"
)

type InboundGroupController struct {
	BaseController
	inboundGroupService service.InboundGroupService
	xrayService         service.XrayService
}

func NewInboundGroupController(g *gin.RouterGroup) *InboundGroupController {
	a := &InboundGroupController{}
	a.initRouter(g)
	return a
}

func (a *InboundGroupController) initRouter(g *gin.RouterGroup) {
	g = g.Group("/inbound-groups")
	g.Use(a.checkLogin)
	g.GET("/list", a.list)
	g.POST("/create", a.create)
	g.POST("/update/:id", a.update)
	g.POST("/delete/:id", a.delete)
	g.POST("/setEnable/:id", a.setEnable)
	g.POST("/addInbounds", a.addInbounds)
	g.POST("/sync/:id", a.sync)
}

func (a *InboundGroupController) list(c *gin.Context) {
	groups, err := a.inboundGroupService.List()
	if err != nil {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	jsonObj(c, groups, nil)
}

type inboundGroupForm struct {
	Name       string `json:"name"`
	Remark     string `json:"remark"`
	InboundIds []int  `json:"inboundIds"`
	NodeIds    []int  `json:"nodeIds"`
	Enable     *bool  `json:"enable"`
}

func (a *InboundGroupController) create(c *gin.Context) {
	var body inboundGroupForm
	if err := c.ShouldBindJSON(&body); err != nil {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	enable := true
	if body.Enable != nil {
		enable = *body.Enable
	}
	g, err := a.inboundGroupService.Create(body.Name, body.Remark, body.InboundIds, body.NodeIds, enable)
	if err != nil {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	jsonObj(c, g, I18nWeb(c, "success"))
}

func (a *InboundGroupController) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	var body inboundGroupForm
	if err := c.ShouldBindJSON(&body); err != nil {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	enable := true
	if body.Enable != nil {
		enable = *body.Enable
	}
	if err := a.inboundGroupService.Update(id, body.Name, body.Remark, body.InboundIds, body.NodeIds, enable); err != nil {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	jsonMsg(c, I18nWeb(c, "success"), nil)
}

func (a *InboundGroupController) delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	if err := a.inboundGroupService.Delete(id); err != nil {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	jsonMsg(c, I18nWeb(c, "success"), nil)
}

func (a *InboundGroupController) setEnable(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	var body struct {
		Enable bool `json:"enable"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	if err := a.inboundGroupService.SetEnable(id, body.Enable); err != nil {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	jsonMsg(c, I18nWeb(c, "success"), nil)
}

func (a *InboundGroupController) addInbounds(c *gin.Context) {
	var body struct {
		InboundIds []int `json:"inboundIds"`
		GroupIds   []int `json:"groupIds"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	affected, err := a.inboundGroupService.AddInboundsToGroups(body.InboundIds, body.GroupIds)
	if err != nil {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	jsonObj(c, gin.H{"affected": affected}, I18nWeb(c, "success"))
}

func (a *InboundGroupController) sync(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	synced, err := a.inboundGroupService.SyncToNodes(id)
	if err != nil {
		jsonMsg(c, I18nWeb(c, "somethingWentWrong"), err)
		return
	}
	jsonObj(c, gin.H{"syncedNodes": synced}, nil)
}
