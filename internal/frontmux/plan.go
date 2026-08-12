package frontmux

import (
	"errors"
	"fmt"
	"net"
	"sort"
	"strconv"
	"strings"
)

const (
	KindTLSSNI    = "tls-sni"
	KindHTTP1     = "http1"
	KindHTTP2     = "http2-preface"
	KindRaw       = "raw-catch-all"
	ProxyProtocol = "v1"
)

// Plan is the complete desired public-listener topology. It contains no
// credentials: backends are loopback sockets owned by Xray and selectors are
// only the public metadata needed to route a connection without decrypting it.
type Plan struct {
	Groups []Group `json:"groups"`
}

// Group owns one public TCP socket and routes each accepted connection to one
// of its loopback Xray backends.
type Group struct {
	ID                 string  `json:"id"`
	Listen             string  `json:"listen"`
	Port               int     `json:"port"`
	ClassificationMS   int     `json:"classificationMs"`
	MaxInspectBytes    int     `json:"maxInspectBytes"`
	MaxConcurrentConns int     `json:"maxConcurrentConns"`
	Routes             []Route `json:"routes"`
}

// Route is deliberately restrictive. Phase 1 supports only selectors that can
// be classified before TLS/REALITY termination: exact SNI, exact HTTP/1
// host/path, the cleartext HTTP/2 connection preface, or one final raw catch-all.
type Route struct {
	ID       string   `json:"id"`
	Backend  string   `json:"backend"`
	Network  string   `json:"network"`
	Security string   `json:"security"`
	Kind     string   `json:"kind"`
	SNI      []string `json:"sni,omitempty"`
	Hosts    []string `json:"hosts,omitempty"`
	Paths    []string `json:"paths,omitempty"`
}

func (p Plan) Empty() bool {
	return len(p.Groups) == 0
}

func (p Plan) Equal(other Plan) bool {
	left := p.Canonical()
	right := other.Canonical()
	if len(left.Groups) != len(right.Groups) {
		return false
	}
	for index := range left.Groups {
		if !left.Groups[index].equal(right.Groups[index]) {
			return false
		}
	}
	return true
}

func (p Plan) Canonical() Plan {
	out := Plan{Groups: append([]Group(nil), p.Groups...)}
	for index := range out.Groups {
		out.Groups[index] = out.Groups[index].canonical()
	}
	sort.Slice(out.Groups, func(i, j int) bool {
		if out.Groups[i].Listen != out.Groups[j].Listen {
			return out.Groups[i].Listen < out.Groups[j].Listen
		}
		if out.Groups[i].Port != out.Groups[j].Port {
			return out.Groups[i].Port < out.Groups[j].Port
		}
		return out.Groups[i].ID < out.Groups[j].ID
	})
	return out
}

func (g Group) canonical() Group {
	out := g
	out.Routes = append([]Route(nil), g.Routes...)
	for index := range out.Routes {
		out.Routes[index] = out.Routes[index].canonical()
	}
	sort.Slice(out.Routes, func(i, j int) bool {
		return out.Routes[i].ID < out.Routes[j].ID
	})
	return out
}

func (r Route) canonical() Route {
	out := r
	out.SNI = canonicalStrings(r.SNI)
	out.Hosts = canonicalHosts(r.Hosts)
	out.Paths = canonicalPaths(r.Paths)
	return out
}

func (g Group) equal(other Group) bool {
	if g.ID != other.ID || g.Listen != other.Listen || g.Port != other.Port ||
		g.ClassificationMS != other.ClassificationMS ||
		g.MaxInspectBytes != other.MaxInspectBytes ||
		g.MaxConcurrentConns != other.MaxConcurrentConns ||
		len(g.Routes) != len(other.Routes) {
		return false
	}
	for index := range g.Routes {
		if !g.Routes[index].equal(other.Routes[index]) {
			return false
		}
	}
	return true
}

