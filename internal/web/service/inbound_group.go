package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/util/common"
	"github.com/mdaltoon10/D-UI/v3/internal/web/runtime"
	"github.com/mdaltoon10/D-UI/v3/internal/xray"
)

type InboundGroupSummary struct {
	Id           int      `json:"id"`
	Name         string   `json:"name"`
	Remark       string   `json:"remark"`
	InboundIds   []int    `json:"inboundIds"`
	InboundTags  []string `json:"inboundTags"`
	NodeIds      []int    `json:"nodeIds"`
	Enable       bool     `json:"enable"`
	InboundCount int      `json:"inboundCount"`
	NodeCount    int      `json:"nodeCount"`
	ClientCount  int      `json:"clientCount"`
	OnlineCount  int      `json:"onlineCount"`
	TrafficUsed  int64    `json:"trafficUsed"`
	Up           int64    `json:"up"`
	Down         int64    `json:"down"`
}

type InboundGroupService struct{}

func parseIntSlice(s string) []int {
	s = strings.TrimSpace(s)
	if s == "" {
		return []int{}
	}
	var res []int
	if strings.HasPrefix(s, "[") {
		_ = json.Unmarshal([]byte(s), &res)
		if res != nil {
			return res
		}
	}
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		var id int
		if _, err := fmt.Sscanf(part, "%d", &id); err == nil && id > 0 {
			res = append(res, id)
		}
	}
	if res == nil {
		res = []int{}
	}
	return res
}

func formatIntSlice(ids []int) string {
	if len(ids) == 0 {
		return "[]"
	}
	b, _ := json.Marshal(ids)
	return string(b)
}

func (s *InboundGroupService) List() ([]InboundGroupSummary, error) {
	db := database.GetDB()
	var stored []model.InboundGroup
	if err := db.Order("id ASC").Find(&stored).Error; err != nil {
		return nil, err
	}

	// Fetch all master inbounds
	var inbounds []model.Inbound
	if err := db.Find(&inbounds).Error; err != nil {
		return nil, err
	}
	inboundMap := make(map[int]model.Inbound, len(inbounds))
	for _, ib := range inbounds {
		inboundMap[ib.Id] = ib
	}

	// Fetch all client traffics to compute stats per inbound
	var clientTraffics []xray.ClientTraffic
	_ = db.Find(&clientTraffics).Error
	inbUp := make(map[int]int64)
	inbDown := make(map[int]int64)
	inbClients := make(map[int]map[string]struct{})
	for _, ct := range clientTraffics {
		inbUp[ct.InboundId] += ct.Up
		inbDown[ct.InboundId] += ct.Down
		if ct.Email != "" {
			if inbClients[ct.InboundId] == nil {
				inbClients[ct.InboundId] = make(map[string]struct{})
			}
			inbClients[ct.InboundId][ct.Email] = struct{}{}
		}
	}

	// Online clients
	inboundSvc := InboundService{}
	onlineList := inboundSvc.GetOnlineClients()
	onlineEmailSet := make(map[string]struct{}, len(onlineList))
	for _, em := range onlineList {
		onlineEmailSet[em] = struct{}{}
	}

	out := make([]InboundGroupSummary, 0, len(stored))
	for _, g := range stored {
		inbIds := parseIntSlice(g.InboundIds)
		nodeIds := parseIntSlice(g.NodeIds)
		var tags []string
		var totalUp int64
		var totalDown int64
		clientSet := make(map[string]struct{})
		onlineSet := make(map[string]struct{})

		var targetInboundIds []int
		if len(inbIds) > 0 {
			targetInboundIds = inbIds
		} else {
			for _, ib := range inbounds {
				targetInboundIds = append(targetInboundIds, ib.Id)
			}
		}

		for _, iid := range targetInboundIds {
			if ib, ok := inboundMap[iid]; ok {
				tags = append(tags, ib.Tag)
				totalUp += inbUp[iid] + ib.Up
				totalDown += inbDown[iid] + ib.Down
				if cMap, hasC := inbClients[iid]; hasC {
					for em := range cMap {
						clientSet[em] = struct{}{}
						if _, isOnline := onlineEmailSet[em]; isOnline {
							onlineSet[em] = struct{}{}
						}
					}
				}
			}
		}

		out = append(out, InboundGroupSummary{
			Id:           g.Id,
			Name:         g.Name,
			Remark:       g.Remark,
			InboundIds:   inbIds,
			InboundTags:  tags,
			NodeIds:      nodeIds,
			Enable:       g.Enable,
			InboundCount: len(targetInboundIds),
			NodeCount:    len(nodeIds),
			ClientCount:  len(clientSet),
			OnlineCount:  len(onlineSet),
			TrafficUsed:  totalUp + totalDown,
			Up:           totalUp,
			Down:         totalDown,
		})
	}

	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out, nil
}

