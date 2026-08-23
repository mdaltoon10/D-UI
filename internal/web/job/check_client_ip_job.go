package job

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"time"

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

var (
	job             *CheckClientIpJob
	blackholeIPs    = make(map[string]int64) // IP -> Expiration Unix timestamp
	blackholeEmails = make(map[string]string) // IP -> Email of the client
	blackholeMu     sync.Mutex
)

const defaultXrayAPIPort = 62789

const ipStaleAfterSeconds = int64(30 * 60)

// NewCheckClientIpJob creates a new client IP monitoring job instance.
func NewCheckClientIpJob() *CheckClientIpJob {
	job = new(CheckClientIpJob)
	return job
}

func (j *CheckClientIpJob) Run() {
	j.cleanExpiredBlackholes()

	observed, apiMode := j.collectFromOnlineAPI()
	if !apiMode {
		// xray is down or predates the online-stats API. There is no access-log
		// fallback anymore, so there is nothing to do this run.
		logger.Debug("[LimitIP] online-stats API unavailable this run; skipping")
		return
	}

	// Dynamic Self-Healing for ALL blackholed/banned emails:
	// If a client has any banned IPs, but their current active (unbanned) connection count
	// is below their allowed limit, we instantly unban them!
	// This ensures that when the active user goes offline, any other blocked users
	// of that client are instantly unbanned in the next 1-second scan.
	blackholeMu.Lock()
	blackholeEmailsCopy := make(map[string]string, len(blackholeEmails))
	for ip, email := range blackholeEmails {
		blackholeEmailsCopy[ip] = email
	}
	blackholeMu.Unlock()

	emailsToCheck := make(map[string]bool)
	for _, email := range blackholeEmailsCopy {
		emailsToCheck[email] = true
	}

	if len(emailsToCheck) > 0 {
		var emailList []string
		for email := range emailsToCheck {
			emailList = append(emailList, email)
		}
		limits := j.loadClientLimits(emailList)
		for _, email := range emailList {
			limit := limits[email]
			if limit <= 0 {
				// No limit or disabled limit: unban all IPs for this client
				unbanClientIps(email)
				continue
			}

			// Count currently active unbanned IPs
			activeCount := 0
			if ipMap, ok := observed[email]; ok {
				for ip := range ipMap {
					blackholeMu.Lock()
					_, isBanned := blackholeIPs[ip]
					blackholeMu.Unlock()
					if !isBanned {
						activeCount++
					}
				}
			}

			if activeCount < limit {
				// Instantly unban all banned IPs of this client because they have free slots!
				unbanClientIps(email)
			}
		}
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
			// from blocking new ones, we ignore IPs that haven't been active in the last 30 seconds.
			// (Optimized to 30s so idle users reading pages are not falsely marked offline, while keeping limits highly reactive).
			if now-ts > 30 {
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
// normalized clients table and inbounds settings.
func (j *CheckClientIpJob) hasLimitIp() bool {
	db := database.GetDB()
	var probe int64
	if err := db.Model(&model.ClientRecord{}).Where("limit_ip > 0").Limit(1).Count(&probe).Error; err == nil && probe > 0 {
		return true
	}
	var inboundProbe int64
	if err := db.Model(&model.Inbound{}).Where("settings LIKE ?", "%limitIp%").Limit(1).Count(&inboundProbe).Error; err == nil && inboundProbe > 0 {
		return true
	}
	return false
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
// chunked queries, falling back to inbounds settings if not found in clients table.
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
	// Fallback to check inbound settings for any emails with limit 0 or missing
	for _, email := range emails {
		if out[email] <= 0 {
			var inbounds []model.Inbound
			if err := db.Model(&model.Inbound{}).Where("settings LIKE ?", "%"+email+"%").Find(&inbounds).Error; err == nil {
				for _, ib := range inbounds {
					settings := map[string][]model.Client{}
					if jsonErr := json.Unmarshal([]byte(ib.Settings), &settings); jsonErr == nil {
						for _, client := range settings["clients"] {
							if client.Email == email && client.LimitIP > 0 {
								out[email] = client.LimitIP
								break
							}
						}
					}
					if out[email] > 0 {
						break
					}
				}
			}
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
		// timestamp from the synced database is recent (within 30 seconds).
		// This ensures cluster-wide limits work even if the IP was seen on another node.
		if observedThisScan[ip] || now-entry.Timestamp <= 30 {
			live = append(live, entry)
		} else {
			historical = append(historical, entry)
		}
	}

	// Sort live IPs oldest-first.
	// We prefer sorting by Created timestamp to track actual connection start time.
	// If Created is 0, we fall back to Timestamp.
	// Critical: Actively transmitting local IPs (present in observedThisScan) always take priority over
	// recently inactive/ghost IPs. This prevents offline or idle connections from blocking active ones.
	sort.Slice(live, func(i, j int) bool {
		obsI := observedThisScan[live[i].IP]
		obsJ := observedThisScan[live[j].IP]
		if obsI != obsJ {
			return obsI
		}

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

func (j *CheckClientIpJob) cleanExpiredBlackholes() {
	blackholeMu.Lock()
	defer blackholeMu.Unlock()
	now := time.Now().Unix()
	for ip, expireAt := range blackholeIPs {
		if now >= expireAt {
			unbanIpDirectlyNoLock(ip)
			delete(blackholeIPs, ip)
			delete(blackholeEmails, ip)
		}
	}
}

func unbanClientIps(email string) {
	blackholeMu.Lock()
	defer blackholeMu.Unlock()
	for ip, e := range blackholeEmails {
		if e == email {
			unbanIpDirectlyNoLock(ip)
			delete(blackholeIPs, ip)
			delete(blackholeEmails, ip)
		}
	}
}

func unbanIpDirectly(ip string) {
	blackholeMu.Lock()
	defer blackholeMu.Unlock()
	unbanIpDirectlyNoLock(ip)
}

func unbanIpDirectlyNoLock(ip string) {
	if ip == "" || ip == "127.0.0.1" || ip == "::1" {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	logger.Infof("[LIMIT_IP] Removing kernel blackhole route and firewall rule for IP: %s", ip)

	if strings.Contains(ip, ":") {
		deleteIptablesRuleAll(ctx, "ip6tables", "INPUT", "-s", ip)
		deleteIptablesRuleAll(ctx, "ip6tables", "OUTPUT", "-d", ip)
		deleteIptablesRuleAll(ctx, "ip6tables", "FORWARD", "-s", ip)
		subnet64 := getIPv6Subnet64(ip)
		if subnet64 != "" {
			deleteIptablesRuleAll(ctx, "ip6tables", "INPUT", "-s", subnet64)
			deleteIptablesRuleAll(ctx, "ip6tables", "OUTPUT", "-d", subnet64)
			deleteIptablesRuleAll(ctx, "ip6tables", "FORWARD", "-s", subnet64)
		}
		runSysCmd(ctx, "ip", "-6", "route", "del", "blackhole", ip)
		runSysCmd(ctx, "ip", "-6", "route", "del", ip)
		runSysCmd(ctx, "ufw", "delete", "deny", "from", ip)
		runSysCmd(ctx, "fail2ban-client", "unban", ip)
		runSysCmd(ctx, "fail2ban-client", "set", "dui-ipl-v6", "unbanip", ip)
		runSysCmd(ctx, "fail2ban-client", "set", "dui-ipl", "unbanip", ip)
	} else {
		deleteIptablesRuleAll(ctx, "iptables", "INPUT", "-s", ip)
		deleteIptablesRuleAll(ctx, "iptables", "OUTPUT", "-d", ip)
		deleteIptablesRuleAll(ctx, "iptables", "FORWARD", "-s", ip)
		runSysCmd(ctx, "ip", "route", "del", "blackhole", ip)
		runSysCmd(ctx, "ip", "route", "del", ip)
		runSysCmd(ctx, "ufw", "delete", "deny", "from", ip)
		runSysCmd(ctx, "fail2ban-client", "unban", ip)
		runSysCmd(ctx, "fail2ban-client", "set", "dui-ipl", "unbanip", ip)
	}
}

func deleteIptablesRuleAll(ctx context.Context, cmdName, chain, flag, ip string) {
	for i := 0; i < 20; i++ {
		binPath, err := exec.LookPath(cmdName)
		if err != nil {
			binPath = "/sbin/" + cmdName
		}
		var cmd *exec.Cmd
		if os.Geteuid() == 0 {
			cmd = exec.CommandContext(ctx, binPath, "-D", chain, flag, ip, "-j", "DROP")
		} else {
			cmd = exec.CommandContext(ctx, "sudo", "-n", binPath, "-D", chain, flag, ip, "-j", "DROP")
		}
		if err := cmd.Run(); err != nil {
			break
		}
	}
}

func getIPv6Subnet64(ipStr string) string {
	ip := net.ParseIP(ipStr)
	if ip == nil || ip.To4() != nil {
		return ""
	}
	mask := net.CIDRMask(64, 128)
	network := ip.Mask(mask)
	return fmt.Sprintf("%s/64", network.String())
}

func runSysCmd(ctx context.Context, name string, args ...string) {
	binPath, err := exec.LookPath(name)
	if err != nil {
		for _, p := range []string{"/sbin/" + name, "/usr/sbin/" + name, "/usr/bin/" + name, "/bin/" + name} {
			if _, statErr := os.Stat(p); statErr == nil {
				binPath = p
				break
			}
		}
	}
	if binPath == "" {
		binPath = name
	}

	if os.Geteuid() == 0 {
		cmd := exec.CommandContext(ctx, binPath, args...)
		_ = cmd.Run()
		return
	}

	cmdSudo := exec.CommandContext(ctx, "sudo", append([]string{"-n", binPath}, args...)...)
	if err := cmdSudo.Run(); err == nil {
		return
	}

	cmd := exec.CommandContext(ctx, binPath, args...)
	_ = cmd.Run()
}

func banIpDirectly(ip string, email string) {
	if ip == "" || ip == "127.0.0.1" || ip == "::1" {
		return
	}

	// Track and manage auto-unbanning in 5 minutes (300 seconds)
	blackholeMu.Lock()
	_, alreadyBanned := blackholeIPs[ip]
	blackholeIPs[ip] = time.Now().Unix() + 300
	blackholeEmails[ip] = email
	blackholeMu.Unlock()

	// If this IP is already banned, skip re-executing firewall rules to prevent rule accumulation
	if alreadyBanned {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	logger.Infof("[LIMIT_IP] Applying kernel blackhole route and killing connections for IP: %s (Client: %s)", ip, email)

	if strings.Contains(ip, ":") {
		// IPv6 address: Drop at position 1, add blackhole, & reset connections
		runSysCmd(ctx, "ip6tables", "-I", "INPUT", "1", "-s", ip, "-j", "DROP")
		runSysCmd(ctx, "ip6tables", "-I", "OUTPUT", "1", "-d", ip, "-j", "DROP")
		runSysCmd(ctx, "ip6tables", "-I", "FORWARD", "1", "-s", ip, "-j", "DROP")
		subnet64 := getIPv6Subnet64(ip)
		if subnet64 != "" {
			runSysCmd(ctx, "ip6tables", "-I", "INPUT", "1", "-s", subnet64, "-j", "DROP")
			runSysCmd(ctx, "ip6tables", "-I", "OUTPUT", "1", "-d", subnet64, "-j", "DROP")
			runSysCmd(ctx, "ip6tables", "-I", "FORWARD", "1", "-s", subnet64, "-j", "DROP")
		}
		runSysCmd(ctx, "ip", "-6", "route", "replace", "blackhole", ip)
		runSysCmd(ctx, "fail2ban-client", "set", "dui-ipl-v6", "banip", ip)
		runSysCmd(ctx, "fail2ban-client", "set", "dui-ipl", "banip", ip)
		runSysCmd(ctx, "ss", "-K", "dst", fmt.Sprintf("[%s]", ip))
		runSysCmd(ctx, "ss", "-K", "src", fmt.Sprintf("[%s]", ip))
		runSysCmd(ctx, "conntrack", "-D", "-s", ip)
		runSysCmd(ctx, "conntrack", "-D", "-d", ip)
		runSysCmd(ctx, "ufw", "deny", "from", ip)
	} else {
		// IPv4 address: Drop at position 1, add blackhole, & reset connections
		runSysCmd(ctx, "iptables", "-I", "INPUT", "1", "-s", ip, "-j", "DROP")
		runSysCmd(ctx, "iptables", "-I", "OUTPUT", "1", "-d", ip, "-j", "DROP")
		runSysCmd(ctx, "iptables", "-I", "FORWARD", "1", "-s", ip, "-j", "DROP")
		runSysCmd(ctx, "ip", "route", "replace", "blackhole", ip)
		runSysCmd(ctx, "fail2ban-client", "set", "dui-ipl", "banip", ip)
		runSysCmd(ctx, "ss", "-K", "dst", ip)
		runSysCmd(ctx, "ss", "-K", "src", ip)
		runSysCmd(ctx, "conntrack", "-D", "-s", ip)
		runSysCmd(ctx, "conntrack", "-D", "-d", ip)
		runSysCmd(ctx, "ufw", "deny", "from", ip)
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

	if limitIp <= 0 && inbound.Settings != "" {
		settings := map[string][]model.Client{}
		if err := json.Unmarshal([]byte(inbound.Settings), &settings); err == nil {
			for _, client := range settings["clients"] {
				if client.Email == clientEmail && client.LimitIP > 0 {
					limitIp = client.LimitIP
					break
				}
			}
		}
	}

	if limitIp <= 0 || !inbound.Enable {
		// Nothing to enforce (no limit on the client, or inbound disabled):
		// record the observed IPs for the panel and return.
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

	// Calculate precise current active unbanned user count
	var otherNodesCount int64
	if tx.Model(&model.Node{}).Where("enable = ?", true).Count(&otherNodesCount).Error != nil {
		otherNodesCount = 0
	}

	activeCount := 0
	for _, ipTime := range liveIps {
		blackholeMu.Lock()
		_, isBanned := blackholeIPs[ipTime.IP]
		blackholeMu.Unlock()
		if isBanned {
			continue
		}

		if otherNodesCount == 0 {
			// Single-node setup: count as active only if observed locally transmitting data in this scan
			if observedThisScan[ipTime.IP] {
				activeCount++
			}
		} else {
			// Multi-node setup fallback: count as active if observed locally OR seen recently in synced database
			if observedThisScan[ipTime.IP] || time.Now().Unix()-ipTime.Timestamp <= 30 {
				activeCount++
			}
		}
	}

	policy := (&service.SettingService{}).GetIpLimitPolicy()
	var keptLive, bannedLive []IPWithTimestamp

	// If the number of currently active unbanned IPs is strictly less than the limit,
	// we have empty slots! Instantly unban all previously blocked IPs of this client for dynamic self-healing.
	if activeCount < limitIp {
		unbanClientIps(clientEmail)
		keptLive = liveIps
		bannedLive = nil
	} else {
		// Otherwise, select which IPs to keep and which to ban/reject
		keptLive, bannedLive = selectIpsToBan(liveIps, limitIp, policy)
	}

	if len(bannedLive) > 0 {
		shouldCleanLog = true

		isKickOnly := policy == "kick_only" || policy == "kick_oldest_kick_only" || policy == "block_newest_kick_only"
		if !isKickOnly {
			logIpFile, err := os.OpenFile(xray.GetIPLimitLogPath(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
			if err == nil {
				ipLogger := log.New(logIpFile, "", log.LstdFlags)
				for _, ipTime := range bannedLive {
					j.disAllowedIps = append(j.disAllowedIps, ipTime.IP)
					ipLogger.Printf("[LIMIT_IP] Email = %s || Disconnecting OLD IP = %s || Timestamp = %d", clientEmail, ipTime.IP, ipTime.Timestamp)
				}
				_ = logIpFile.Close()
			}
			banned = true // Always force banned = true to trigger Xray API disconnect for robust socket killing
		} else {
			for _, ipTime := range bannedLive {
				j.disAllowedIps = append(j.disAllowedIps, ipTime.IP)
			}
			banned = true
		}

		// Direct, instant, ruthless kernel-level firewall block and socket kill
		for _, ipTime := range bannedLive {
			banIpDirectly(ipTime.IP, clientEmail)
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
		logger.Infof("[LIMIT_IP] Client %s: Kept %d live IPs, blocked %d exceeding IPs immediately", clientEmail, len(keptLive), len(j.disAllowedIps))
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