func (r Route) equal(other Route) bool {
	return r.ID == other.ID && r.Backend == other.Backend &&
		r.Network == other.Network && r.Security == other.Security &&
		r.Kind == other.Kind && stringSlicesEqual(r.SNI, other.SNI) &&
		stringSlicesEqual(r.Hosts, other.Hosts) &&
		stringSlicesEqual(r.Paths, other.Paths)
}

func (p Plan) Validate() error {
	canonical := p.Canonical()
	seenGroups := map[string]struct{}{}
	seenGroupIDs := map[string]struct{}{}
	seenBackends := map[string]string{}
	for groupIndex := range canonical.Groups {
		group := canonical.Groups[groupIndex]
		if err := group.Validate(); err != nil {
			return fmt.Errorf("frontmux group %d: %w", groupIndex+1, err)
		}
		if _, exists := seenGroupIDs[group.ID]; exists {
			return fmt.Errorf("duplicate frontmux group id %q", group.ID)
		}
		seenGroupIDs[group.ID] = struct{}{}
		key := listenerKey(group.Listen, group.Port)
		if _, exists := seenGroups[key]; exists {
			return fmt.Errorf("duplicate public listener %s", key)
		}
		seenGroups[key] = struct{}{}
		for _, route := range group.Routes {
			if previous, exists := seenBackends[route.Backend]; exists {
				return fmt.Errorf("backend %q is shared by groups %q and %q", route.Backend, previous, group.ID)
			}
			seenBackends[route.Backend] = group.ID
		}
	}
	for left := 0; left < len(canonical.Groups); left++ {
		for right := left + 1; right < len(canonical.Groups); right++ {
			if listenersOverlap(canonical.Groups[left], canonical.Groups[right]) {
				return fmt.Errorf(
					"public listeners %s and %s overlap",
					listenerKey(canonical.Groups[left].Listen, canonical.Groups[left].Port),
					listenerKey(canonical.Groups[right].Listen, canonical.Groups[right].Port),
				)
			}
		}
	}
	for _, owner := range canonical.Groups {
		for _, route := range owner.Routes {
			backendHost, backendPortText, _ := net.SplitHostPort(route.Backend)
			backendPort, _ := strconv.Atoi(backendPortText)
			backendGroup := Group{Listen: strings.Trim(backendHost, "[]"), Port: backendPort}
			for _, public := range canonical.Groups {
				if listenersOverlap(backendGroup, public) {
					return fmt.Errorf("backend %q for route %q overlaps public listener %s", route.Backend, route.ID, listenerKey(public.Listen, public.Port))
				}
			}
		}
	}
	return nil
}

