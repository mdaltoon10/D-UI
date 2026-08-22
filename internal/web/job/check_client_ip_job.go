package job

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"os"
	"os/exec"
	"sort"
	"time"
	"sync"

	"github.com/mdaltoon10/D-UI/v3/internal/database"
	"github.com/mdaltoon10/D-UI/v3/internal/database/model"
	"github.com/mdaltoon10/D-UI/v3/internal/logger"
	"github.com/mdaltoon10/D-UI/v3/internal/web/service"
	"github.com/mdaltoon10/D-UI/v3/internal/xray"

	"gorm.io/gorm"
)

// IPWithTimestamp tracks an IP address with its last seen timestamp and connection start timestamp (Created)
type IPWithTimestamp struct {
	IP        string `json:"ip"`
	Timestamp int64  `json:"timestamp"`
	Created   int64  `json:"created,omitempty"`
}

// CheckClientIpJob monitors client IP addresses and manages IP blocking based
// on configured limits. The per-client IPs come from the core's online-stats
// API; no access log is involved. On a core too old to expose that API the job
// simply skips the run (the bundled core always supports it).
type CheckClientIpJob struct {
	disAllowedIps []string
	xrayService   service.XrayService
}

var job *CheckClientIpJob

const defaultXrayAPIPort = 62789

const ipStaleAfterSeconds = int64(30 * 60)

// NewCheckClientIpJob creates a new client IP monitoring job instance.
func NewCheckClientIpJob() *CheckClientIpJob {
	job = new(CheckClientIpJob)
	return job
}

func (j *CheckClientIpJob) Run() {
	observed, apiMode := j.collectFromOnlineAPI()
	if !apiMode {
		// xray is down or predates the online-stats API. There is no access-log
		// fallback anymore, so there is nothing to do this run.
		logger.Debug("[LimitIP] online-stats API unavailable this run; skipping")
		return
	}

	hasLimit := j.hasLimitIp()
	f2bInstalled := false
	if hasLimit {
		f2bInstalled = j.checkFail2BanInstalled()
	}
	j.processObserved(observed, j.resolveEnforce(hasLimit, f2bInstalled), true)
}

// resolveEnforce decides whether limits can actually be enforced this run.
// Without fail2ban on a platform that needs it the limit can't be applied, so
// enforcement is skipped (the panel resets these limits to 0 on upgrade and
// disables the field, so this is normally a no-op).
func (j *CheckClientIpJob) resolveEnforce(hasLimit, f2bInstalled bool) bool {
	return hasLimit
}

// collectFromOnlineAPI builds per-email IP observations (email -> ip ->
// last-seen unix seconds) from the core's online-stats API. ok=false means the
// API is unavailable — xray not running, an older core, or a transient gRPC
// failure — and the caller skips the run (there is no access-log fallback).
func (j *CheckClientIpJob) collectFromOnlineAPI() (map[string]map[string]int64, bool) {
	onlineUsers, ok, err := j.xrayService.GetOnlineUsers()
	if err != nil {
		logger.Debug("[LimitIP] online-stats API unavailable this run:", err)
		return nil, false
	}
	if !ok {
		return nil, false
	}
	now := time.Now().Unix()
	observed := make(map[string]map[string]int64, len(onlineUsers))
	for _, user := range onlineUsers {
		for _, entry := range user.IPs {
			// No localhost guard needed here: the core's OnlineMap.AddIP drops
			// 127.0.0.1/[::1] itself, so they never reach this list.
			ts := entry.LastSeen
			if ts <= 0 {
				ts = now
			}
			// Xray's statsUserOnline keeps track of all seen IPs since startup/reload.
			// To ensure accurate real-time IP limiting and prevent offline devices
			// from blocking new ones, we ignore IPs that haven't been active in the last 10 seconds.
			if now-ts > 10 {
				continue
			}
			if _, exists := observed[user.Email]; !exists {
				observed[user.Email] = make(map[string]int64)
			}
			if existing, seen := observed[user.Email][entry.IP]; !seen || ts > existing {
				observed[user.Email][entry.IP] = ts
			}
		}
	}
	return observed, true
}

