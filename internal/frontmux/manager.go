package frontmux

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

const (
	backendDialTimeout       = 2 * time.Second
	copyBufferSize           = 32 * 1024
	globalMaxConcurrentConns = 8 * 1024
)

var copyBufferPool = sync.Pool{New: func() any {
	buffer := make([]byte, copyBufferSize)
	return &buffer
}}

type ErrorHandler func(error)

type Manager struct {
	mu      sync.Mutex
	running *runningPlan
	onError ErrorHandler

	errorMu       sync.Mutex
	lastError     map[string]time.Time
	suppressedErr map[string]uint64
}

type runningPlan struct {
	plan            Plan
	ctx             context.Context
	cancel          context.CancelFunc
	listeners       []net.Listener
	groups          sync.WaitGroup
	conns           sync.WaitGroup
	activeMu        sync.Mutex
	active          map[net.Conn]struct{}
	globalSemaphore chan struct{}
	stopping        atomic.Bool
}

func NewManager(onError ErrorHandler) *Manager {
	return &Manager{
		onError:       onError,
		lastError:     make(map[string]time.Time),
		suppressedErr: make(map[string]uint64),
	}
}

func (m *Manager) Plan() Plan {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.running == nil {
		return Plan{}
	}
	return m.running.plan.Canonical()
}

func (m *Manager) Running() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.running != nil
}

