import { ObjectUtil } from '@/utils';

export class AllSetting {
  webListen = '';
  webDomain = '';
  webPort = 2053;
  webCertFile = '';
  webKeyFile = '';
  webBasePath = '/';
  sessionMaxAge = 360;
  trustedProxyCIDRs = '127.0.0.1/32,::1/128';
  panelOutbound = '';
  pageSize = 25;
  expireDiff = 0;
  trafficDiff = 0;
  remarkTemplate = '{{INBOUND}}-{{EMAIL}}|📊{{TRAFFIC_LEFT}}|⏳{{DAYS_LEFT}}D';
  datepicker: 'gregorian' | 'jalalian' = 'gregorian';
  tgBotEnable = false;
  tgBotToken = '';
  tgBotProxy = '';
  tgBotAPIServer = '';
  tgBotChatId = '';
  tgRunTime = '@daily';
  tgBotBackup = false;
  tgCpu = 80;
  tgMemory = 80;
  tgLang = 'en-US';
  twoFactorEnable = false;
  twoFactorToken = '';
  xrayTemplateConfig = '';
  warpUpdateInterval = 0;
  subEnable = true;
  subJsonEnable = false;
  subTitle = '';
  subSupportUrl = '';
  subProfileUrl = '';
  subAnnounce = '';
  subEnableRouting = false;
  subRoutingRules = '';
  subIncyEnableRouting = false;
  subIncyRoutingRules = '';
  subListen = '';
  subPort = 2096;
  subPath = '/sub/';
  subJsonPath = '/json/';
  subClashEnable = false;
  subClashPath = '/clash/';
  subDomain = '';
  externalTrafficInformEnable = false;
  externalTrafficInformURI = '';
  restartXrayOnClientDisable = true;
  ipLimitPolicy: 'block_newest' | 'kick_oldest' = 'block_newest';
  subCertFile = '';
  subKeyFile = '';
  subUpdates = 12;
  subEncrypt = true;
  subURI = '';
  subJsonURI = '';
  subClashURI = '';
  subClashEnableRouting = false;
  subClashRules = '';
  subJsonMux = '';
  subJsonRules = '';
  subJsonFinalMask = '';
  subThemeDir = '';
  subHideSettings = false;
  subDaltoonTemplate = false;
  subShowGauges = false;
  subIranDirect = false;
  subIranRules = 'geosite:category-ir,geoip:ir,domain:.ir';

  // Happ Integration settings
  happHeaderAutoDetect = false;
  happRoutingEnable = false;
  happRoutingPreset = 'iran_bypass';
  happRoutingRules = '';
  happNoLimitMode = false;
  happHideSettings = false;
  happEncryptEnable = false;
  happBannerText = '';
  happBannerColor = 'blue';
  happBannerBtnText = '';
  happBannerBtnLink = '';
  happExpiredBanner = false;
  happRenewalLink = '';
  happExpireNotify = false;
  happTunMode = 'default';
  happTunEngine = 'default';
  happExcludeCidr = '';
  happExcludeApns = false;
  happPingMethod = 'proxy_get';
  happAutoConnect = false;
  happAutoConnectTarget = 'lowest_delay';
  happColorTheme = '';
  happProviderId = '';
  happNewSubUrl = '';
  happFallbackSubUrl = '';
  happEnforceHwid = false;
  happAndroidPerApp = 'off';
  happAndroidPackages = '';

  // Discord Bot settings
  discordEnable = false;
  discordToken = '';
  discordChannelId = '';
  discordAdminUsers = '';
  discordLang = 'en-US';
  discordBackup = false;
  discordEnabledEvents = '';
  discordCpu = 80;
  discordMemory = 80;

  timeLocation = 'Local';

  ldapEnable = false;
  ldapHost = '';
  ldapPort = 389;
  ldapUseTLS = false;
  ldapInsecureSkipVerify = false;
  ldapBindDN = '';
  ldapPassword = '';
  ldapBaseDN = '';
  ldapUserFilter = '(objectClass=person)';
  ldapUserAttr = 'mail';
  ldapVlessField = 'vless_enabled';
  ldapSyncCron = '@every 1m';
  ldapFlagField = '';
  ldapTruthyValues = 'true,1,yes,on';
  ldapInvertFlag = false;
  ldapInboundTags = '';
  ldapAutoCreate = false;
  ldapAutoDelete = false;
  ldapDefaultTotalGB = 0;
  ldapDefaultExpiryDays = 0;
  ldapDefaultLimitIP = 0;
  tgEnabledEvents = '';
  smtpEnable = false;
  smtpHost = '';
  smtpPort = 587;
  smtpUsername = '';
  smtpPassword = '';
  smtpTo = '';
  smtpEncryptionType = 'starttls';
  smtpEnabledEvents = '';
  smtpCpu = 80;
  smtpMemory = 80;
  hasTgBotToken = false;
  hasTwoFactorToken = false;
  hasLdapPassword = false;
  hasApiToken = false;
  hasWarpSecret = false;
  hasNordSecret = false;
  hasSmtpPassword = false;
  clearTgBotToken = false;
  clearLdapPassword = false;
  clearSmtpPassword = false;

  constructor(data?: unknown) {
    if (data != null) {
      ObjectUtil.cloneProps(this, data);
    }
    const cpu = Math.round(Number(this.tgCpu));
    this.tgCpu = Number.isFinite(cpu) ? Math.min(100, Math.max(0, cpu)) : 80;

    // Ensure ipLimitPolicy is always valid ('block_newest' or 'kick_oldest')
    if (this.ipLimitPolicy !== 'kick_oldest' && this.ipLimitPolicy !== 'block_newest') {
      this.ipLimitPolicy = 'block_newest';
    }
  }

  equals(other: AllSetting): boolean {
    return ObjectUtil.equals(this, other);
  }
}