// hasLimitIp reports whether any client carries an IP limit. It probes the
// normalized clients table (limit_ip is synced there by SyncInbound and the
// legacy seeder), replacing the old `settings LIKE '%limitIp%'` scan that
// loaded and JSON-parsed every inbound's settings blob on each 10s run.
func (j *CheckClientIpJob) hasLimitIp() bool {
	db := database.GetDB()
	var probe int64
	err := db.Model(&model.ClientRecord{}).Where("limit_ip > 0").Limit(1).Count(&probe).Error
	return err == nil && probe > 0
}

const ipScanChunk = 400

func chunkEmails(s []string, size int) [][]string {
	if len(s) == 0 {
		return nil
	}
	chunks := make([][]string, 0, (len(s)+size-1)/size)
	for size < len(s) {
		s, chunks = s[size:], append(chunks, s[:size])
	}
	return append(chunks, s)
}

// loadClientLimits maps each observed email to its clients.limit_ip in a few
// chunked queries, replacing the per-email settings-JSON parse that previously
// resolved the limit.
func (j *CheckClientIpJob) loadClientLimits(emails []string) map[string]int {
	db := database.GetDB()
	out := make(map[string]int, len(emails))
	for _, batch := range chunkEmails(emails, ipScanChunk) {
		var rows []struct {
			Email   string
			LimitIp int
		}
		if err := db.Model(&model.ClientRecord{}).
			Select("email, limit_ip").
			Where("email IN ?", batch).
			Scan(&rows).Error; err != nil {
			j.checkError(err)
			continue
		}
		for _, r := range rows {
			out[r.Email] = r.LimitIp
		}
	}
	return out
}

// loadInboundsByEmails resolves each email's owning inbound through the
// clients/client_inbounds relation in chunked queries. Like the old per-email
// First() it keeps the lowest inbound id when a client spans several inbounds.
func (j *CheckClientIpJob) loadInboundsByEmails(emails []string) map[string][]*model.Inbound {
	db := database.GetDB()
	inboundsByEmail := make(map[string][]int, len(emails))
	for _, batch := range chunkEmails(emails, ipScanChunk) {
		var pairs []struct {
			Email     string
			InboundId int
		}
		if err := db.Table("client_inbounds").
			Select("clients.email AS email, client_inbounds.inbound_id AS inbound_id").
			Joins("JOIN clients ON clients.id = client_inbounds.client_id").
			Where("clients.email IN ?", batch).
			Scan(&pairs).Error; err != nil {
			j.checkError(err)
			return nil
		}
		for _, p := range pairs {
			inboundsByEmail[p.Email] = append(inboundsByEmail[p.Email], p.InboundId)
		}
	}
	if len(inboundsByEmail) == 0 {
		return nil
	}

	idSet := make(map[int]struct{})
	ids := make([]int, 0)
	for _, inboundIds := range inboundsByEmail {
		for _, id := range inboundIds {
			if _, seen := idSet[id]; !seen {
				idSet[id] = struct{}{}
				ids = append(ids, id)
			}
		}
	}
	sort.Ints(ids)
	inboundsById := make(map[int]*model.Inbound, len(ids))
	for lo := 0; lo < len(ids); lo += ipScanChunk {
		hi := min(lo+ipScanChunk, len(ids))
		var page []*model.Inbound
		if err := db.Model(&model.Inbound{}).Where("id IN ?", ids[lo:hi]).Find(&page).Error; err != nil {
			j.checkError(err)
			return nil
		}
		for i := range page {
			inboundsById[page[i].Id] = page[i]
		}
	}

	out := make(map[string][]*model.Inbound, len(inboundsByEmail))
	for email, inboundIds := range inboundsByEmail {
		var inbounds []*model.Inbound
		for _, id := range inboundIds {
			if ib, ok := inboundsById[id]; ok {
				inbounds = append(inbounds, ib)
			}
		}
		out[email] = inbounds
	}
	return out
}

func (j *CheckClientIpJob) loadClientIpRows(emails []string) map[string]*model.InboundClientIps {
	db := database.GetDB()
	out := make(map[string]*model.InboundClientIps, len(emails))
	for _, batch := range chunkEmails(emails, ipScanChunk) {
		var rows []model.InboundClientIps
		if err := db.Where("client_email IN ?", batch).Find(&rows).Error; err != nil {
			j.checkError(err)
			continue
		}
		for i := range rows {
			out[rows[i].ClientEmail] = &rows[i]
		}
	}
	return out
}

