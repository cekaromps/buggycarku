"use client";

// npm i react-map-gl maplibre-gl @turf/turf
import { useEffect, useMemo, useState } from "react";
import MapGL, { Marker, Source, Layer } from "react-map-gl/maplibre";
import type { LayerProps } from "react-map-gl/maplibre";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import * as turf from "@turf/turf";
import "maplibre-gl/dist/maplibre-gl.css";
import routeData from "./route.json";

// GeoJSON (the blue route line) is processed in a web worker. Next's bundler can break
// the worker MapLibre builds on the fly ("Worker failed to load"), so load a plain copy
// from /public instead. Copy it there once:
//   cp node_modules/maplibre-gl/dist/maplibre-gl-csp-worker.js public/
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

const ROUTE_COORDS = routeData.route as [number, number][];
const STOP_DEFS = routeData.stops as { name: string; lng: number; lat: number }[];

const BUGGY_COUNT = 2;
const SPEED_MPS = 5;
const DWELL_MS = 6000; 

/* ---------- 2. Precompute the loop and each stop's distance along it ---------- */

const LOOP = turf.lineString(ROUTE_COORDS);
const LOOP_LEN = turf.length(LOOP, { units: "meters" });

const SAMPLE_M = 5;
const SAMPLES = Array.from({ length: Math.ceil(LOOP_LEN / SAMPLE_M) }, (_, i) => {
  const along = i * SAMPLE_M;
  const [lng, lat] = turf.along(LOOP, along, { units: "meters" }).geometry.coordinates;
  return { along, lng, lat };
});

