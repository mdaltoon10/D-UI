import {
  XMUX_FRESH_DEFAULTS,
  XHttpModeSchema,
  type XHttpMode,
  type XHttpXmux,
} from '@/schemas/protocols/stream/xhttp';

export const XHTTP_MODES = [
  'auto',
  'packet-up',
  'stream-up',
  'stream-one',
] as const satisfies readonly XHttpMode[];

export const XHTTP_PLACEMENTS = [
  'path',
  'header',
  'cookie',
  'query',
] as const;

export const XHTTP_UPLINK_DATA_PLACEMENTS = [
  'body',
  'header',
  'cookie',
  'query',
] as const;

export const XHTTP_PADDING_PLACEMENTS = [
  'queryInHeader',
  'header',
  'cookie',
  'query',
] as const;

export const XHTTP_PADDING_METHODS = [
  'repeat-x',
  'tokenish',
] as const;

export const XHTTP_UPLINK_HTTP_METHODS = [
  'POST',
  'PUT',
  'GET',
] as const;

export interface XhttpModeVisibility {
  maxUploadSize: boolean;
  maxBufferedUpload: boolean;
  minUploadInterval: boolean;
  streamUpServer: boolean;
  uplinkDataPlacement: boolean;
}

const XHTTP_MODE_VISIBILITY: Record<XHttpMode, XhttpModeVisibility> = {
  auto: {
    maxUploadSize: true,
    maxBufferedUpload: true,
    minUploadInterval: true,
    streamUpServer: false,
    uplinkDataPlacement: false,
  },
  'packet-up': {
    maxUploadSize: true,
    maxBufferedUpload: true,
    minUploadInterval: true,
    streamUpServer: false,
    uplinkDataPlacement: true,
  },
  'stream-up': {
    maxUploadSize: false,
    maxBufferedUpload: true,
    minUploadInterval: false,
    streamUpServer: true,
    uplinkDataPlacement: false,
  },
  'stream-one': {
    maxUploadSize: false,
    maxBufferedUpload: false,
    minUploadInterval: false,
    streamUpServer: false,
    uplinkDataPlacement: false,
  },
};

export function normalizeXhttpMode(value: unknown): XHttpMode {
  const parsed = XHttpModeSchema.safeParse(value);
  return parsed.success ? parsed.data : 'auto';
}

export function xhttpModeVisibility(value: unknown): XhttpModeVisibility {
  return XHTTP_MODE_VISIBILITY[normalizeXhttpMode(value)];
}

export function xhttpPlacementRequiresKey(value: unknown): boolean {
  return value === 'header' || value === 'cookie' || value === 'query';
}

export function normalizeXhttpScalarOrRange(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/\s*-\s*/g, '-');
}

export function isValidXhttpScalarOrRange(
  value: unknown,
  allowEmpty = true,
): boolean {
  const normalized = normalizeXhttpScalarOrRange(value);
  if (normalized === '') return allowEmpty;
  if (!/^\d+(?:-\d+)?$/.test(normalized)) return false;

  const [lowerText, upperText = lowerText] = normalized.split('-');
  const lower = Number(lowerText);
  const upper = Number(upperText);
  return Number.isSafeInteger(lower)
    && Number.isSafeInteger(upper)
    && lower >= 0
    && upper >= lower;
}

export function createFreshXhttpXmux(): XHttpXmux {
  return { ...XMUX_FRESH_DEFAULTS };
}

function deleteKeys(
  target: Record<string, unknown>,
  keys: readonly string[],
): void {
  for (const key of keys) delete target[key];
}

/**
 * Removes fields that are not active for the selected xHTTP mode or toggle.
 * This is deliberately shared by the Profile UI and client stream compiler so
 * hidden draft values cannot leak into an effective subscription config.
 */
export function sanitizeXhttpSettings(
  source: Record<string, unknown>,
  options: { stripUiOnly?: boolean } = {},
): Record<string, unknown> {
  const settings = { ...source };
  if (
    settings.sessionIDPlacement === undefined
    && settings.sessionPlacement !== undefined
  ) {
    settings.sessionIDPlacement = settings.sessionPlacement;
  }
  if (
    settings.sessionIDKey === undefined
    && settings.sessionKey !== undefined
  ) {
    settings.sessionIDKey = settings.sessionKey;
  }

  const mode = normalizeXhttpMode(settings.mode);
  const visibility = xhttpModeVisibility(mode);
  settings.mode = mode;

  if (!visibility.maxUploadSize) delete settings.scMaxEachPostBytes;
  if (!visibility.maxBufferedUpload) delete settings.scMaxBufferedPosts;
  if (!visibility.minUploadInterval) delete settings.scMinPostsIntervalMs;
  if (!visibility.streamUpServer) delete settings.scStreamUpServerSecs;

  if (!visibility.uplinkDataPlacement) {
    deleteKeys(settings, ['uplinkDataPlacement', 'uplinkDataKey']);
  } else if (!xhttpPlacementRequiresKey(settings.uplinkDataPlacement)) {
    delete settings.uplinkDataKey;
  }

  if (mode !== 'packet-up' && settings.uplinkHTTPMethod === 'GET') {
    delete settings.uplinkHTTPMethod;
  }

  if (settings.xPaddingObfsMode !== true) {
    deleteKeys(settings, [
      'xPaddingKey',
      'xPaddingHeader',
      'xPaddingPlacement',
      'xPaddingMethod',
    ]);
  }

  if (!xhttpPlacementRequiresKey(settings.sessionIDPlacement)) {
    delete settings.sessionIDKey;
  }
  if (normalizeXhttpScalarOrRange(settings.sessionIDTable) === '') {
    delete settings.sessionIDLength;
  }
  if (!xhttpPlacementRequiresKey(settings.seqPlacement)) {
    delete settings.seqKey;
  }

  delete settings.sessionPlacement;
  delete settings.sessionKey;
  if (options.stripUiOnly !== false) delete settings.enableXmux;

  return settings;
}

/**
 * Applies the visible defaults when a user changes Mode, then sanitizes stale
 * fields. Existing non-empty values are preserved whenever they remain valid.
 */
export function prepareXhttpSettingsForMode(
  source: Record<string, unknown>,
  nextMode: unknown,
): Record<string, unknown> {
  const mode = normalizeXhttpMode(nextMode);
  const settings = sanitizeXhttpSettings(
    { ...source, mode },
    { stripUiOnly: false },
  );
  const visibility = xhttpModeVisibility(mode);

  if (
    visibility.maxBufferedUpload
    && (settings.scMaxBufferedPosts === undefined
      || settings.scMaxBufferedPosts === null)
  ) {
    settings.scMaxBufferedPosts = 30;
  }
  if (
    visibility.streamUpServer
    && normalizeXhttpScalarOrRange(settings.scStreamUpServerSecs) === ''
  ) {
    settings.scStreamUpServerSecs = '20-80';
  }

  return settings;
}