// processObserved runs collection + enforcement for one scan's observations
// (email -> ip -> last-seen unix seconds). observedAreLive marks the
// observations as live connections, which bypass the stale cutoff: a connection
// that opened hours ago is still live even though its timestamp is old. The
// online-stats API always reports live connections, so the job passes true.
// Lookups are batched up front and all inbound_client_ips writes share one
// transaction, so a scan costs a handful of queries and one fsync instead of
// several per observed email.
func (j *CheckClientIpJob) processObserved(observed map[string]map[string]int64, enforce, observedAreLive bool) bool {
	shouldCleanLog := false
	now := time.Now().Unix()

	emails := make([]string, 0, len(observed))
	for email := range observed {
		emails = append(emails, email)
	}
	sort.Strings(emails)

	limitByEmail := j.loadClientLimits(emails)
	inboundByEmail := j.loadInboundsByEmails(emails)
	ipRowByEmail := j.loadClientIpRows(emails)

	// attribution accumulates this scan's local observations per email so they can
	// be recorded under this panel's own guid for cross-node IP attribution.
	attribution := make(map[string][]model.ClientIpEntry, len(observed))

	type pendingDisconnect struct {
		inbound *model.Inbound
		email   string
	}
	var disconnects []pendingDisconnect

	db := database.GetDB()
	tx := db.Begin()
	if tx.Error != nil {
		j.checkError(tx.Error)
		return false
	}
	committed := false
	defer func() {
		if !committed {
			tx.Rollback()
		}
	}()

	for _, email := range emails {
		ipTimestamps := observed[email]

		// The observations can still reference a client that was just renamed
		// or deleted; its email no longer matches any inbound. Skip it (and
		// drop any orphaned tracking row) instead of recreating a row and
		// logging an ERROR every run (#4963). The batch map resolves through
		// the clients relation; the per-email fallback keeps its settings LIKE
		// net for clients not yet present there.
		inbounds, ok := inboundByEmail[email]
		if !ok || len(inbounds) == 0 {
			var err error
			inbounds, err = j.getInboundsByEmail(email)
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					logger.Debugf("[LimitIP] skipping stale observed email %q (renamed or deleted)", email)
					j.delInboundClientIps(tx, email)
				} else {
					j.checkError(err)
				}
				continue
			}
		}

		var targetInbound *model.Inbound
		for _, ib := range inbounds {
			if ib.Enable {
				targetInbound = ib
				break
			}
		}
		if targetInbound == nil && len(inbounds) > 0 {
			targetInbound = inbounds[0]
		}
		if targetInbound == nil {
			continue
		}

		// Convert to IPWithTimestamp slice
		ipsWithTime := make([]IPWithTimestamp, 0, len(ipTimestamps))
		attrEntries := make([]model.ClientIpEntry, 0, len(ipTimestamps))
		for ip, timestamp := range ipTimestamps {
			ipsWithTime = append(ipsWithTime, IPWithTimestamp{IP: ip, Timestamp: timestamp})
			// Live API observations may carry an old lastSeen (connection start),
			// so stamp attribution with now; otherwise the stale cutoff would evict
			// an IP that is connected right now.
			attrTs := timestamp
			if observedAreLive {
				attrTs = now
			}
			attrEntries = append(attrEntries, model.ClientIpEntry{IP: ip, Timestamp: attrTs})
		}
		if len(attrEntries) > 0 {
			attribution[email] = attrEntries
		}

		clientIpsRecord, ok := ipRowByEmail[email]
		if !ok {
			clientIpsRecord = &model.InboundClientIps{ClientEmail: email}
		}

		cleaned, banned := j.updateInboundClientIps(tx, clientIpsRecord, targetInbound, email, limitByEmail[email], ipsWithTime, enforce, observedAreLive)
		shouldCleanLog = cleaned || shouldCleanLog
		if banned {
			for _, ib := range inbounds {
				disconnects = append(disconnects, pendingDisconnect{inbound: ib, email: email})
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		j.checkError(err)
		return shouldCleanLog
	}
	committed = true

	// Xray disconnects run after the commit so their network round-trips never
	// extend the scan's write transaction (node syncs upsert the same table).
	clientsCache := make(map[int][]model.Client)
	for _, d := range disconnects {
		clients, cached := clientsCache[d.inbound.Id]
		if !cached {
			settings := map[string][]model.Client{}
			_ = json.Unmarshal([]byte(d.inbound.Settings), &settings)
			clients = settings["clients"]
			clientsCache[d.inbound.Id] = clients
		}
		j.disconnectClientTemporarily(d.inbound, d.email, clients)
	}

	j.recordLocalAttribution(attribution)

	return shouldCleanLog
}

