import qs from 'qs';

// --- Types ---
export interface ClientStats {
  email: string;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
  enable?: boolean;
  inboundId?: number;
  reset?: number;
}

export interface Inbound {
  id: number;
  up: number;
  down: number;
  total: number;
  remark: string;
  enable: boolean;
  expiryTime: number;
  trafficReset: string;
  lastTrafficResetTime: number;
  listen: string;
  port: number;
  protocol: string;
  settings: string; // JSON string
  streamSettings: string; // JSON string
  tag: string;
  sniffing: string; // JSON string
  clientStats: ClientStats[];
  nodeId: number | null;
  shareAddrStrategy: string;
  shareAddr: string;
  subSortIndex: number;
  originNodeGuid: string;
}

export interface Host {
  id: number;
  remark: string;
  domain: string;
  port: number;
  enable: boolean;
}

export interface ResellerAdmin {
  id: string;
  username: string;
  password?: string;
  volumeGB: number;
  days: number;
  webPath: string;
  inbounds: number[];
  enable: boolean;
  expiryTime: number;
  clientCount?: number;
  clientLimit?: number;
  createdAt?: number;
  totalTrafficUsed?: number;
}

export interface AllSettings {
  [key: string]: string;
}

export interface Node {
  id: number;
  remark: string;
  address: string;
  port: number;
  enable: boolean;
  status: string;
}

export interface InboundClient {
  id: string;
  uuid?: string;
  email: string;
  password?: string;
  limitIP?: number;
  limitIp?: number;
  totalGB?: number;
  expiryTime?: number;
  enable?: boolean;
  tgId?: string;
  subId?: string;
  createdBy?: string;
  inboundIds?: number[];
  flow?: string;
  security?: string;
  group?: string;
  comment?: string;
  traffic?: { up: number; down: number; total: number; expiryTime: number; enable: boolean; lastOnline: number };
}

// --- Seed Initial Data ---
const DEFAULT_INBOUNDS: Inbound[] = [
  {
    id: 1,
    up: 524288000,
    down: 1572864000,
    total: 10737418240,
    remark: 'VLESS XTLS Reality Direct',
    enable: true,
    expiryTime: 0,
    trafficReset: '',
    lastTrafficResetTime: 0,
    listen: '0.0.0.0',
    port: 443,
    protocol: 'vless',
    settings: JSON.stringify({
      clients: [
        {
          id: 'b8f1d7a2-f9e4-4a2c-9a1d-72e73fbf4628',
          email: 'admin@daltoon.com',
          limitIP: 2,
          totalGB: 0,
          expiryTime: 0,
          enable: true
        }
      ],
      decryption: 'none',
      fallbacks: []
    }),
    streamSettings: JSON.stringify({
      network: 'tcp',
      security: 'reality',
      realitySettings: {
        show: false,
        xver: 0,
        dest: 'yahoo.com:443',
        serverNames: ['yahoo.com'],
        privateKey: 'mock_private_key',
        shortIds: ['0123456789abcdef']
      }
    }),
    tag: 'vless_reality',
    sniffing: JSON.stringify({
      enabled: true,
      destOverride: ['http', 'tls', 'quic']
    }),
    clientStats: [
      {
        email: 'admin@daltoon.com',
        up: 524288000,
        down: 1572864000,
        total: 10737418240,
        expiryTime: 0,
        enable: true
      }
    ],
    nodeId: null,
    shareAddrStrategy: 'web_domain',
    shareAddr: '',
    subSortIndex: 0,
    originNodeGuid: ''
  },
  {
    id: 2,
    up: 125829120,
    down: 891289600,
    total: 0,
    remark: 'VMess WS CDN',
    enable: true,
    expiryTime: 1793740800000,
    trafficReset: '',
    lastTrafficResetTime: 0,
    listen: '0.0.0.0',
    port: 8080,
    protocol: 'vmess',
    settings: JSON.stringify({
      clients: [
        {
          id: 'c9e1d8b3-0ab5-5c1d-8b2e-83f84fcg5739',
          email: 'user1@daltoon.com',
          limitIP: 0,
          totalGB: 107374182400,
          expiryTime: 1793740800000,
          enable: true
        }
      ]
    }),
    streamSettings: JSON.stringify({
      network: 'ws',
      security: 'none',
      wsSettings: {
        path: '/vmess'
      }
    }),
    tag: 'vmess_ws',
    sniffing: JSON.stringify({
      enabled: true,
      destOverride: ['http', 'tls']
    }),
    clientStats: [
      {
        email: 'user1@daltoon.com',
        up: 125829120,
        down: 891289600,
        total: 107374182400,
        expiryTime: 1793740800000,
        enable: true
      }
    ],
    nodeId: null,
    shareAddrStrategy: 'web_domain',
    shareAddr: '',
    subSortIndex: 1,
    originNodeGuid: ''
  }
];

const DEFAULT_SETTINGS: Record<string, string | number | boolean> = {
  webListen: '0.0.0.0',
  webDomain: 'daltoon.example.com',
  webPort: "3000",
  webCertFile: '',
  webKeyFile: '',
  webBasePath: '/',
  sessionMaxAge: "1440",
  trustedProxyCIDRs: '',
  panelOutbound: 'direct',
  pageSize: "25",
  expireDiff: "3",
  trafficDiff: "10",
  remarkTemplate: 'Daltoon-UI-{{remark}}',
  datepicker: 'gregorian',
  tgBotEnable: false,
  tgBotToken: '',
  tgBotProxy: '',
  tgBotAPIServer: '',
  tgBotChatId: '',
  tgRunTime: '',
  tgBotBackup: false,
  tgCpu: 0,
  tgLang: 'en',
  twoFactorEnable: false,
  twoFactorToken: '',
  xrayTemplateConfig: '{}',
  subEnable: true,
  subJsonEnable: true,
  subTitle: 'Daltoon-UI Subscription',
  subSupportUrl: 'https://t.me/daltoon_support',
  subProfileUrl: '',
  subAnnounce: 'Welcome to Daltoon-UI Panel!',
  subEnableRouting: false,
  subRoutingRules: '',
  subListen: '0.0.0.0',
  subPort: 2096,
  subPath: '/sub/',
  subJsonPath: '/json/',
  subClashEnable: true,
  subClashPath: '/clash/',
  subDomain: 'sub.daltoon.example.com',
  subEncrypt: true,
  subURI: 'https://sub.daltoon.example.com/sub/',
  subJsonURI: 'https://sub.daltoon.example.com/json/',
  subClashURI: 'https://sub.daltoon.example.com/clash/'
};

