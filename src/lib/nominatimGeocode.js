const num = (x) => {
  if (x == null || x === "") return null;
  const v = typeof x === "number" ? x : parseFloat(String(x).replace(",", "."));
  return Number.isFinite(v) ? v : null;
};

/**
 * Use coordinates from API when present (skips Nominatim).
 * Supports flat pand objects and common JSON:API attribute names.
 */
export function coordsFromProp(prop) {
  if (!prop || typeof prop !== "object") return null;

  let lat = num(prop.lat ?? prop.latitude ?? prop.Latitude);
  let lng = num(prop.lng ?? prop.longitude ?? prop.lon ?? prop.Longitude);
  if (lat != null && lng != null) return { lat, lng };

  const loc = prop.location ?? prop.geo ?? prop.geopoint;
  if (loc && typeof loc === "object" && !Array.isArray(loc)) {
    lat = num(loc.lat ?? loc.latitude);
    lng = num(loc.lng ?? loc.longitude ?? loc.lon);
    if (lat != null && lng != null) return { lat, lng };
  }

  // GeoJSON Point: "coordinates": [lon, lat]
  const c = prop.coordinates;
  if (Array.isArray(c) && c.length >= 2) {
    const lon = num(c[0]);
    lat = num(c[1]);
    if (lat != null && lon != null) return { lat, lng: lon };
  }

  return null;
}

/** Address string for geocoding (matches PropertyCard field fallbacks). */
export function buildAddressQuery(prop) {
  const street = prop.street || prop["address-street"] || prop.straat || "";
  const postalCode = prop.postalCode || prop["postal-code"] || "";
  const city = prop.municipality || prop["municipality-name"] || prop.gemeente || "";
  const parts = [street, postalCode, city].filter(Boolean);
  if (!parts.length) return "";
  return `${parts.join(", ")}, Belgium`;
}

const CACHE_PREFIX = "yd_nom:";
const MEM = new Map();

/** Normalized key for cache + deduplicating concurrent items with the same address. */
export function geocodeQueryKey(query) {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

export function readGeocodeCache(query) {
  const k = geocodeQueryKey(query);
  if (MEM.has(k)) return MEM.get(k);
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + k);
    if (!raw) return undefined;
    const v = JSON.parse(raw);
    MEM.set(k, v);
    return v;
  } catch {
    return undefined;
  }
}

export function writeGeocodeCache(query, value) {
  const k = geocodeQueryKey(query);
  MEM.set(k, value);
  try {
    sessionStorage.setItem(CACHE_PREFIX + k, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

/**
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function fetchGeocode(query, signal) {
  const cached = readGeocodeCache(query);
  if (cached !== undefined) return cached;

  const url =
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}` +
    `&limit=1&countrycodes=be`;

  const r = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
      "Accept-Language": "nl,en",
    },
  });
  if (!r.ok) throw new Error(`Geocode HTTP ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data) || !data.length) {
    writeGeocodeCache(query, null);
    return null;
  }
  const { lat, lon } = data[0];
  const out = { lat: parseFloat(lat), lng: parseFloat(lon) };
  if (!Number.isFinite(out.lat) || !Number.isFinite(out.lng)) {
    writeGeocodeCache(query, null);
    return null;
  }
  writeGeocodeCache(query, out);
  return out;
}

export function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Merge pruned coords with API-provided lat/lng for new ids.
 * @param {Record<string, unknown>} prev
 * @param {object[]} list
 */
export function mergeCoordsFromProps(prev, list) {
  const next = {};
  for (const prop of list) {
    const id = prop.id;
    if (prev[id] !== undefined) {
      next[id] = prev[id];
      continue;
    }
    const api = coordsFromProp(prop);
    if (api) next[id] = api;
  }
  return next;
}

/**
 * @param {Record<string, { lat?: number, lng?: number } | false | undefined>} merged
 * @param {object[]} list
 */
export function buildNominatimJobs(merged, list) {
  const noAddressIds = [];
  const groups = new Map();
  for (const prop of list) {
    const id = prop.id;
    if (merged[id] !== undefined) continue;
    const query = buildAddressQuery(prop);
    if (!query) {
      noAddressIds.push(id);
      continue;
    }
    const k = geocodeQueryKey(query);
    if (!groups.has(k)) groups.set(k, { query, ids: new Set() });
    groups.get(k).ids.add(id);
  }
  return { noAddressIds, groups: [...groups.values()] };
}