// recordLocalAttribution stores this scan's local observations under this panel's
// own guid so a parent panel can attribute each IP to the node it is on.
// Best-effort: attribution is advisory and must never block IP-limit enforcement.
func (j *CheckClientIpJob) recordLocalAttribution(attribution map[string][]model.ClientIpEntry) {
	if len(attribution) == 0 {
		return
	}
	guid, err := (&service.SettingService{}).GetPanelGuid()
	if err != nil || guid == "" {
		return
	}
	if err := (&service.InboundService{}).RecordLocalClientIps(guid, attribution); err != nil {
		logger.Debug("[LimitIP] record local ip attribution failed:", err)
	}
}

// mergeClientIps folds this scan's observations into the persisted set,
// dropping entries older than staleCutoff. newAlwaysLive exempts the new
// entries from that cutoff: an API-observed IP is a live connection by
// definition, even when its lastSeen (set at dispatch time) is hours old.
func mergeClientIps(old, new []IPWithTimestamp, staleCutoff int64, newAlwaysLive bool) map[string]IPWithTimestamp {
	ipMap := make(map[string]IPWithTimestamp, len(old)+len(new))

	// Track old IPs for quick lookup
	for _, ipTime := range old {
		if ipTime.Timestamp < staleCutoff {
			continue
		}
		ipMap[ipTime.IP] = ipTime
	}

	for _, ipTime := range new {
		if !newAlwaysLive && ipTime.Timestamp < staleCutoff {
			continue
		}

		existing, exists := ipMap[ipTime.IP]
		if !exists {
			// Brand new IP seen in this scan, set Created to its current timestamp
			createdVal := ipTime.Created
			if createdVal == 0 {
				createdVal = ipTime.Timestamp
			}
			ipTime.Created = createdVal
			ipMap[ipTime.IP] = ipTime
		} else {
			// Existing IP, update Timestamp to latest activity, but PRESERVE Created!
			if ipTime.Timestamp > existing.Timestamp {
				// If the IP was offline/unseen for more than 30 seconds, treat it as a new session
				if ipTime.Timestamp-existing.Timestamp > 30 {
					existing.Created = ipTime.Timestamp
				}
				existing.Timestamp = ipTime.Timestamp
			}
			if existing.Created == 0 {
				existing.Created = existing.Timestamp
			}
			ipMap[ipTime.IP] = existing
		}
	}
	return ipMap
}

// selectIpsToBan splits the live IPs (sorted oldest-first by partitionLiveIps)
// based on the configured policy. "kick_oldest" keeps the newest ones and bans the older ones.
// "block_newest" keeps the oldest ones (existing connections) and bans/rejects the newest ones.
func selectIpsToBan(live []IPWithTimestamp, limit int, policy string) (kept, banned []IPWithTimestamp) {
	if limit <= 0 || len(live) <= limit {
		return live, nil
	}
	if policy == "block_newest" || policy == "block_newest_kick_only" {
		// Keep the oldest `limit` entries, ban the newest remainder
		return live[:limit], live[limit:]
	}
	// Default: "kick_oldest" or "kick_oldest_kick_only" (or legacy "kick_only")
	cutoff := len(live) - limit
	return live[cutoff:], live[:cutoff]
}

