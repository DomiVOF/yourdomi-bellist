import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import {
  buildAddressQuery,
  readGeocodeCache,
  fetchGeocode,
  delay,
} from "../lib/nominatimGeocode.js";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: iconShadow,
});

const BE_CENTER = [50.9, 4.4];
const BE_ZOOM = 8;
const NOMINATIM_GAP_MS = 1100;

function FitBounds({ pointsKey, points }) {
  const map = useMap();
  const pointsRef = useRef(points);
  pointsRef.current = points;
  useEffect(() => {
    const pts = pointsRef.current;
    if (!pts.length) {
      map.setView(BE_CENTER, BE_ZOOM);
      return;
    }
    if (pts.length === 1) {
      map.setView(pts[0], 14);
      return;
    }
    const b = L.latLngBounds(pts);
    map.fitBounds(b, { padding: [48, 48], maxZoom: 15 });
  }, [map, pointsKey]);
  return null;
}

/**
 * @param {object[]} items — zichtbaar panden
 * @param {(prop: object) => React.ReactNode} renderPropertyCard
 */
export default function PropertyMapView({ items, renderPropertyCard }) {
  const [coordsById, setCoordsById] = useState({});
  const generationRef = useRef(0);
  const leaveTimerRef = useRef(null);
  const [hoverProp, setHoverProp] = useState(null);

  const itemsKey = useMemo(
    () => items.map((p) => p.id).join("|"),
    [items],
  );

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const list = itemsRef.current;
    const gen = ++generationRef.current;
    const ac = new AbortController();

    setCoordsById((prev) => {
      const allowed = new Set(list.map((p) => p.id));
      const next = {};
      for (const id of allowed) {
        if (prev[id] !== undefined) next[id] = prev[id];
      }
      return next;
    });

    (async () => {
      let needDelayBeforeNextNetwork = false;
      for (const prop of list) {
        if (gen !== generationRef.current) return;

        const id = prop.id;
        const query = buildAddressQuery(prop);
        if (!query) {
          setCoordsById((prev) =>
            prev[id] !== undefined ? prev : { ...prev, [id]: false },
          );
          continue;
        }

        const cached = readGeocodeCache(query);
        if (cached !== undefined) {
          setCoordsById((prev) =>
            prev[id] !== undefined ? prev : { ...prev, [id]: cached || false },
          );
          continue;
        }

        if (needDelayBeforeNextNetwork) {
          await delay(NOMINATIM_GAP_MS);
          if (gen !== generationRef.current || ac.signal.aborted) return;
        }
        needDelayBeforeNextNetwork = true;

        try {
          const res = await fetchGeocode(query, ac.signal);
          if (gen !== generationRef.current) return;
          setCoordsById((prev) =>
            prev[id] !== undefined ? prev : { ...prev, [id]: res || false },
          );
        } catch {
          if (gen !== generationRef.current) return;
          setCoordsById((prev) =>
            prev[id] !== undefined ? prev : { ...prev, [id]: false },
          );
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [itemsKey]);

  const points = useMemo(() => {
    const out = [];
    for (const p of items) {
      const c = coordsById[p.id];
      if (c && typeof c.lat === "number" && typeof c.lng === "number") {
        out.push([c.lat, c.lng]);
      }
    }
    return out;
  }, [items, coordsById]);

  const pointsKey = useMemo(
    () => points.map((x) => `${x[0].toFixed(5)},${x[1].toFixed(5)}`).join("|"),
    [points],
  );

  const pendingGeocode = useMemo(() => {
    let n = 0;
    for (const p of items) {
      const q = buildAddressQuery(p);
      if (!q) continue;
      if (coordsById[p.id] === undefined) n += 1;
    }
    return n;
  }, [items, coordsById]);

  const failedGeocode = useMemo(() => {
    let n = 0;
    for (const p of items) {
      if (coordsById[p.id] === false) n += 1;
    }
    return n;
  }, [items, coordsById]);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const scheduleClearHover = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => setHoverProp(null), 280);
  }, [clearLeaveTimer]);

  const onMarkerOver = useCallback(
    (prop) => {
      clearLeaveTimer();
      setHoverProp(prop);
    },
    [clearLeaveTimer],
  );

  return (
    <div className="relative w-full h-[calc(100vh-220px)] min-h-[480px] rounded-xl border border-yd-border overflow-hidden bg-yd-bg">
      <MapContainer
        center={BE_CENTER}
        zoom={BE_ZOOM}
        className="z-0 h-full w-full"
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pointsKey={pointsKey} points={points} />
        {items.map((prop) => {
          const c = coordsById[prop.id];
          if (!c || typeof c.lat !== "number") return null;
          return (
            <Marker
              key={prop.id}
              position={[c.lat, c.lng]}
              eventHandlers={{
                mouseover: () => onMarkerOver(prop),
                mouseout: scheduleClearHover,
              }}
            />
          );
        })}
      </MapContainer>

      {pendingGeocode > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] text-yd-muted shadow border border-yd-border max-w-[min(100%,280px)]">
          Adressen op de kaart plaatsen… ({pendingGeocode} bezig)
        </div>
      )}
      {failedGeocode > 0 && pendingGeocode === 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 shadow border border-amber-200 max-w-[min(100%,280px)]">
          {failedGeocode} adres(sen) niet gevonden op de kaart.
        </div>
      )}

      {hoverProp && (
        <div
          className="absolute top-3 right-3 z-[1000] w-[min(100vw-2rem,380px)] max-h-[min(85vh,calc(100%-24px))] overflow-y-auto rounded-xl border border-[#EBEBEB] bg-white shadow-xl pointer-events-auto"
          onMouseEnter={clearLeaveTimer}
          onMouseLeave={scheduleClearHover}
        >
          {renderPropertyCard(hoverProp)}
        </div>
      )}
    </div>
  );
}