const DEFAULT_HOSTS: Host[] = [
  { id: 1, remark: 'Daltoon Global CDN', domain: 'cdn.daltoon.com', port: 443, enable: true }
];

const DEFAULT_NODES: Node[] = [
  { id: 1, remark: 'Daltoon Germany Primary', address: 'de.daltoon.com', port: 2053, enable: true, status: 'online' }
];

// --- Database Engine ---
class MockDatabase {
  getInbounds(): Inbound[] {
    const raw = localStorage.getItem('daltoon_ui_inbounds');
    let inbounds: Inbound[];
    if (!raw) {
      inbounds = DEFAULT_INBOUNDS;
      this.saveInbounds(inbounds);
    } else {
      try {
        inbounds = JSON.parse(raw);
      } catch {
        inbounds = DEFAULT_INBOUNDS;
      }
    }

    // --- Dynamic Self-Repair Migration for missing/undefined createdBy field ---
    let modified = false;
    const adminsRaw = localStorage.getItem('daltoon_ui_admins');
    if (adminsRaw) {
      try {
        const admins: ResellerAdmin[] = JSON.parse(adminsRaw);
        inbounds.forEach((ib) => {
          try {
            const settings = JSON.parse(ib.settings);
            const clients = settings.clients || [];
            let clientsModified = false;
            clients.forEach((c: InboundClient) => {
              if (!c.createdBy) {
                // Find reseller admin who has access to this inbound ID
                const creatorAdmin = admins.find((a) => a.inbounds && a.inbounds.includes(ib.id));
                if (creatorAdmin) {
                  c.createdBy = creatorAdmin.username;
                  clientsModified = true;
                  modified = true;
                }
              }
            });
            if (clientsModified) {
              settings.clients = clients;
              ib.settings = JSON.stringify(settings);
            }
          } catch {}
        });
      } catch {}
    }

    if (modified) {
      localStorage.setItem('daltoon_ui_inbounds', JSON.stringify(inbounds));
    }
    // ----------------------------------------------------------------------------

    return inbounds;
  }

  saveInbounds(inbounds: Inbound[]) {
    localStorage.setItem('daltoon_ui_inbounds', JSON.stringify(inbounds));
  }