func partitionLiveIps(ipMap map[string]IPWithTimestamp, observedThisScan map[string]bool) (live, historical []IPWithTimestamp) {
	live = make([]IPWithTimestamp, 0, len(observedThisScan))
	historical = make([]IPWithTimestamp, 0, len(ipMap))
	now := time.Now().Unix()
	for ip, entry := range ipMap {
		// Consider an IP "live" if it was seen locally in this scan, OR if its
		// timestamp from the synced database is very recent (e.g. within 10 seconds).
		// This ensures cluster-wide limits work even if the IP was seen on another node.
		if observedThisScan[ip] || now-entry.Timestamp < 10 {
			live = append(live, entry)
		} else {
			historical = append(historical, entry)
		}
	}

	// Sort live IPs oldest-first.
	// We prefer sorting by Created timestamp to track actual connection start time.
	// If Created is 0, we fall back to Timestamp.
	sort.Slice(live, func(i, j int) bool {
		tI := live[i].Created
		if tI == 0 {
			tI = live[i].Timestamp
		}
		tJ := live[j].Created
		if tJ == 0 {
			tJ = live[j].Timestamp
		}
		if tI != tJ {
			return tI < tJ
		}
		return live[i].Timestamp < live[j].Timestamp
	})

	sort.Slice(historical, func(i, j int) bool {
		tI := historical[i].Created
		if tI == 0 {
			tI = historical[i].Timestamp
		}
		tJ := historical[j].Created
		if tJ == 0 {
			tJ = historical[j].Timestamp
		}
		if tI != tJ {
			return tI < tJ
		}
		return historical[i].Timestamp < historical[j].Timestamp
	})
	return live, historical
}

var (
	f2bInstalledMu   sync.Mutex
	f2bInstalled     bool
	f2bInstalledTime time.Time
)

func (j *CheckClientIpJob) checkFail2BanInstalled() bool {
	if !isFail2BanEnabled() {
		return false
	}
	f2bInstalledMu.Lock()
	defer f2bInstalledMu.Unlock()
	if !f2bInstalledTime.IsZero() && time.Since(f2bInstalledTime) < 30*time.Second {
		return f2bInstalled
	}
	cmd := "fail2ban-client"
	args := []string{"-h"}
	err := exec.CommandContext(context.Background(), cmd, args...).Run()
	f2bInstalled = err == nil
	f2bInstalledTime = time.Now()
	return f2bInstalled
}

func isFail2BanEnabled() bool {
	value, ok := os.LookupEnv("DUI_ENABLE_FAIL2BAN")
	return !ok || value == "true"
}

func (j *CheckClientIpJob) checkError(e error) {
	if e != nil {
		logger.Warning("client ip job err:", e)
	}
}

// delInboundClientIps drops the inbound_client_ips tracking row for an email
// that no longer maps to any inbound (a renamed or deleted client), so stale
// access-log entries don't keep a ghost row alive (#4963).
func (j *CheckClientIpJob) delInboundClientIps(tx *gorm.DB, clientEmail string) {
	if err := tx.Where("client_email = ?", clientEmail).Delete(&model.InboundClientIps{}).Error; err != nil {
		j.checkError(err)
	}
}