let prevAlong = -1;
const STOPS = STOP_DEFS.map((s, i) => {
  if (i === 0) {
    prevAlong = 0; // the route starts at the first stop
    return { ...s, along: 0 };
  }
  let best = SAMPLES[SAMPLES.length - 1];
  let bestDist = Infinity;
  for (const p of SAMPLES) {
    if (p.along <= prevAlong) continue;
    const d = turf.distance([s.lng, s.lat], [p.lng, p.lat], { units: "meters" });
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  prevAlong = best.along;
  return { ...s, along: best.along };
});

type Buggy = {
  id: number;
  along: number; // meters from loop start
  nextIdx: number; // index of the stop it is at or heading to
  dwellLeft: number; // ms left at the current stop, 0 = moving
};

export type BuggyView = {
  id: number;
  lng: number;
  lat: number;
  along: number;
  status: string;
  dwelling: boolean; // parked at a stop
  dwellLeftMs: number; // time left parked
  targetIdx: number; // the stop its NEXT leg ends at
};

function useSimulatedBuggies(): BuggyView[] {
  const [views, setViews] = useState<BuggyView[]>([]);

  useEffect(() => {
    const n = STOPS.length;

    // Spread buggies evenly around the loop, each starting parked at a stop
    const buggies: Buggy[] = Array.from({ length: BUGGY_COUNT }, (_, i) => {
      const idx = Math.floor((i * n) / BUGGY_COUNT);
      return { id: i + 1, along: STOPS[idx].along, nextIdx: idx, dwellLeft: DWELL_MS };
    });

    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const dtMs = Math.min(now - last, 100); // clamp when the tab was in background
      last = now;

      for (const b of buggies) {
        if (b.dwellLeft > 0) {
          b.dwellLeft -= dtMs;
          if (b.dwellLeft <= 0) {
            b.dwellLeft = 0;
            b.nextIdx = (b.nextIdx + 1) % n; // leave for the next stop
          }
        } else {
          const step = (SPEED_MPS * dtMs) / 1000;
          const target = STOPS[b.nextIdx].along;
          const remaining = (target - b.along + LOOP_LEN) % LOOP_LEN; // wraps at loop end

          if (remaining <= step) {
            b.along = target; // arrived: snap exactly onto the stop and wait
            b.dwellLeft = DWELL_MS;
          } else {
            b.along = (b.along + step) % LOOP_LEN;
          }
        }
      }

      setViews(
        buggies.map((b) => {
          const [lng, lat] = turf.along(LOOP, b.along, { units: "meters" }).geometry.coordinates;
          const stop = STOPS[b.nextIdx].name;
          const dwelling = b.dwellLeft > 0;
          return {
            id: b.id,
            lng,
            lat,
            along: b.along,
            status: dwelling ? `At ${stop}` : `Heading to ${stop}`,
            dwelling,
            dwellLeftMs: b.dwellLeft,
            // parked: nextIdx is the stop it's AT, so its next leg ends at the one after
            targetIdx: dwelling ? (b.nextIdx + 1) % n : b.nextIdx,
          };
        })
      );

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return views;
}

/* ---------- 3b. Next leg of a tapped buggy ---------- */

// Slice of the loop from the buggy's current position to the end of its next leg.
// The loop wraps, so a leg can cross the end of the line (-> two slices joined).
function nextLeg(b: BuggyView) {
  const target = STOPS[b.targetIdx];
  const remaining = Math.max((target.along - b.along + LOOP_LEN) % LOOP_LEN, 0.5);
  const end = b.along + remaining;

  const slice = (from: number, to: number) =>
    turf.lineSliceAlong(LOOP, from, to, { units: "meters" }).geometry.coordinates;

  const coords =
    end <= LOOP_LEN || end - LOOP_LEN < 0.5
      ? slice(b.along, Math.min(end, LOOP_LEN))
      : [...slice(b.along, LOOP_LEN), ...slice(0, end - LOOP_LEN)];

  return {
    line: turf.lineString(coords),
    targetName: target.name,
    meters: remaining,
    // travel time, plus whatever is left of the current stop's dwell
    seconds: remaining / SPEED_MPS + (b.dwelling ? b.dwellLeftMs / 1000 : 0),
  };
}

function formatEta(seconds: number) {
  return seconds < 90 ? `${Math.ceil(seconds)} s` : `${Math.ceil(seconds / 60)} min`;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/* ---------- 3c. Where is the user, and which buggy is closest / soonest? ---------- */

type Me = { lng: number; lat: number; accuracy: number };

// Seconds until buggy `b` is at stop `stopIdx`: drive each leg, and wait out the
// dwell at every stop it passes on the way (plus what is left of its current dwell).
function secondsToStop(b: BuggyView, stopIdx: number) {
  const n = STOPS.length;
  if (b.dwelling && (b.targetIdx - 1 + n) % n === stopIdx) return 0; // already parked there

  let t = b.dwelling ? b.dwellLeftMs / 1000 : 0;
  let pos = b.along;
  let idx = b.targetIdx;
  for (let i = 0; i < n; i++) {
    t += ((STOPS[idx].along - pos + LOOP_LEN) % LOOP_LEN) / SPEED_MPS;
    if (idx === stopIdx) return t;
    t += DWELL_MS / 1000;
    pos = STOPS[idx].along;
    idx = (idx + 1) % n;
  }
  return t;
}

function userInfo(me: Me, buggies: BuggyView[]) {
  const here: [number, number] = [me.lng, me.lat];

  let stopIdx = 0;
  let stopM = Infinity;
  STOPS.forEach((s, i) => {
    const d = turf.distance(here, [s.lng, s.lat], { units: "meters" });
    if (d < stopM) {
      stopM = d;
      stopIdx = i;
    }
  });

  let nearest: { buggy: BuggyView; meters: number } | null = null; // closest as the crow flies
  let soonest: { buggy: BuggyView; seconds: number } | null = null; // first to reach your stop
  for (const b of buggies) {
    const d = turf.distance(here, [b.lng, b.lat], { units: "meters" });
    if (!nearest || d < nearest.meters) nearest = { buggy: b, meters: d };
    const s = secondsToStop(b, stopIdx);
    if (!soonest || s < soonest.seconds) soonest = { buggy: b, seconds: s };
  }

  return { stop: STOPS[stopIdx], stopM, nearest, soonest };
}

const NEXT_LEG_CASING: LayerProps = {
  id: "next-leg-casing",
  type: "line",
  layout: { "line-cap": "round", "line-join": "round" },
  paint: {
    "line-color": "#ee8d43", // shows as dark amber (#b45309) after the dark filter
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 8, 18, 20],
  },
};

const NEXT_LEG_LINE: LayerProps = {
  id: "next-leg-line",
  type: "line",
  layout: { "line-cap": "round", "line-join": "round" },
  paint: {
    "line-color": "#a85100", // shows as light amber (~#ec9543) after the dark filter
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 5, 18, 13],
  },
};

/* ---------- 4. Map ---------- */

// The route lives inside the map style itself, so it is drawn as soon as the map is,
// with no dependency on React renders or load timing.
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      // Plain OSM tiles (no API key). They are darkened in globals.css with a CSS filter on
      // the map canvas, so the colours of the route layers below are chosen to look right
      // AFTER that filter (invert + hue-rotate), not as written.
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
    route: { type: "geojson", data: LOOP },
  },
  layers: [
    { id: "osm", type: "raster", source: "osm" },
    {
      // darker edge
      id: "route-casing",
      type: "line",
      source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#70b3ff", // shows as a darker blue (~#1a5da9) after the dark filter
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 18, 17],
      },
    },
    {
      // bright blue fill
      id: "route-line",
      type: "line",
      source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#2b8cff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 18, 11],
      },
    },
  ],
};

