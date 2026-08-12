package controller

import "github.com/gin-gonic/gin"

func (a *APIController) initCustomPanelRouter(g *gin.RouterGroup) {
	customPanel := &CustomPanelController{}
	g.POST("/api", a.checkCustomPanelAuth, customPanel.handle)
}