// updateInboundClientIps merges one email's observed IPs into its tracking row
// and applies the IP limit. limitIp comes from the caller (the clients table);
// writes go through the caller's transaction. banned=true asks the caller to
// disconnect the client after the transaction commits.
func (j *CheckClientIpJob) updateInboundClientIps(tx *gorm.DB, inboundClientIps *model.InboundClientIps, inbound *model.Inbound, clientEmail string, limitIp int, newIpsWithTime []IPWithTimestamp, enforce, observedAreLive bool) (shouldCleanLog, banned bool) {
	if inbound.Settings == "" {
		logger.Debug("wrong data:", inbound)
		return false, false
	}

	if !enforce || limitIp <= 0 || !inbound.Enable {
		// Nothing to enforce (collection-only run, no limit on the clients row,
		// or inbound disabled): record the observed IPs for the panel and return.
		jsonIps, _ := json.Marshal(newIpsWithTime)
		inboundClientIps.Ips = string(jsonIps)
		if err := tx.Save(inboundClientIps).Error; err != nil {
			logger.Error("failed to save inboundClientIps:", err)
		}
		return false, false
	}

	// Parse old IPs from database
	var oldIpsWithTime []IPWithTimestamp
	if inboundClientIps.Ips != "" {
		_ = json.Unmarshal([]byte(inboundClientIps.Ips), &oldIpsWithTime)
	}

	ipMap := mergeClientIps(oldIpsWithTime, newIpsWithTime, time.Now().Unix()-ipStaleAfterSeconds, observedAreLive)

	// only ips seen in this scan count toward the limit. see
	// partitionLiveIps.
	observedThisScan := make(map[string]bool, len(newIpsWithTime))
	for _, ipTime := range newIpsWithTime {
		observedThisScan[ipTime.IP] = true
	}
	liveIps, historicalIps := partitionLiveIps(ipMap, observedThisScan)

	j.disAllowedIps = []string{}

	// historical db-only ips are excluded from this count on purpose.
	policy := (&service.SettingService{}).GetIpLimitPolicy()
	keptLive, bannedLive := selectIpsToBan(liveIps, limitIp, policy)
	if len(bannedLive) > 0 {
		shouldCleanLog = true

		isKickOnly := policy == "kick_only" || policy == "kick_oldest_kick_only" || policy == "block_newest_kick_only"
		if !isKickOnly {
			logIpFile, err := os.OpenFile(xray.GetIPLimitLogPath(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
			if err != nil {
				logger.Errorf("failed to open IP limit log file: %s", err)
				return false, false
			}
			defer logIpFile.Close()
			ipLogger := log.New(logIpFile, "", log.LstdFlags)

			// log format is load-bearing: d-ui.sh create_iplimit_jails builds
			// filter.d/dui-ipl.conf with
			//   failregex = \[LIMIT_IP\]\s*Email\s*=\s*<F-USER>.+</F-USER>\s*\|\|\s*Disconnecting OLD IP\s*=\s*<ADDR>\s*\|\|\s*Timestamp\s*=\s*\d+
			// don't change the wording.
			for _, ipTime := range bannedLive {
				j.disAllowedIps = append(j.disAllowedIps, ipTime.IP)
				ipLogger.Printf("[LIMIT_IP] Email = %s || Disconnecting OLD IP = %s || Timestamp = %d", clientEmail, ipTime.IP, ipTime.Timestamp)
			}
			banned = false
		} else {
			for _, ipTime := range bannedLive {
				j.disAllowedIps = append(j.disAllowedIps, ipTime.IP)
			}
			banned = true
		}
	}

	// keep kept-live + historical in the blob so the panel keeps showing
	// recently seen ips. banned live ips are already in the fail2ban log
	// and will reappear in the next scan if they reconnect.
	dbIps := make([]IPWithTimestamp, 0, len(keptLive)+len(historicalIps))
	dbIps = append(dbIps, keptLive...)
	dbIps = append(dbIps, historicalIps...)
	jsonIps, _ := json.Marshal(dbIps)
	inboundClientIps.Ips = string(jsonIps)

	if err := tx.Save(inboundClientIps).Error; err != nil {
		logger.Error("failed to save inboundClientIps:", err)
		return false, banned
	}

	if len(j.disAllowedIps) > 0 {
		logger.Infof("[LIMIT_IP] Client %s: Kept %d live IPs, queued %d old IPs for fail2ban", clientEmail, len(keptLive), len(j.disAllowedIps))
	}

	return shouldCleanLog, banned
}

// disconnectClientTemporarily removes and re-adds a client to force disconnect banned connections
func (j *CheckClientIpJob) disconnectClientTemporarily(inbound *model.Inbound, clientEmail string, clients []model.Client) {
	var xrayAPI xray.XrayAPI
	apiPort := j.resolveXrayAPIPort()

	err := xrayAPI.Init(apiPort)
	if err != nil {
		logger.Warningf("[LIMIT_IP] Failed to init Xray API for disconnection: %v", err)
		return
	}
	defer xrayAPI.Close()

	// Find the client config
	var clientConfig map[string]any
	for _, client := range clients {
		if client.Email == clientEmail {
			// Convert client to map for API
			clientBytes, _ := json.Marshal(client)
			_ = json.Unmarshal(clientBytes, &clientConfig)
			break
		}
	}

	if clientConfig == nil {
		return
	}

	// Only perform remove/re-add for protocols supported by XrayAPI.AddUser
	protocol := string(inbound.Protocol)
	switch protocol {
	case "vmess", "vless", "trojan", "shadowsocks":
		// supported protocols, continue
	default:
		logger.Warningf("[LIMIT_IP] Temporary disconnect is not supported for protocol %s on inbound %s", protocol, inbound.Tag)
		return
	}

	// For Shadowsocks, ensure the required "cipher" field is present by
	// reading it from the inbound settings (e.g., settings["method"]).
	if string(inbound.Protocol) == "shadowsocks" {
		var inboundSettings map[string]any
		if err := json.Unmarshal([]byte(inbound.Settings), &inboundSettings); err != nil {
			logger.Warningf("[LIMIT_IP] Failed to parse inbound settings for shadowsocks cipher: %v", err)
		} else {
			if method, ok := inboundSettings["method"].(string); ok && method != "" {
				clientConfig["cipher"] = method
			}
		}
	}

	// Remove user to disconnect all connections
	err = xrayAPI.RemoveUser(inbound.Tag, clientEmail)
	if err != nil {
		logger.Warningf("[LIMIT_IP] Failed to remove user %s: %v", clientEmail, err)
		return
	}

	// Wait a moment for disconnection to take effect
	time.Sleep(100 * time.Millisecond)

	// Re-add user to allow new connections
	err = xrayAPI.AddUser(protocol, inbound.Tag, clientConfig)
	if err != nil {
		logger.Warningf("[LIMIT_IP] Failed to re-add user %s: %v", clientEmail, err)
	}
}

// resolveXrayAPIPort returns the API inbound port from running config, then template config, then default.
func (j *CheckClientIpJob) resolveXrayAPIPort() int {
	var configErr error
	var templateErr error

	if port, err := getAPIPortFromConfigPath(xray.GetConfigPath()); err == nil {
		return port
	} else {
		configErr = err
	}

	db := database.GetDB()
	var template model.Setting
	if err := db.Where("key = ?", "xrayTemplateConfig").First(&template).Error; err == nil {
		if port, parseErr := getAPIPortFromConfigData([]byte(template.Value)); parseErr == nil {
			return port
		} else {
			templateErr = parseErr
		}
	} else {
		templateErr = err
	}

	logger.Warningf(
		"[LIMIT_IP] Could not determine Xray API port from config or template; falling back to default port %d (config error: %v, template error: %v)",
		defaultXrayAPIPort,
		configErr,
		templateErr,
	)

	return defaultXrayAPIPort
}

func getAPIPortFromConfigPath(configPath string) (int, error) {
	configData, err := os.ReadFile(configPath)
	if err != nil {
		return 0, err
	}

	return getAPIPortFromConfigData(configData)
}

func getAPIPortFromConfigData(configData []byte) (int, error) {
	xrayConfig := &xray.Config{}
	if err := json.Unmarshal(configData, xrayConfig); err != nil {
		return 0, err
	}

	for _, inboundConfig := range xrayConfig.InboundConfigs {
		if inboundConfig.Tag == "api" && inboundConfig.Port > 0 {
			return inboundConfig.Port, nil
		}
	}

	return 0, errors.New("api inbound port not found")
}

// getInboundByEmail resolves the inbound that owns a client email. It prefers
// the exact clients/client_inbounds relation; a substring "settings LIKE
// %email%" can match the wrong inbound (an email that is a substring of another,
// or text that merely appears elsewhere in the settings JSON). The LIKE + JSON
// scan stays only as a fallback for clients not yet present in the relation, so
// nothing regresses when the join finds no row.
func (j *CheckClientIpJob) getInboundsByEmail(clientEmail string) ([]*model.Inbound, error) {
	db := database.GetDB()
	var inbounds []*model.Inbound

	err := db.Model(&model.Inbound{}).
		Joins("JOIN client_inbounds ON client_inbounds.inbound_id = inbounds.id").
		Joins("JOIN clients ON clients.id = client_inbounds.client_id").
		Where("clients.email = ?", clientEmail).
		Find(&inbounds).Error
	if err == nil && len(inbounds) > 0 {
		return inbounds, nil
	}

	var candidates []model.Inbound
	if listErr := db.Model(&model.Inbound{}).Where("settings LIKE ?", "%"+clientEmail+"%").Find(&candidates).Error; listErr != nil {
		return nil, listErr
	}
	for i := range candidates {
		settings := map[string][]model.Client{}
		if jsonErr := json.Unmarshal([]byte(candidates[i].Settings), &settings); jsonErr != nil {
			continue
		}
		for _, client := range settings["clients"] {
			if client.Email == clientEmail {
				inbounds = append(inbounds, &candidates[i])
				break
			}
		}
	}
	if len(inbounds) > 0 {
		return inbounds, nil
	}
	return nil, err
}