export default function BuggyMap() {
  const buggies = useSimulatedBuggies();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = buggies.find((b) => b.id === selectedId) ?? null;
  const leg = selected ? nextLeg(selected) : null; // recomputed each frame so it follows the buggy

  // The phone's position. Browsers only allow this on https:// (or localhost) and after
  // the user taps "Allow" on the permission prompt.
  const [me, setMe] = useState<Me | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setMe({ lng: pos.coords.longitude, lat: pos.coords.latitude, accuracy: pos.coords.accuracy });
        setGeoError(null);
      },
      (err) =>
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked. Allow it for this site in your browser settings (it also needs https)."
            : "Can't get your location right now."
        ),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const info = me && buggies.length > 0 ? userInfo(me, buggies) : null;

  const center = useMemo(() => {
    const [lng, lat] = turf.center(LOOP).geometry.coordinates;
    return { longitude: lng, latitude: lat };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <MapGL
        initialViewState={{ ...center, zoom: 15.5 }}
        mapLib={maplibregl}
        mapStyle={MAP_STYLE}
        onError={(e) => console.error("Map error:", e.error)}
        onClick={() => setSelectedId(null)} // tap empty map to deselect
        style={{ width: "100%", height: "100%" }}
      >
        {leg && (
          <Source id="next-leg" type="geojson" data={leg.line}>
            <Layer {...NEXT_LEG_CASING} />
            <Layer {...NEXT_LEG_LINE} />
          </Source>
        )}

        {me && (
          <Marker longitude={me.lng} latitude={me.lat} anchor="center">
            <div
              title="You are here"
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#3b82f6",
                border: "3px solid #fff",
                boxShadow: "0 0 0 6px rgba(59,130,246,.3)",
              }}
            />
          </Marker>
        )}

        {STOPS.map((s) => (
          <Marker key={s.name} longitude={s.lng} latitude={s.lat} anchor="center">
            <div
              title={s.name}
              style={{
                position: "relative",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#111827",
                border: "3px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 18,
                  top: "50%",
                  transform: "translateY(-50%)",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#e5e7eb",
                  textShadow:
                    "-1px -1px 0 #0a0a0a, 1px -1px 0 #0a0a0a, -1px 1px 0 #0a0a0a, 1px 1px 0 #0a0a0a, 0 0 4px #0a0a0a",
                }}
              >
                {s.name}
              </span>
            </div>
          </Marker>
        ))}

        {buggies.map((b) => (
          <Marker
            key={b.id}
            longitude={b.lng}
            latitude={b.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation(); // don't let the map's onClick deselect it
              setSelectedId(b.id === selectedId ? null : b.id);
            }}
          >
            <div
              title={`Buggy ${b.id}`}
              style={{
                position: "relative",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#f59e0b",
                display: "grid",
                placeItems: "center",
                border: "2px solid #fff",
                boxShadow:
                  b.id === selectedId ? "0 0 0 3px #111, 0 1px 4px rgba(0,0,0,.4)" : "0 1px 4px rgba(0,0,0,.4)",
                cursor: "pointer",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label={`Buggy ${b.id}`}
                role="img"
              >
                <path d="M4 4h14a1 1 0 0 1 1 1v1H3V5a1 1 0 0 1 1-1z" />
                <path d="M5 6v6M17 6v6" />
                <path d="M19.3 16H22v-4H2v4h2.7" />
                <path d="M9.3 16h5.4" />
                <circle cx="7" cy="17" r="2.5" />
                <circle cx="17" cy="17" r="2.5" />
              </svg>
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#111",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 11,
                  display: "grid",
                  placeItems: "center",
                  border: "1.5px solid #fff",
                }}
              >
                {b.id}
              </span>
            </div>
          </Marker>
        ))}
      </MapGL>

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          background: "rgba(17,24,39,.92)",
          color: "#f3f4f6",
          border: "1px solid rgba(255,255,255,.12)",
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {buggies.map((b) => (
          <div key={b.id}>
            <strong>Buggy {b.id}</strong>: {b.status}
          </div>
        ))}
        {selected && leg && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.18)" }}>
            <strong>Buggy {selected.id} next route</strong>
            <br />
            {selected.dwelling ? "Leaves for" : "Arrives at"} {leg.targetName}
            <br />
            {Math.round(leg.meters)} m · ~{formatEta(leg.seconds)}
          </div>
        )}
      </div>

      {/* Bottom panel: fixed to the screen (not the map) so it is always visible */}
      <div
        style={{
          position: "fixed",
          left: 12,
          right: 12,
          bottom: "max(12px, env(safe-area-inset-bottom))",
          zIndex: 10,
          maxWidth: 480,
          margin: "0 auto",
          background: "rgba(17,24,39,.94)",
          color: "#f3f4f6",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 12,
          padding: "12px 14px",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.65 }}>Your location</div>
        {info ? (
          <div>
            Near <strong>{info.stop.name}</strong> · {formatDistance(info.stopM)} away
          </div>
        ) : (
          <div>{geoError ?? "Finding your location…"}</div>
        )}

        {info?.nearest && (
          <>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 8 }}>Nearest buggy</div>
            <button
              type="button"
              onClick={() => setSelectedId(info.nearest!.buggy.id)}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "block",
                width: "100%",
              }}
              title="Tap to show its next route"
            >
              <strong>Buggy {info.nearest.buggy.id}</strong> · {formatDistance(info.nearest.meters)} away ·{" "}
              {info.nearest.buggy.status}
            </button>
          </>
        )}

        {info?.soonest && (
          <>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 8 }}>Next buggy at your stop</div>
            <div>
              <strong>Buggy {info.soonest.buggy.id}</strong>{" "}
              {info.soonest.seconds === 0
                ? `is at ${info.stop.name} now`
                : `reaches ${info.stop.name} in ~${formatEta(info.soonest.seconds)}`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}