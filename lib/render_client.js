/**
 * LFGOS Sports Fiesta 2026 - Render API Client
 * Strictly server-to-server client with an enforce-by-design allowlist.
 * Prohibits accessing private entities (access_code, audit_log, user, etc.).
 * Implements 8s upstream timeout, cold-start detection, ETag revalidation,
 * and fast LiveSnapshot assembly.
 */

const ALLOWLISTED_ENTITIES = new Set([
  'school',
  'points_config',
  'sport_event',
  'team_competition',
  'fixture',
  'event_result',
  'points_ledger',
  'announcement',
  'display_state',
  'live_snapshot',
  'media_item'
]);

const ALLOWLISTED_FUNCTIONS = new Set([
  'tournament.sync',
  'display.get_state'
]);

class RenderClientError extends Error {
  constructor(message, status = 500, code = 'RENDER_ERROR') {
    super(message);
    this.name = 'RenderClientError';
    this.status = status;
    this.code = code;
  }
}

class ForbiddenEntityError extends RenderClientError {
  constructor(entity) {
    super(`Access to upstream entity "${entity}" is strictly forbidden by policy.`, 403, 'FORBIDDEN_ENTITY');
  }
}

class RenderColdStartTimeoutError extends RenderClientError {
  constructor(timeoutMs = 8000) {
    super(`Render server did not respond within ${timeoutMs}ms (likely cold/sleeping).`, 503, 'RENDER_WARMING');
  }
}

/**
 * Validates entity name against the strict allowlist.
 */
function assertAllowedEntity(entity) {
  const normalized = String(entity || '').toLowerCase().trim();
  if (!ALLOWLISTED_ENTITIES.has(normalized)) {
    throw new ForbiddenEntityError(entity);
  }
  return normalized;
}

/**
 * Fetch a single allowlisted entity from Render.
 */
async function fetchEntity({
  baseUrl,
  proxyKey,
  entity,
  id = null,
  etag = null,
  timeoutMs = 8000
}) {
  const validEntity = assertAllowedEntity(entity);
  const base = (baseUrl || process.env.RENDER_API_BASE || 'https://lfgos-api.onrender.com').replace(/\/+$/, '');
  const url = id ? `${base}/v1/${validEntity}/${encodeURIComponent(id)}` : `${base}/v1/${validEntity}`;

  const headers = {
    'Accept': 'application/json'
  };
  const key = proxyKey || process.env.RENDER_PROXY_KEY;
  if (key) {
    headers['X-Proxy-Key'] = key;
  }
  if (etag) {
    headers['If-None-Match'] = etag;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timer);

    const resEtag = res.headers.get('etag');

    if (res.status === 304) {
      return { status: 304, notModified: true, etag: resEtag };
    }

    if (res.status === 401) {
      throw new RenderClientError('Render proxy rejected proxy key (401 Unauthorized)', 401, 'INVALID_PROXY_KEY');
    }

    if (res.status === 404) {
      return { status: 404, data: [] };
    }

    if (!res.ok) {
      throw new RenderClientError(`Render upstream returned HTTP ${res.status}`, res.status);
    }

    const data = await res.json();
    return {
      status: 200,
      data: Array.isArray(data) ? data : (data.records || data.items || data),
      etag: resEtag
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new RenderColdStartTimeoutError(timeoutMs);
    }
    throw err;
  }
}

/**
 * Fetch and assemble LiveSnapshot (fast source).
 * Combines chunked payloads payload_1 ... payload_8.
 */
async function fetchLiveSnapshot({ baseUrl, proxyKey, etag = null, timeoutMs = 8000 } = {}) {
  const result = await fetchEntity({
    baseUrl,
    proxyKey,
    entity: 'live_snapshot',
    etag,
    timeoutMs
  });

  if (result.notModified) {
    return { notModified: true, etag: result.etag };
  }

  const list = result.data;
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }

  const snap = list[0];
  let combined = '';
  for (let i = 1; i <= 8; i++) {
    if (snap[`payload_${i}`]) {
      combined += snap[`payload_${i}`];
    }
  }

  if (!combined) {
    return null;
  }

  try {
    const parsed = JSON.parse(combined);
    return {
      version: snap.version,
      builtAt: snap.built_at,
      data: parsed,
      etag: result.etag
    };
  } catch (err) {
    console.warn('[RenderClient] Failed to parse assembled live_snapshot:', err.message);
    return null;
  }
}

/**
 * Fetch all allowlisted individual entities concurrently.
 */
async function fetchAllEntities({ baseUrl, proxyKey, timeoutMs = 8000 } = {}) {
  const entitiesToFetch = [
    'school',
    'points_config',
    'sport_event',
    'team_competition',
    'fixture',
    'event_result',
    'points_ledger',
    'announcement',
    'display_state',
    'media_item'
  ];

  const results = await Promise.all(
    entitiesToFetch.map(ent => fetchEntity({ baseUrl, proxyKey, entity: ent, timeoutMs }))
  );

  const dataMap = {};
  entitiesToFetch.forEach((ent, idx) => {
    dataMap[ent] = results[idx]?.data || [];
  });

  return dataMap;
}

/**
 * Fetch photos from the official Sports Fiesta Photos / Gallery API.
 * Endpoint: https://fiesta-gold-glance.base44.app/functions/galleryPhotos?action=list
 * Note: Reads are public and open to everyone without auth headers.
 */
async function fetchGalleryPhotos(timeoutMs = 4000) {
  const envUrl = process.env.GALLERY_API_URL || 'https://fiesta-gold-glance.base44.app/functions/galleryPhotos';
  const targetUrl = envUrl.includes('action=') ? envUrl : `${envUrl}?action=list`;
  const token = process.env.GALLERY_API_TOKEN || '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. Try public read without credentials first (canonical public read)
    let res = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });

    // 2. If 401 and an explicit GALLERY_API_TOKEN is configured, retry with Bearer token
    if (res.status === 401 && token) {
      res = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token.trim()}`
        },
        signal: controller.signal
      });
    }

    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[PhotosAPI] Request to ${targetUrl} returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json().catch(() => ({}));
    let photosList = [];
    if (Array.isArray(data.photos)) {
      photosList = data.photos;
    } else if (Array.isArray(data)) {
      photosList = data;
    }

    return photosList.map((p, idx) => ({
      id: p.id || `gallery-photo-${idx + 1}`,
      title: p.caption || p.file_name || `Sports Fiesta Moment #${idx + 1}`,
      caption: p.caption || p.file_name || 'Sports Fiesta Moment',
      file_url: p.image_url || p.file_url || p.url || '',
      url: p.image_url || p.file_url || p.url || '',
      kind: 'photo',
      active: true,
      consent_approved: true,
      created_date: p.created_date || p.created_at || new Date().toISOString(),
      order: idx + 1
    })).filter(p => !!p.file_url);
  } catch (err) {
    clearTimeout(timer);
    console.warn('[PhotosAPI] Failed to fetch gallery photos:', err.message);
    return [];
  }
}

module.exports = {
  ALLOWLISTED_ENTITIES,
  ALLOWLISTED_FUNCTIONS,
  RenderClientError,
  ForbiddenEntityError,
  RenderColdStartTimeoutError,
  assertAllowedEntity,
  fetchEntity,
  fetchLiveSnapshot,
  fetchAllEntities,
  fetchGalleryPhotos
};