func (s *InboundGroupService) Create(name, remark string, inboundIds, nodeIds []int, enable bool) (*model.InboundGroup, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, common.NewError("group name is required")
	}
	db := database.GetDB()
	var count int64
	db.Model(&model.InboundGroup{}).Where("name = ?", name).Count(&count)
	if count > 0 {
		return nil, common.NewError("inbound group already exists")
	}
	g := &model.InboundGroup{
		Name:       name,
		Remark:     strings.TrimSpace(remark),
		InboundIds: formatIntSlice(inboundIds),
		NodeIds:    formatIntSlice(nodeIds),
		Enable:     enable,
	}
	if err := db.Create(g).Error; err != nil {
		return nil, err
	}
	if g.Enable && len(nodeIds) > 0 {
		go func(gid int) {
			_, _ = s.SyncToNodes(gid)
		}(g.Id)
	}
	return g, nil
}

func (s *InboundGroupService) Update(id int, name, remark string, inboundIds, nodeIds []int, enable bool) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return common.NewError("group name is required")
	}
	db := database.GetDB()
	var count int64
	db.Model(&model.InboundGroup{}).Where("name = ? AND id <> ?", name, id).Count(&count)
	if count > 0 {
		return common.NewError("another inbound group with this name already exists")
	}
	updates := map[string]any{
		"name":        name,
		"remark":      strings.TrimSpace(remark),
		"inbound_ids": formatIntSlice(inboundIds),
		"node_ids":    formatIntSlice(nodeIds),
		"enable":      enable,
	}
	return db.Model(&model.InboundGroup{}).Where("id = ?", id).Updates(updates).Error
}

func (s *InboundGroupService) Delete(id int) error {
	db := database.GetDB()
	return db.Where("id = ?", id).Delete(&model.InboundGroup{}).Error
}

func (s *InboundGroupService) SetEnable(id int, enable bool) error {
	db := database.GetDB()
	return db.Model(&model.InboundGroup{}).Where("id = ?", id).Update("enable", enable).Error
}

func (s *InboundGroupService) AddInboundsToGroups(inboundIds []int, groupIds []int) (int, error) {
	if len(inboundIds) == 0 || len(groupIds) == 0 {
		return 0, nil
	}
	db := database.GetDB()
	var groups []model.InboundGroup
	if err := db.Where("id IN ?", groupIds).Find(&groups).Error; err != nil {
		return 0, err
	}
	affected := 0
	for _, g := range groups {
		existing := parseIntSlice(g.InboundIds)
		existingSet := make(map[int]struct{}, len(existing))
		for _, id := range existing {
			existingSet[id] = struct{}{}
		}
		added := false
		for _, id := range inboundIds {
			if id > 0 {
				if _, ok := existingSet[id]; !ok {
					existing = append(existing, id)
					existingSet[id] = struct{}{}
					added = true
				}
			}
		}
		if added {
			if err := db.Model(&model.InboundGroup{}).Where("id = ?", g.Id).Update("inbound_ids", formatIntSlice(existing)).Error; err == nil {
				affected++
			}
		}
	}
	return affected, nil
}

func (s *InboundGroupService) SyncToNodes(id int) (int, error) {
	db := database.GetDB()
	var g model.InboundGroup
	if err := db.Where("id = ?", id).First(&g).Error; err != nil {
		return 0, fmt.Errorf("inbound group not found: %w", err)
	}
	nodeIds := parseIntSlice(g.NodeIds)
	if len(nodeIds) == 0 {
		return 0, common.NewError("no target nodes assigned to this group")
	}

	inbIds := parseIntSlice(g.InboundIds)
	var inbounds []*model.Inbound
	if len(inbIds) > 0 {
		if err := db.Where("id IN ?", inbIds).Find(&inbounds).Error; err != nil {
			return 0, err
		}
	} else {
		if err := db.Where("node_id IS NULL OR node_id = 0").Find(&inbounds).Error; err != nil {
			return 0, err
		}
	}

	syncedCount := 0
	nodeSvc := NodeService{}
	mgr := runtime.GetManager()

	for _, nId := range nodeIds {
		node, err := nodeSvc.GetById(nId)
		if err != nil || node == nil || !node.Enable {
			continue
		}
		if mgr == nil {
			continue
		}
		rt, err := mgr.RuntimeFor(&node.Id)
		if err != nil || rt == nil {
			continue
		}
		remoteRt, ok := rt.(*runtime.Remote)
		if !ok || remoteRt == nil {
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		remoteTags, _ := remoteRt.ListRemoteTags(ctx)
		remoteTagSet := make(map[string]struct{}, len(remoteTags))
		for _, tag := range remoteTags {
			remoteTagSet[tag] = struct{}{}
		}

		for _, ib := range inbounds {
			clonedIb := *ib
			if strings.TrimSpace(g.Name) != "" {
				clonedIb.Remark = strings.TrimSpace(g.Name)
			}
			_, exists := remoteTagSet[clonedIb.Tag]
			if _, err := remoteRt.ReconcileInbound(ctx, &clonedIb, exists); err == nil {
				// Synced successfully
			}
		}
		cancel()
		syncedCount++
	}

	return syncedCount, nil
}