  getSettings() {
    const raw = localStorage.getItem('daltoon_ui_settings');
    if (!raw) {
      this.saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: AllSettings) {
    localStorage.setItem('daltoon_ui_settings', JSON.stringify(settings));
  }

  getHosts(): Host[] {
    const raw = localStorage.getItem('daltoon_ui_hosts');
    if (!raw) {
      this.saveHosts(DEFAULT_HOSTS);
      return DEFAULT_HOSTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_HOSTS;
    }
  }

  saveHosts(hosts: Host[]) {
    localStorage.setItem('daltoon_ui_hosts', JSON.stringify(hosts));
  }

  getNodes(): Node[] {
    const raw = localStorage.getItem('daltoon_ui_nodes');
    if (!raw) {
      this.saveNodes(DEFAULT_NODES);
      return DEFAULT_NODES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_NODES;
    }
  }

  saveNodes(nodes: Node[]) {
    localStorage.setItem('daltoon_ui_nodes', JSON.stringify(nodes));
  }

  getAdmins(): ResellerAdmin[] {
    const raw = localStorage.getItem('daltoon_ui_admins');
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  saveAdmins(admins: ResellerAdmin[]) {
    localStorage.setItem('daltoon_ui_admins', JSON.stringify(admins));
  }
}

const db = new MockDatabase();

// --- Network / Dynamic Simulation Helper ---
let simulatedTrafficLastTime = Date.now();
const trafficDeltas: Record<string, { up: number; down: number }> = {};

function simulateTraffic() {
  const now = Date.now();
  const secondsElapsed = (now - simulatedTrafficLastTime) / 1000;
  if (secondsElapsed < 1) return;
  simulatedTrafficLastTime = now;

  const inbounds = db.getInbounds();
  let updated = false;

  inbounds.forEach((ib) => {
    if (!ib.enable) return;
    // Simulate bandwidth delta per inbound (100KB to 2MB per check)
    const inboundUpDelta = Math.floor(Math.random() * 500000 * secondsElapsed);
    const inboundDownDelta = Math.floor(Math.random() * 1500000 * secondsElapsed);

    ib.up += inboundUpDelta;
    ib.down += inboundDownDelta;
    updated = true;

    // Distribute to clients
    try {
      const settingsObj = JSON.parse(ib.settings);
      const clients = settingsObj.clients || [];
      if (clients.length > 0) {
        // Distribute the delta among active clients
        const shareUp = Math.floor(inboundUpDelta / clients.length);
        const shareDown = Math.floor(inboundDownDelta / clients.length);

        if (!ib.clientStats) ib.clientStats = [];
        clients.forEach((c: { email: string; enable?: boolean; totalGB?: number; expiryTime?: number }) => {
          if (!c.enable) return;
          let stat = ib.clientStats.find((s) => s.email === c.email);
          if (!stat) {
            stat = { email: c.email, up: 0, down: 0, total: c.totalGB || 0, expiryTime: c.expiryTime || 0, enable: true };
            ib.clientStats.push(stat);
          }
          stat.up += shareUp;
          stat.down += shareDown;
        });
      }
    } catch (e) {
      console.warn('Error simulating traffic for clients', e);
    }

    trafficDeltas[ib.tag || `ib-${ib.id}`] = {
      up: inboundUpDelta,
      down: inboundDownDelta
    };
  });

  if (updated) {
    db.saveInbounds(inbounds);
  }
}

// --- Mock Interceptor Request Router ---
export function handleMockRequest(url: string, _method: string, requestData: unknown): { success: boolean; msg?: string; obj?: unknown } | null {
  if (!import.meta.env.DEV) {
    return null;
  }
  // Extract clean route path
  let path = url.split('?')[0];
  if (path.startsWith(window.location.origin)) {
    path = path.slice(window.location.origin.length);
  }
  const basePath = window.X_UI_BASE_PATH || '';
  if (basePath && path.startsWith(basePath)) {
    path = path.slice(basePath.length - (basePath.endsWith('/') ? 1 : 0));
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  const queryStr = url.includes('?') ? url.split('?')[1] : '';
  const query = qs.parse(queryStr);

  // // const upperMethod = method.toUpperCase();

  // Route matches
  // 1. CRSF Token
  if (path === '/csrf-token') {
    return { success: true, obj: 'mock-csrf-token' };
  }

  // 2. Two Factor Enable Check
  if (path === '/getTwoFactorEnable') {
    return { success: true, obj: false };
  }

  // 3. Login
  if (path === '/login') {
    return { success: true, obj: null };
  }

  // 4. Logout
  if (path === '/logout') {
    return { success: true, obj: null };
  }

  // 5. Server Status
  if (path === '/panel/api/server/status') {
    simulateTraffic();
    // Dynamically oscillate CPU and Memory to simulate live system telemetry
    const cpuOsc = 5 + Math.random() * 15; // 5% - 20%
    const memOsc = 4500000000 + Math.floor(Math.random() * 500000000); // ~4.5GB - 5GB

    // Sum inbounds traffic
    const inbounds = db.getInbounds();
    let sent = 0;
    let recv = 0;
    inbounds.forEach((ib) => {
      sent += ib.up;
      recv += ib.down;
    });

    return {
      success: true,
      obj: {
        cpu: cpuOsc,
        cpuCores: 4,
        logicalPro: 8,
        cpuSpeedMhz: 3200,
        disk: {
          current: 45000000000,
          total: 100000000000
        },
        loads: [cpuOsc / 20, 0.4, 0.3],
        mem: {
          current: memOsc,
          total: 16000000000
        },
        netIO: {
          up: Math.floor(Math.random() * 500000),
          down: Math.floor(Math.random() * 1500000)
        },
        netTraffic: {
          sent,
          recv
        },
        publicIP: {
          ipv4: '185.120.35.48',
          ipv6: '2a01:4f8:c2c:201d::1'
        },
        swap: {
          current: 120000000,
          total: 4000000000
        },
        tcpCount: 180 + Math.floor(Math.random() * 50),
        udpCount: 35 + Math.floor(Math.random() * 15),
        uptime: 1250000,
        appUptime: 250000,
        appStats: {
          threads: 24,
          mem: 320000000,
          uptime: 250000
        },
        xray: {
          state: 'running',
          errorMsg: '',
          version: 'Xray 1.8.24',
          color: 'green'
        }
      }
    };
  }

  // 6. Fail2ban Status
  if (path === '/panel/api/server/fail2banStatus') {
    return {
      success: true,
      obj: {
        enable: true,
        status: 'active',
        rules: []
      }
    };
  }

  // 7. Slim Inbounds List
  if (path === '/panel/api/inbounds/list/slim') {
    simulateTraffic();
    const inbounds = db.getInbounds();
    // Map to slim representation required by SlimInboundListSchema
    const slim = inbounds.map((ib) => ({
      id: ib.id,
      userId: 1,
      up: ib.up,
      down: ib.down,
      total: ib.total,
      remark: ib.remark,
      enable: ib.enable,
      expiryTime: ib.expiryTime,
      trafficReset: ib.trafficReset,
      lastTrafficResetTime: ib.lastTrafficResetTime,
      listen: ib.listen,
      port: ib.port,
      protocol: ib.protocol,
      tag: ib.tag,
      nodeId: ib.nodeId,
      originNodeGuid: ib.originNodeGuid,
      settings: ib.settings,
      streamSettings: ib.streamSettings,
      sniffing: ib.sniffing,
      clientStats: ib.clientStats || []
    }));
    return { success: true, obj: slim };
  }

  // 8. Inbound Options
  if (path === '/panel/api/inbounds/options') {
    let inbounds = db.getInbounds();
    const currentAdminRaw = localStorage.getItem('daltoon_current_admin');
    if (currentAdminRaw) {
      try {
        const currentAdmin = JSON.parse(currentAdminRaw);
        const allowedIds = currentAdmin.inbounds || [];
        inbounds = inbounds.filter((ib) => allowedIds.includes(ib.id));
      } catch {}
    }
    const options = inbounds.map((ib) => ({
      id: ib.id,
      remark: ib.remark,
      tag: ib.tag,
      protocol: ib.protocol,
      port: ib.port,
      tlsFlowCapable: ib.protocol === 'vless',
      ssMethod: '',
      wgPublicKey: '',
      wgMtu: 1420,
      wgDns: '1.1.1.1',
      nodeId: ib.nodeId
    }));
    return { success: true, obj: options };
  }

  // 9. Detailed Inbound GET
  if (path.startsWith('/panel/api/inbounds/get/')) {
    const id = parseInt(path.split('/').pop() || '0');
    const inbounds = db.getInbounds();
    const inbound = inbounds.find((ib) => ib.id === id);
    if (!inbound) return { success: false, msg: 'Inbound not found' };
    return { success: true, obj: inbound };
  }

  // 10. Inbound ADD
  if (path === '/panel/api/inbounds/add') {
    const inbounds = db.getInbounds();
    const newId = inbounds.reduce((max, ib) => ib.id > max ? ib.id : max, 0) + 1;
    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;

    const newInbound: Inbound = {
      id: newId,
      up: 0,
      down: 0,
      total: body.total || 0,
      remark: body.remark || `Port ${body.port}`,
      enable: body.enable !== false,
      expiryTime: body.expiryTime || 0,
      trafficReset: body.trafficReset || '',
      lastTrafficResetTime: 0,
      listen: body.listen || '0.0.0.0',
      port: body.port,
      protocol: body.protocol,
      settings: typeof body.settings === 'object' ? JSON.stringify(body.settings) : body.settings || '{}',
      streamSettings: typeof body.streamSettings === 'object' ? JSON.stringify(body.streamSettings) : body.streamSettings || '{}',
      tag: body.tag || `inbound-${newId}`,
      sniffing: typeof body.sniffing === 'object' ? JSON.stringify(body.sniffing) : body.sniffing || '{}',
      clientStats: [],
      nodeId: body.nodeId || null,
      shareAddrStrategy: body.shareAddrStrategy || 'web_domain',
      shareAddr: body.shareAddr || '',
      subSortIndex: inbounds.length,
      originNodeGuid: ''
    };

    inbounds.push(newInbound);
    db.saveInbounds(inbounds);
    return { success: true, obj: newInbound };
  }

  // 11. Inbound UPDATE
  if (path.startsWith('/panel/api/inbounds/update/')) {
    const id = parseInt(path.split('/').pop() || '0');
    const inbounds = db.getInbounds();
    const inboundIndex = inbounds.findIndex((ib) => ib.id === id);
    if (inboundIndex === -1) return { success: false, msg: 'Inbound not found' };

    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    const existing = inbounds[inboundIndex];

    inbounds[inboundIndex] = {
      ...existing,
      remark: body.remark ?? existing.remark,
      enable: body.enable ?? existing.enable,
      port: body.port ?? existing.port,
      listen: body.listen ?? existing.listen,
      total: body.total ?? existing.total,
      expiryTime: body.expiryTime ?? existing.expiryTime,
      settings: typeof body.settings === 'object' ? JSON.stringify(body.settings) : body.settings ?? existing.settings,
      streamSettings: typeof body.streamSettings === 'object' ? JSON.stringify(body.streamSettings) : body.streamSettings ?? existing.streamSettings,
      sniffing: typeof body.sniffing === 'object' ? JSON.stringify(body.sniffing) : body.sniffing ?? existing.sniffing,
      tag: body.tag ?? existing.tag,
      shareAddrStrategy: body.shareAddrStrategy ?? existing.shareAddrStrategy,
      shareAddr: body.shareAddr ?? existing.shareAddr
    };

    db.saveInbounds(inbounds);
    return { success: true, obj: inbounds[inboundIndex] };
  }

  // 12. Inbound DELETE
  if (path.startsWith('/panel/api/inbounds/del/')) {
    const id = parseInt(path.split('/').pop() || '0');
    let inbounds = db.getInbounds();
    inbounds = inbounds.filter((ib) => ib.id !== id);
    db.saveInbounds(inbounds);
    return { success: true, obj: null };
  }

  // 13. Inbound toggle Enable
  if (path.startsWith('/panel/api/inbounds/setEnable/')) {
    const id = parseInt(path.split('/').pop() || '0');
    const inbounds = db.getInbounds();
    const inbound = inbounds.find((ib) => ib.id === id);
    if (!inbound) return { success: false, msg: 'Inbound not found' };

    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    inbound.enable = body.enable !== false;

    db.saveInbounds(inbounds);
    return { success: true, obj: inbound };
  }

  // 14. Inbound Reset Traffic
  if (path.match(/\/panel\/api\/inbounds\/\d+\/resetTraffic/)) {
    const matches = path.match(/\d+/);
    const id = parseInt(matches ? matches[0] : '0');
    const inbounds = db.getInbounds();
    const inbound = inbounds.find((ib) => ib.id === id);
    if (inbound) {
      inbound.up = 0;
      inbound.down = 0;
      if (inbound.clientStats) {
        inbound.clientStats.forEach((st) => {
          st.up = 0;
          st.down = 0;
        });
      }
      db.saveInbounds(inbounds);
    }
    return { success: true, obj: null };
  }

  // 15. Inbound Reset All Traffics
  if (path === '/panel/api/inbounds/resetAllTraffics') {
    const inbounds = db.getInbounds();
    inbounds.forEach((ib) => {
      ib.up = 0;
      ib.down = 0;
      if (ib.clientStats) {
        ib.clientStats.forEach((st) => {
          st.up = 0;
          st.down = 0;
        });
      }
    });
    db.saveInbounds(inbounds);
    return { success: true, obj: null };
  }

  // 16. Inbound Delete All Clients
  if (path.match(/\/panel\/api\/inbounds\/\d+\/delAllClients/)) {
    const matches = path.match(/\d+/);
    const id = parseInt(matches ? matches[0] : '0');
    const inbounds = db.getInbounds();
    const inbound = inbounds.find((ib) => ib.id === id);
    if (inbound) {
      try {
        const settingsObj = JSON.parse(inbound.settings);
        settingsObj.clients = [];
        inbound.settings = JSON.stringify(settingsObj);
        inbound.clientStats = [];
        db.saveInbounds(inbounds);
      } catch (e) {
        console.error(e);
      }
    }
    return { success: true, obj: null };
  }

  // 17. Settings default
  if (path === '/panel/api/setting/defaultSettings') {
    return { success: true, obj: db.getSettings() };
  }

  // 18. All Settings GET
  if (path === '/panel/api/setting/all') {
    return { success: true, obj: db.getSettings() };
  }

  // 19. Update Settings POST
  if (path === '/panel/api/setting/update') {
    const current = db.getSettings();
    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    const next = { ...current, ...body };
    db.saveSettings(next);
    return { success: true, obj: null };
  }

  // 20. Hosts API
  if (path === '/panel/api/hosts/list') {
    return { success: true, obj: db.getHosts() };
  }
  if (path === '/panel/api/hosts/add') {
    const hosts = db.getHosts();
    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    const newId = hosts.reduce((max, h) => h.id > max ? h.id : max, 0) + 1;
    const newHost = { ...body, id: newId, enable: body.enable !== false };
    hosts.push(newHost);
    db.saveHosts(hosts);
    return { success: true, obj: newHost };
  }
  if (path.startsWith('/panel/api/hosts/update/')) {
    const id = parseInt(path.split('/').pop() || '0');
    const hosts = db.getHosts();
    const host = hosts.find((h) => h.id === id);
    if (host) {
      const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
      Object.assign(host, body);
      db.saveHosts(hosts);
    }
    return { success: true, obj: host };
  }
  if (path.startsWith('/panel/api/hosts/del/')) {
    const id = parseInt(path.split('/').pop() || '0');
    let hosts = db.getHosts();
    hosts = hosts.filter((h) => h.id !== id);
    db.saveHosts(hosts);
    return { success: true, obj: null };
  }
  if (path.startsWith('/panel/api/hosts/setEnable/')) {
    const id = parseInt(path.split('/').pop() || '0');
    const hosts = db.getHosts();
    const host = hosts.find((h) => h.id === id);
    if (host) {
      const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
      host.enable = body.enable !== false;
      db.saveHosts(hosts);
    }
    return { success: true, obj: host };
  }

  // 21. Nodes API
  if (path === '/panel/api/nodes/list') {
    return { success: true, obj: db.getNodes() };
  }
  if (path === '/panel/api/nodes/add') {
    const nodes = db.getNodes();
    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    const newId = nodes.reduce((max, n) => n.id > max ? n.id : max, 0) + 1;
    const newNode = { ...body, id: newId, enable: body.enable !== false, status: 'online' };
    nodes.push(newNode);
    db.saveNodes(nodes);
    return { success: true, obj: newNode };
  }
  if (path.startsWith('/panel/api/nodes/update/')) {
    const id = parseInt(path.split('/').pop() || '0');
    const nodes = db.getNodes();
    const node = nodes.find((n) => n.id === id);
    if (node) {
      const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
      Object.assign(node, body);
      db.saveNodes(nodes);
    }
    return { success: true, obj: node };
  }
  if (path.startsWith('/panel/api/nodes/del/')) {
    const id = parseInt(path.split('/').pop() || '0');
    let nodes = db.getNodes();
    nodes = nodes.filter((n) => n.id !== id);
    db.saveNodes(nodes);
    return { success: true, obj: null };
  }
  if (path.startsWith('/panel/api/nodes/setEnable/')) {
    const id = parseInt(path.split('/').pop() || '0');
    const nodes = db.getNodes();
    const node = nodes.find((n) => n.id === id);
    if (node) {
      const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
      node.enable = body.enable !== false;
      db.saveNodes(nodes);
    }
    return { success: true, obj: node };
  }
  if (path.startsWith('/panel/api/nodes/probe/')) {
    return { success: true, obj: 'success' };
  }
  if (path === '/panel/api/nodes/test') {
    return { success: true, obj: 'Latency: 42ms' };
  }

  // 22. Clients API Group
  if (path === '/panel/api/clients/onlines') {
    const inbounds = db.getInbounds();
    const emails: string[] = [];
    inbounds.forEach((ib) => {
      try {
        const settings = JSON.parse(ib.settings);
        const clients = settings.clients || [];
        
        clients.forEach((c: { email: string; enable?: boolean; totalGB?: number; expiryTime?: number }) => {
          if (ib.enable && c.enable) emails.push(c.email);
        });
      } catch {}
    });
    return { success: true, obj: emails };
  }

  if (path === '/panel/api/clients/onlinesByGuid') {
    const inbounds = db.getInbounds();
    const emails: string[] = [];
    inbounds.forEach((ib) => {
      try {
        const settings = JSON.parse(ib.settings);
        const clients = settings.clients || [];
        
        clients.forEach((c: { email: string; enable?: boolean; totalGB?: number; expiryTime?: number }) => {
          if (ib.enable && c.enable) emails.push(c.email);
        });
      } catch {}
    });
    return { success: true, obj: { '': emails } };
  }

  if (path === '/panel/api/clients/activeInbounds') {
    const inbounds = db.getInbounds();
    const tags = inbounds.filter((ib) => ib.enable).map((ib) => ib.tag);
    return { success: true, obj: { '': tags } };
  }

  if (path === '/panel/api/clients/lastOnline') {
    const inbounds = db.getInbounds();
    const res: Record<string, number> = {};
    const now = Date.now();
    inbounds.forEach((ib) => {
      try {
        const settings = JSON.parse(ib.settings);
        const clients = settings.clients || [];
        clients.forEach((c: { email: string; enable?: boolean; totalGB?: number; expiryTime?: number }) => {
          if (ib.enable && c.enable) {
            res[c.email] = now - 5000;
          }
        });
      } catch {}
    });
    return { success: true, obj: res };
  }

  // 23. Paginated Clients View
  if (path === '/panel/api/clients/list/paged') {
    simulateTraffic();
    const inbounds = db.getInbounds();
    const clientsMap = new Map<string, InboundClient>();

    inbounds.forEach((ib) => {
      try {
        const settings = JSON.parse(ib.settings);
        const clients = settings.clients || [];
        clients.forEach((c: { email: string; enable?: boolean; totalGB?: number; expiryTime?: number }) => {
          const email = c.email;
          if (!email) return;

          let stat = (ib.clientStats || []).find((st) => st.email === email);
          if (!stat) {
            stat = { email, up: 0, down: 0, total: c.totalGB || 0, expiryTime: c.expiryTime || 0, enable: c.enable };
          }

          if (clientsMap.has(email)) {
            const existing = clientsMap.get(email);
            if (existing) {
              if (!existing.inboundIds) existing.inboundIds = [];
              if (!existing.traffic) existing.traffic = { up: 0, down: 0, total: 0, expiryTime: 0, enable: true, lastOnline: 0 };
              existing.inboundIds.push(ib.id);
              existing.traffic.up += stat.up;
              existing.traffic.down += stat.down;
            }
          } else {
            clientsMap.set(email, {
              id: c.id || c.email,
              email: c.email,
              subId: c.subId || c.email,
              uuid: c.id || c.uuid || '',
              password: c.password,
              flow: c.flow || '',
              security: c.security || '',
              totalGB: c.totalGB || 0,
              expiryTime: c.expiryTime || 0,
              limitIp: c.limitIp || 0,
              tgId: c.tgId || '',
              group: c.group || '',
              comment: c.comment || '',
              enable: c.enable !== false,
              inboundIds: [ib.id],
              createdBy: c.createdBy,
              traffic: {
                up: stat.up,
                down: stat.down,
                total: c.totalGB || 0,
                expiryTime: c.expiryTime || 0,
                enable: c.enable !== false,
                lastOnline: Date.now() - 5000
              }
            });
          }
        });
      } catch {}
    });

    let allClients = Array.isArray(requestData) ? requestData : Array.from(clientsMap.values());

    // Filter by reseller admin if logged in
    const currentAdminRaw = localStorage.getItem('daltoon_current_admin');
    if (currentAdminRaw) {
      try {
        const currentAdmin = JSON.parse(currentAdminRaw);
        allClients = allClients.filter(c => c.createdBy === currentAdmin.username);
      } catch {}
    } else if (query.createdBy) {
      const createdBy = query.createdBy as string;
      allClients = allClients.filter(c => c.createdBy === createdBy);
    } else {
      // DEFAULT behavior for Master Admin on main clients list:
      // Show only clients created by Master Admin (createdBy is empty/undefined)
      allClients = allClients.filter(c => !c.createdBy);
    }

    // Filter, Search
    const search = (query.search as string || '').toLowerCase();
    if (search) {
      allClients = allClients.filter(
        (c) =>
          c.email.toLowerCase().includes(search) ||
          (c.comment && c.comment.toLowerCase().includes(search))
      );
    }

    const inboundFilter = query.inbound as string;
    if (inboundFilter) {
      const ids = inboundFilter.split(',').map((x) => parseInt(x));
      allClients = allClients.filter((c) => c.inboundIds.some((id: number) => ids.includes(id)));
    }

    const total = allClients.length;
    const pageNum = parseInt(query.page as string || '1');
    const pageSizeNum = parseInt(query.pageSize as string || '25');

    const startIndex = (pageNum - 1) * pageSizeNum;
    const paginatedItems = allClients.slice(startIndex, startIndex + pageSizeNum);

    // Clients Summary
    const now = Date.now();
    const online: string[] = [];
    const depleted: string[] = [];
    const expiring: string[] = [];
    const deactive: string[] = [];
    let active = 0;

    allClients.forEach((c) => {
      const used = c.traffic.up + c.traffic.down;
      const tLimit = c.totalGB || 0;
      const expired = c.expiryTime > 0 && c.expiryTime <= now;
      const exhausted = tLimit > 0 && used >= tLimit;

      if (c.enable) online.push(c.email);
      if (expired || exhausted) depleted.push(c.email);
      else if (!c.enable) deactive.push(c.email);
      else {
        const nearExpiry = c.expiryTime > 0 && c.expiryTime - now < 3 * 86400000;
        const nearLimit = tLimit > 0 && tLimit - used < 10 * 1024 * 1024 * 1024;
        if (nearExpiry || nearLimit) expiring.push(c.email);
        else active++;
      }
    });

    return {
      success: true,
      obj: {
        items: paginatedItems,
        total,
        filtered: total,
        page: pageNum,
        pageSize: pageSizeNum,
        summary: {
          total,
          active,
          online,
          depleted,
          expiring,
          deactive
        }
      }
    };
  }

  // 24. Client Single GET
  if (path.startsWith('/panel/api/clients/get/')) {
    const email = decodeURIComponent(path.split('/').pop() || '');
    const inbounds = db.getInbounds();
    let foundClient: InboundClient | null = null;
    const inboundIds: number[] = [];

    inbounds.forEach((ib) => {
      try {
        const settings = JSON.parse(ib.settings);
        const clients = settings.clients || [];
        const c = clients.find((x: InboundClient) => x.email === email);
        if (c) {
          inboundIds.push(ib.id);
          if (!foundClient) {
            foundClient = {
              id: c.id || c.email,
              email: c.email,
              subId: c.subId || c.email,
              uuid: c.id || c.uuid,
              password: c.password,
              flow: c.flow || '',
              security: c.security || '',
              totalGB: c.totalGB || 0,
              expiryTime: c.expiryTime || 0,
              limitIp: c.limitIp || 0,
              tgId: c.tgId || '',
              group: c.group || '',
              comment: c.comment || '',
              enable: c.enable !== false,
              inboundIds,
              traffic: {
                up: 0,
                down: 0,
                total: c.totalGB || 0,
                expiryTime: c.expiryTime || 0,
                enable: c.enable !== false,
                lastOnline: Date.now() - 5000
              }
            };
          }
        }
      } catch {}
    });

    if (!foundClient) return { success: false, msg: 'Client not found' };

    return {
      success: true,
      obj: {
        client: foundClient,
        inboundIds,
        externalLinks: []
      }
    };
  }

  // 25. Add Client
  if (path === '/panel/api/clients/add') {
    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    const inbounds = db.getInbounds();
    const inboundIds = body.inboundIds || [];

    const currentAdminRaw = localStorage.getItem('daltoon_current_admin');
    const currentAdmin = currentAdminRaw ? JSON.parse(currentAdminRaw) : null;

    inbounds.forEach((ib) => {
      if (inboundIds.includes(ib.id)) {
        try {
          const settings = JSON.parse(ib.settings);
          if (!settings.clients) settings.clients = [];
          
          const newClient = {
            id: body.client?.id || body.client?.uuid || 'uuid-12345678-abcd-1234-abcd-12345678abcd',
            email: body.client?.email,
            limitIP: body.client?.limitIp || 0,
            totalGB: body.client?.totalGB || 0,
            expiryTime: body.client?.expiryTime || 0,
            enable: body.client?.enable !== false,
            flow: body.client?.flow || '',
            password: body.client?.password || body.client?.uuid || '',
            createdBy: body.client?.createdBy || (currentAdmin ? currentAdmin.username : undefined)
          };

          settings.clients.push(newClient);
          ib.settings = JSON.stringify(settings);

          if (!ib.clientStats) ib.clientStats = [];
          ib.clientStats.push({
            email: body.client?.email,
            up: 0,
            down: 0,
            total: body.client?.totalGB || 0,
            expiryTime: body.client?.expiryTime || 0,
            enable: body.client?.enable !== false
          });
        } catch {}
      }
    });

    db.saveInbounds(inbounds);
    return { success: true, obj: null };
  }

  // 26. Update Client
  if (path.startsWith('/panel/api/clients/update/')) {
    const email = decodeURIComponent(path.split('/').pop() || '');
    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    const inbounds = db.getInbounds();

    inbounds.forEach((ib) => {
      try {
        const settings = JSON.parse(ib.settings);
        const clients = settings.clients || [];
        const idx = clients.findIndex((x: InboundClient) => x.email === email);
        if (idx !== -1) {
          const c = clients[idx];
          clients[idx] = {
            ...c,
            limitIP: body.limitIp ?? c.limitIP,
            totalGB: body.totalGB ?? c.totalGB,
            expiryTime: body.expiryTime ?? c.expiryTime,
            enable: body.enable ?? c.enable,
            flow: body.flow ?? c.flow,
            password: body.password ?? c.password,
            id: body.uuid ?? body.id ?? c.id
          };
          settings.clients = clients;
          ib.settings = JSON.stringify(settings);

          const stat = ib.clientStats?.find((st) => st.email === email);
          if (stat) {
            stat.total = body.totalGB ?? stat.total;
            stat.expiryTime = body.expiryTime ?? stat.expiryTime;
            stat.enable = body.enable ?? stat.enable;
          }
        }
      } catch {}
    });

    db.saveInbounds(inbounds);
    return { success: true, obj: null };
  }

  // 27. Client Reset Traffic
  if (path.startsWith('/panel/api/clients/resetTraffic/')) {
    const email = decodeURIComponent(path.split('/').pop() || '');
    const inbounds = db.getInbounds();

    inbounds.forEach((ib) => {
      const stat = ib.clientStats?.find((st) => st.email === email);
      if (stat) {
        stat.up = 0;
        stat.down = 0;
      }
    });

    db.saveInbounds(inbounds);
    return { success: true, obj: null };
  }

  // 28. Client Reset All Traffic
  if (path === '/panel/api/clients/resetAllTraffics') {
    const inbounds = db.getInbounds();
    inbounds.forEach((ib) => {
      ib.clientStats?.forEach((st) => {
        st.up = 0;
        st.down = 0;
      });
    });
    db.saveInbounds(inbounds);
    return { success: true, obj: null };
  }

  // 29. Single Client Delete
  if (path.startsWith('/panel/api/clients/del/')) {
    const email = decodeURIComponent(path.split('?')[0].split('/').pop() || '');
    const inbounds = db.getInbounds();
    const admins = db.getAdmins();

    // Map to find the creator and traffic of the client before deleting
    let clientTraffic = 0;
    let createdByAdmin: string | null = null;

    inbounds.forEach((ib) => {
      try {
        const settings = JSON.parse(ib.settings);
        const clients = settings.clients || [];
        const c = clients.find((x: InboundClient) => x.email === email);
        if (c) {
          createdByAdmin = c.createdBy || null;
          const stat = ib.clientStats?.find((st) => st.email === email);
          if (stat) {
            clientTraffic += (stat.up + stat.down);
          }
        }
      } catch {}
    });

    // Save client's consumed traffic in admin's persistent traffic field
    if (createdByAdmin && clientTraffic > 0) {
      const idx = admins.findIndex(a => a.username === createdByAdmin);
      if (idx !== -1) {
        admins[idx].deletedTrafficBytes = (admins[idx].deletedTrafficBytes || 0) + clientTraffic;
        db.saveAdmins(admins);
      }
    }

    // Now delete client from inbounds
    inbounds.forEach((ib) => {
      try {
        const settings = JSON.parse(ib.settings);
        if (settings.clients) {
          settings.clients = settings.clients.filter((c: InboundClient) => c.email !== email);
          ib.settings = JSON.stringify(settings);
        }
        if (ib.clientStats) {
          ib.clientStats = ib.clientStats.filter((st) => st.email !== email);
        }
      } catch {}
    });

    db.saveInbounds(inbounds);
    return { success: true, obj: null };
  }

  // 29.5 Bulk Delete Clients
  if (path === '/panel/api/clients/bulkDel') {
    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    const emails = body.emails || [];
    const inbounds = db.getInbounds();
    const admins = db.getAdmins();

    // Map to accumulate traffic for each creator admin
    const adminTrafficAcc: Record<string, number> = {};

    inbounds.forEach((ib) => {
      try {
        const settings = JSON.parse(ib.settings);
        const clients = settings.clients || [];
        clients.forEach((c: InboundClient) => {
          if (emails.includes(c.email)) {
            const creator = c.createdBy;
            if (creator) {
              const stat = ib.clientStats?.find((st) => st.email === c.email);
              if (stat) {
                const traffic = stat.up + stat.down;
                if (traffic > 0) {
                  adminTrafficAcc[creator] = (adminTrafficAcc[creator] || 0) + traffic;
                }
              }
            }
          }
        });
      } catch {}
    });

    // Save accumulated traffic to admins
    let adminsChanged = false;
    Object.entries(adminTrafficAcc).forEach(([username, traffic]) => {
      const idx = admins.findIndex(a => a.username === username);
      if (idx !== -1) {
        admins[idx].deletedTrafficBytes = (admins[idx].deletedTrafficBytes || 0) + traffic;
        adminsChanged = true;
      }
    });
    if (adminsChanged) {
      db.saveAdmins(admins);
    }

    // Now delete
    inbounds.forEach((ib) => {
      try {
        const settings = JSON.parse(ib.settings);
        if (settings.clients) {
          settings.clients = settings.clients.filter((c: InboundClient) => !emails.includes(c.email));
          ib.settings = JSON.stringify(settings);
        }
        if (ib.clientStats) {
          ib.clientStats = ib.clientStats.filter((st) => !emails.includes(st.email));
        }
      } catch {}
    });

    db.saveInbounds(inbounds);
    return { success: true, obj: { deleted: emails.length } };
  }

  // 30. All links list
  if (path === '/panel/api/inbounds/allLinks') {
    return {
      success: true,
      obj: [
        'vless://b8f1d7a2-f9e4-4a2c-9a1d-72e73fbf4628@daltoon.example.com:443?type=tcp&security=reality&pbk=mock_private_key&fp=chrome&sni=yahoo.com&sid=0123456789abcdef#VLESS-XTLS-Reality-Direct',
        'vmess://eyJ2IjogIjIiLCAicHMiOiAiVk1lc3MtV1MtQ0ROIiwgImFkZCI6ICJkYWx0b29uLmV4YW1wbGUuY29tIiwgInBvcnQiOiA4MDgwLCAiaWQiOiAiYzllMWQ4YjMtMGFiNS01YzFkLThiMmUtODNmODRmY2c1NzM5IiwgImFpZCI6IDAsICJzY3kiOiAiYXV0byIsICJuZXQiOiAid3MiLCAidHlwZSI6ICJub25lIiwgImhvc3QiOiAiZGFsdG9vbi5leGFtcGxlLmNvbSIsICJwYXRoIjogIi92bWVzcyIsICJ0bHMiOiAibm9uZSJ9'
      ]
    };
  }

  // --- Reseller Admins Endpoints ---
  if (path === '/panel/api/admins/list') {
    simulateTraffic();
    const admins = db.getAdmins();
    const inbounds = db.getInbounds();

    // Map each client email to its simulated/actual stats
    const clientsTraffic = new Map<string, { up: number; down: number }>();
    inbounds.forEach((ib) => {
      try {
        const settings = JSON.parse(ib.settings);
        const clients = settings.clients || [];
        clients.forEach((c: InboundClient) => {
          const email = c.email;
          if (!email) return;
          const stat = (ib.clientStats || []).find((st) => st.email === email);
          const up = stat ? stat.up : 0;
          const down = stat ? stat.down : 0;

          if (clientsTraffic.has(email)) {
            const ext = clientsTraffic.get(email)!;
            ext.up += up;
            ext.down += down;
          } else {
            clientsTraffic.set(email, { up, down });
          }
        });
      } catch {}
    });

    // Compute metrics for each reseller admin
    const adminsWithStats = admins.map((admin) => {
      let clientsCount = 0;
      let trafficUsedBytes = admin.deletedTrafficBytes || 0;

      inbounds.forEach((ib) => {
        try {
          const settings = JSON.parse(ib.settings);
          const clients = settings.clients || [];
          clients.forEach((c: InboundClient) => {
            if (c.createdBy === admin.username) {
              clientsCount++;
              const traffic = clientsTraffic.get(c.email);
              if (traffic) {
                trafficUsedBytes += (traffic.up + traffic.down);
              }
            }
          });
        } catch {}
      });

      return {
        ...admin,
        clientsCount,
        trafficUsedBytes
      };
    });

    return { success: true, obj: adminsWithStats };
  }

  if (path === '/panel/api/admins/add') {
    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    const admins = db.getAdmins();
    const newAdmin = {
      id: 'admin_' + Math.random().toString(36).substr(2, 9),
      remark: body.remark || '',
      username: body.username,
      password: body.password,
      volumeGB: body.volumeGB || 0,
      days: body.days || 30,
      webPath: body.webPath,
      inbounds: body.inbounds || [],
      enable: body.enable !== false,
      createdAt: Date.now(),
      expiryTime: body.days ? Date.now() + body.days * 86400000 : 0
    };
    admins.push(newAdmin);
    db.saveAdmins(admins);
    return { success: true, msg: 'Admin created successfully' };
  }

  if (path === '/panel/api/admins/update') {
    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    const admins = db.getAdmins();
    const idx = admins.findIndex((a) => a.id === body.id);
    if (idx !== -1) {
      admins[idx] = {
        ...admins[idx],
        remark: body.remark !== undefined ? body.remark : admins[idx].remark,
        username: body.username,
        password: body.password || admins[idx].password,
        volumeGB: body.volumeGB || 0,
        days: body.days || 30,
        webPath: body.webPath,
        inbounds: body.inbounds || [],
        enable: body.enable !== false,
        expiryTime: body.days ? (admins[idx].createdAt || Date.now()) + body.days * 86400000 : 0
      };
      db.saveAdmins(admins);
      
      // Update logged in admin session if it's the current admin
      const currentAdminRaw = localStorage.getItem('daltoon_current_admin');
      if (currentAdminRaw) {
        try {
          const currentAdmin = JSON.parse(currentAdminRaw);
          if (currentAdmin.id === body.id) {
            localStorage.setItem('daltoon_current_admin', JSON.stringify(admins[idx]));
          }
        } catch {}
      }
      return { success: true, msg: 'Admin updated successfully' };
    }
    return { success: false, msg: 'Admin not found' };
  }

  if (path === '/panel/api/admins/resetTraffic') {
    return { success: true, msg: 'Traffic reset successfully' };
  }

  if (path === '/panel/api/admins/delete') {
    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    let admins = db.getAdmins();
    const adminToDelete = admins.find((a) => a.id === body.id);
    if (adminToDelete) {
      const username = adminToDelete.username;
      // Get all inbounds to clean up clients created by this admin, matching real backend behavior
      const inbounds = db.getInbounds();
      inbounds.forEach((ib) => {
        try {
          const settings = JSON.parse(ib.settings);
          if (settings.clients) {
            // Find emails of clients created by this admin
            const emailsToDelete = settings.clients
              .filter((c: InboundClient) => c.createdBy === username)
              .map((c: InboundClient) => c.email);
            
            settings.clients = settings.clients.filter((c: InboundClient) => c.createdBy !== username);
            ib.settings = JSON.stringify(settings);
            
            if (ib.clientStats && emailsToDelete.length > 0) {
              ib.clientStats = ib.clientStats.filter((st: { email: string }) => !emailsToDelete.includes(st.email));
            }
          }
        } catch {}
      });
      db.saveInbounds(inbounds);
    }
    admins = admins.filter((a) => a.id !== body.id);
    db.saveAdmins(admins);
    return { success: true, msg: 'Admin deleted successfully' };
  }

  if (path === '/panel/api/admins/self') {
    const currentAdminRaw = localStorage.getItem('daltoon_current_admin');
    if (!currentAdminRaw) {
      return { success: false, msg: 'No active session' };
    }
    try {
      const currentSession = JSON.parse(currentAdminRaw);
      const admins = db.getAdmins();
      const currentAdmin = admins.find((a) => a.username === currentSession.username || a.webPath === currentSession.webPath);
      if (currentAdmin) {
        return { success: true, obj: currentAdmin };
      }
    } catch {}
    return { success: false, msg: 'Admin not found' };
  }

  if (path === '/panel/api/admins/selfUpdate') {
    const body = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
    const currentAdminRaw = localStorage.getItem('daltoon_current_admin');
    if (!currentAdminRaw) {
      return { success: false, msg: 'No active session' };
    }
    try {
      const currentSession = JSON.parse(currentAdminRaw);
      const admins = db.getAdmins();
      const idx = admins.findIndex((a) => a.username === currentSession.username || a.webPath === currentSession.webPath);
      if (idx !== -1) {
        const admin = admins[idx];
        
        // Verify old password
        if (body.oldPassword && admin.password !== body.oldPassword) {
          return { success: false, msg: 'Current password is incorrect' };
        }
        
        // Update fields
        if (body.newUsername) {
          const usernameExists = admins.some((a, i) => i !== idx && a.username === body.newUsername);
          if (usernameExists) {
            return { success: false, msg: 'Username is already taken' };
          }
          admin.username = body.newUsername;
        }
        
        if (body.newPassword) {
          admin.password = body.newPassword;
        }
        
        if (body.twoFactorEnable !== undefined) {
          admin.twoFactorEnable = body.twoFactorEnable;
        }
        
        admins[idx] = admin;
        db.saveAdmins(admins);
        
        // Update current admin session
        localStorage.setItem('daltoon_current_admin', JSON.stringify(admin));
        return { success: true, msg: 'Profile updated successfully', obj: admin };
      }
    } catch (e) {
      return { success: false, msg: String(e) };
    }
    return { success: false, msg: 'Admin not found' };
  }

  // Default fallback (unhandled /panel/api path)
  if (path.startsWith('/panel/api/')) {
    console.log('Mock fallback hit for:', path);
    return { success: true, obj: {} };
  }

  return null;
}