func (g Group) Validate() error {
	if strings.TrimSpace(g.ID) == "" {
		return errors.New("id is required")
	}
	if g.Port < 1 || g.Port > 65535 {
		return fmt.Errorf("port %d is outside 1..65535", g.Port)
	}
	if _, err := normalizeListen(g.Listen); err != nil {
		return err
	}
	if g.ClassificationMS < 100 || g.ClassificationMS > 30_000 {
		return fmt.Errorf("classification timeout %dms is outside 100..30000", g.ClassificationMS)
	}
	if g.MaxInspectBytes < 1024 || g.MaxInspectBytes > 1<<20 {
		return fmt.Errorf("max inspect bytes %d is outside 1024..1048576", g.MaxInspectBytes)
	}
	if g.MaxConcurrentConns < 1 || g.MaxConcurrentConns > 1_000_000 {
		return fmt.Errorf("max concurrent connections %d is outside 1..1000000", g.MaxConcurrentConns)
	}
	if len(g.Routes) < 2 {
		return errors.New("requires at least two routes")
	}

	seenIDs := map[string]struct{}{}
	seenBackends := map[string]struct{}{}
	seenSNI := map[string]string{}
	seenHTTP := map[string]string{}
	rawCount := 0
	http2Count := 0

	for routeIndex := range g.Routes {
		route := g.Routes[routeIndex].canonical()
		if err := route.Validate(); err != nil {
			return fmt.Errorf("route %d: %w", routeIndex+1, err)
		}
		if _, exists := seenIDs[route.ID]; exists {
			return fmt.Errorf("route id %q is duplicated", route.ID)
		}
		seenIDs[route.ID] = struct{}{}
		if _, exists := seenBackends[route.Backend]; exists {
			return fmt.Errorf("backend %q is duplicated", route.Backend)
		}
		seenBackends[route.Backend] = struct{}{}

		switch route.Kind {
		case KindTLSSNI:
			for _, sni := range route.SNI {
				if previous, exists := seenSNI[sni]; exists {
					return fmt.Errorf("SNI %q is ambiguous between routes %q and %q", sni, previous, route.ID)
				}
				seenSNI[sni] = route.ID
			}
		case KindHTTP1:
			for _, host := range hostVariants(route.Hosts) {
				for _, path := range route.Paths {
					key := host + "\x00" + path
					if previous, exists := seenHTTP[key]; exists {
						return fmt.Errorf("HTTP selector host=%q path=%q is ambiguous between routes %q and %q", host, path, previous, route.ID)
					}
					seenHTTP[key] = route.ID
				}
			}
		case KindHTTP2:
			http2Count++
		case KindRaw:
			rawCount++
		}
	}
	for left := 0; left < len(g.Routes); left++ {
		leftRoute := g.Routes[left].canonical()
		if leftRoute.Kind != KindHTTP1 {
			continue
		}
		for right := left + 1; right < len(g.Routes); right++ {
			rightRoute := g.Routes[right].canonical()
			if rightRoute.Kind != KindHTTP1 || !stringsIntersect(leftRoute.Paths, rightRoute.Paths) {
				continue
			}
			if len(leftRoute.Hosts) == 0 || len(rightRoute.Hosts) == 0 || stringsIntersect(leftRoute.Hosts, rightRoute.Hosts) {
				return fmt.Errorf("HTTP selectors overlap between routes %q and %q", leftRoute.ID, rightRoute.ID)
			}
		}
	}

	if rawCount > 1 {
		return errors.New("only one raw catch-all route is allowed")
	}
	if http2Count > 1 {
		return errors.New("only one cleartext HTTP/2 route is allowed")
	}
	return nil
}

