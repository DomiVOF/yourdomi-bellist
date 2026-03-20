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

function cacheKey(query) {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

export function readGeocodeCache(query) {
  const k = cacheKey(query);
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
  const k = cacheKey(query);
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