// Start binds every listener before publishing the plan. On any bind failure it
// closes all listeners opened by this attempt and leaves the manager stopped.
func (m *Manager) Start(plan Plan) error {
	canonical := plan.Canonical()
	if err := canonical.Validate(); err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.running != nil {
		return errors.New("frontmux is already running")
	}
	if canonical.Empty() {
		return nil
	}

	globalLimit := 0
	for _, group := range canonical.Groups {
		globalLimit += group.MaxConcurrentConns
		if globalLimit >= globalMaxConcurrentConns {
			globalLimit = globalMaxConcurrentConns
			break
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	running := &runningPlan{
		plan:            canonical,
		ctx:             ctx,
		cancel:          cancel,
		active:          make(map[net.Conn]struct{}),
		globalSemaphore: make(chan struct{}, globalLimit),
	}

	for _, group := range canonical.Groups {
		listener, err := net.Listen("tcp", listenerKey(group.Listen, group.Port))
		if err != nil {
			cancel()
			for _, opened := range running.listeners {
				_ = opened.Close()
			}
			return fmt.Errorf("bind shared-port listener %s: %w", listenerKey(group.Listen, group.Port), err)
		}
		running.listeners = append(running.listeners, listener)
	}

	for index := range canonical.Groups {
		group := canonical.Groups[index]
		listener := running.listeners[index]
		running.groups.Add(1)
		go m.acceptLoop(running, listener, group)
	}
	m.running = running
	return nil
}

// Stop closes listeners and active proxied connections, then waits for all
// goroutines. It is idempotent so rollback paths can call it defensively.
func (m *Manager) Stop() error {
	// Hold the lifecycle mutex through the complete shutdown. This prevents a
	// concurrent Start from racing old listener closure and observing a false
	// EADDRINUSE or, worse, publishing a new plan that a late Stop then tears
	// down.
	m.mu.Lock()
	defer m.mu.Unlock()
	running := m.running
	if running == nil {
		return nil
	}

	running.stopping.Store(true)
	running.cancel()
	var stopErr error
	for _, listener := range running.listeners {
		if err := listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
			stopErr = errors.Join(stopErr, err)
		}
	}

	running.activeMu.Lock()
	for conn := range running.active {
		_ = conn.Close()
	}
	running.activeMu.Unlock()

	running.groups.Wait()
	running.conns.Wait()
	m.running = nil
	return stopErr
}

func (m *Manager) acceptLoop(running *runningPlan, listener net.Listener, group Group) {
	defer running.groups.Done()
	semaphore := make(chan struct{}, group.MaxConcurrentConns)
	backoff := 5 * time.Millisecond

	for {
		conn, err := listener.Accept()
		if err != nil {
			if running.stopping.Load() || errors.Is(err, net.ErrClosed) {
				return
			}
			if temporary, ok := err.(interface{ Temporary() bool }); ok && temporary.Temporary() {
				timer := time.NewTimer(backoff)
				select {
				case <-timer.C:
				case <-running.ctx.Done():
					timer.Stop()
					return
				}
				if backoff < time.Second {
					backoff *= 2
				}
				continue
			}
			m.report(fmt.Errorf("frontmux accept %s: %w", listener.Addr(), err))
			return
		}
		backoff = 5 * time.Millisecond
		if running.stopping.Load() {
			_ = conn.Close()
			return
		}

		select {
		case semaphore <- struct{}{}:
		default:
			_ = conn.Close()
			m.reportLimited(group.ID+":capacity", fmt.Errorf("frontmux %s reached max concurrent connections (%d)", group.ID, group.MaxConcurrentConns))
			continue
		}
		select {
		case running.globalSemaphore <- struct{}{}:
		default:
			<-semaphore
			_ = conn.Close()
			m.reportLimited("global:capacity", fmt.Errorf("frontmux reached global max concurrent connections (%d)", cap(running.globalSemaphore)))
			continue
		}

		running.track(conn)
		running.conns.Add(1)
		go func() {
			defer func() {
				<-running.globalSemaphore
				<-semaphore
				running.conns.Done()
			}()
			m.handleConnection(running, group, conn)
		}()
	}
}

func (m *Manager) handleConnection(running *runningPlan, group Group, client net.Conn) {
	defer func() {
		running.untrack(client)
		_ = client.Close()
	}()

	if tcp, ok := client.(*net.TCPConn); ok {
		_ = tcp.SetKeepAlive(true)
		_ = tcp.SetKeepAlivePeriod(30 * time.Second)
		_ = tcp.SetNoDelay(true)
	}

	hasRaw := false
	for _, route := range group.Routes {
		if route.Kind == KindRaw {
			hasRaw = true
			break
		}
	}

	result, inspected, err := newClassifier(group).classify(client, hasRaw)
	if err != nil {
		m.reportLimited(group.ID+":classify", fmt.Errorf("frontmux %s classify %s: %w", group.ID, client.RemoteAddr(), err))
		return
	}
	route, err := selectRoute(group, result)
	if err != nil {
		m.reportLimited(group.ID+":route", fmt.Errorf("frontmux %s route %s: %w", group.ID, client.RemoteAddr(), err))
		return
	}

	dialer := net.Dialer{Timeout: backendDialTimeout, KeepAlive: 30 * time.Second}
	backend, err := dialer.DialContext(running.ctx, "tcp", route.Backend)
	if err != nil {
		m.reportLimited(group.ID+":dial:"+route.ID, fmt.Errorf("frontmux %s dial backend %s for route %s: %w", group.ID, route.Backend, route.ID, err))
		return
	}
	running.track(backend)
	defer func() {
		running.untrack(backend)
		_ = backend.Close()
	}()
	if tcp, ok := backend.(*net.TCPConn); ok {
		_ = tcp.SetKeepAlive(true)
		_ = tcp.SetKeepAlivePeriod(30 * time.Second)
		_ = tcp.SetNoDelay(true)
	}

	if err := writeProxyV1(backend, client.RemoteAddr(), client.LocalAddr()); err != nil {
		m.reportLimited(group.ID+":proxy:"+route.ID, fmt.Errorf("frontmux %s write PROXY header for route %s: %w", group.ID, route.ID, err))
		return
	}
	if len(inspected) > 0 {
		if _, err := io.Copy(backend, bytes.NewReader(inspected)); err != nil {
			m.reportLimited(group.ID+":replay:"+route.ID, fmt.Errorf("frontmux %s replay inspected bytes for route %s: %w", group.ID, route.ID, err))
			return
		}
	}

	proxyBidirectional(client, backend)
}

func proxyBidirectional(client, backend net.Conn) {
	var wait sync.WaitGroup
	wait.Add(2)
	copyOne := func(destination, source net.Conn) {
		defer wait.Done()
		bufferPtr := copyBufferPool.Get().(*[]byte)
		buffer := *bufferPtr
		defer copyBufferPool.Put(bufferPtr)
		_, _ = io.CopyBuffer(destination, source, buffer)
		if closer, ok := destination.(interface{ CloseWrite() error }); ok {
			_ = closer.CloseWrite()
		}
	}
	go copyOne(backend, client)
	go copyOne(client, backend)
	wait.Wait()
}

func (r *runningPlan) track(conn net.Conn) {
	r.activeMu.Lock()
	r.active[conn] = struct{}{}
	r.activeMu.Unlock()
}

func (r *runningPlan) untrack(conn net.Conn) {
	r.activeMu.Lock()
	delete(r.active, conn)
	r.activeMu.Unlock()
}

func (m *Manager) reportLimited(key string, err error) {
	if err == nil || m.onError == nil {
		return
	}
	const interval = 5 * time.Second
	now := time.Now()
	m.errorMu.Lock()
	last := m.lastError[key]
	if !last.IsZero() && now.Sub(last) < interval {
		m.suppressedErr[key]++
		m.errorMu.Unlock()
		return
	}
	suppressed := m.suppressedErr[key]
	m.lastError[key] = now
	m.suppressedErr[key] = 0
	m.errorMu.Unlock()
	if suppressed > 0 {
		err = fmt.Errorf("%w (%d similar errors suppressed)", err, suppressed)
	}
	m.onError(err)
}

func (m *Manager) report(err error) {
	if err != nil && m.onError != nil {
		m.onError(err)
	}
}