func (r Route) Validate() error {
	if strings.TrimSpace(r.ID) == "" {
		return errors.New("id is required")
	}
	if strings.TrimSpace(r.Backend) == "" {
		return errors.New("backend is required")
	}
	host, port, err := net.SplitHostPort(r.Backend)
	if err != nil {
		return fmt.Errorf("invalid backend %q: %w", r.Backend, err)
	}
	ip := net.ParseIP(strings.Trim(host, "[]"))
	if ip == nil || !ip.IsLoopback() {
		return fmt.Errorf("backend %q must use a loopback IP literal", r.Backend)
	}
	portNumber, parseErr := strconv.Atoi(port)
	if parseErr != nil || portNumber < 1 || portNumber > 65535 {
		return fmt.Errorf("backend %q must use a port in 1..65535", r.Backend)
	}

	switch r.Kind {
	case KindTLSSNI:
		if r.Security != "tls" && r.Security != "reality" {
			return fmt.Errorf("TLS-SNI route security %q must be tls or reality", r.Security)
		}
		switch r.Network {
		case "tcp", "ws", "grpc", "httpupgrade", "xhttp":
		default:
			return fmt.Errorf("TLS-SNI route network %q is not TCP-family", r.Network)
		}
		if len(r.SNI) == 0 {
			return errors.New("TLS-SNI route requires at least one exact SNI")
		}
		for _, value := range r.SNI {
			normalized, err := NormalizeServerName(value)
			if err != nil || normalized == "" || strings.Contains(value, "*") {
				if err != nil {
					return err
				}
				return fmt.Errorf("SNI %q is not an exact DNS selector", value)
			}
		}
		if len(r.Hosts) > 0 || len(r.Paths) > 0 {
			return errors.New("TLS-SNI route cannot contain HTTP selectors")
		}
	case KindHTTP1:
		if r.Security != "none" {
			return fmt.Errorf("HTTP/1 route security %q must be none", r.Security)
		}
		if r.Network != "ws" && r.Network != "httpupgrade" {
			return fmt.Errorf("HTTP/1 route network %q must be ws or httpupgrade", r.Network)
		}
		if len(r.Paths) == 0 {
			return errors.New("HTTP/1 route requires at least one exact path")
		}
		for _, path := range r.Paths {
			if _, err := NormalizeHTTPPath(path); err != nil {
				return err
			}
		}
		for _, host := range r.Hosts {
			if _, err := NormalizeHTTPHost(host); err != nil {
				return err
			}
		}
		if len(r.SNI) > 0 {
			return errors.New("HTTP/1 route cannot contain SNI selectors")
		}
	case KindHTTP2:
		if r.Security != "none" || r.Network != "grpc" {
			return fmt.Errorf("HTTP/2-preface route must be grpc/none, got %s/%s", r.Network, r.Security)
		}
		if len(r.SNI) > 0 || len(r.Hosts) > 0 || len(r.Paths) > 0 {
			return errors.New("HTTP/2-preface route cannot contain extra selectors")
		}
	case KindRaw:
		if r.Security != "none" || r.Network != "tcp" {
			return errors.New("raw catch-all route must be tcp/none")
		}
		if len(r.SNI) > 0 || len(r.Hosts) > 0 || len(r.Paths) > 0 {
			return errors.New("raw catch-all route cannot contain selectors")
		}
	default:
		return fmt.Errorf("unsupported route kind %q", r.Kind)
	}
	return nil
}

func normalizeListen(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "0.0.0.0", nil
	}
	candidate := strings.TrimPrefix(strings.TrimSuffix(value, "]"), "[")
	ip := net.ParseIP(candidate)
	if ip == nil {
		return "", fmt.Errorf("listen %q must be an IP literal", value)
	}
	return ip.String(), nil
}

func listenerKey(listen string, port int) string {
	normalized, _ := normalizeListen(listen)
	return net.JoinHostPort(normalized, fmt.Sprintf("%d", port))
}

func listenersOverlap(left, right Group) bool {
	if left.Port != right.Port {
		return false
	}
	leftListen, leftErr := normalizeListen(left.Listen)
	rightListen, rightErr := normalizeListen(right.Listen)
	if leftErr != nil || rightErr != nil {
		return false
	}
	leftIP := net.ParseIP(leftListen)
	rightIP := net.ParseIP(rightListen)
	if leftIP.IsUnspecified() || rightIP.IsUnspecified() {
		return true
	}
	return leftIP.Equal(rightIP)
}

func canonicalStrings(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.ToLower(strings.TrimSpace(value))
		value = strings.TrimSuffix(value, ".")
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	sort.Strings(out)
	return out
}

func canonicalHosts(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		normalized, err := NormalizeHTTPHost(value)
		if err != nil || normalized == "" {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		out = append(out, normalized)
	}
	sort.Strings(out)
	return out
}

func canonicalPaths(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		normalized, err := NormalizeHTTPPath(value)
		if err != nil {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		out = append(out, normalized)
	}
	sort.Strings(out)
	return out
}

func hostVariants(hosts []string) []string {
	canonical := canonicalStrings(hosts)
	if len(canonical) == 0 {
		return []string{""}
	}
	return canonical
}

func stringsIntersect(left, right []string) bool {
	seen := make(map[string]struct{}, len(left))
	for _, value := range left {
		seen[value] = struct{}{}
	}
	for _, value := range right {
		if _, exists := seen[value]; exists {
			return true
		}
	}
	return false
}

func stringSlicesEqual(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
