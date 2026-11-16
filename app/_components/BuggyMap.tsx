"use client";

// npm i react-map-gl maplibre-gl @turf/turf
import { useEffect, useMemo, useState } from "react";
import MapGL, { Marker } from "react-map-gl/maplibre";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import * as turf from "@turf/turf";
import "maplibre-gl/dist/maplibre-gl.css";
import routeData from "./route.json";

if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

const ROUTE_COORDS = routeData.route as [number, number][];
const STOP_DEFS = routeData.stops as { name: string; lng: number; lat: number }[];

const BUGGY_COUNT = 3;
const SPEED_MPS = 15;
const DWELL_MS = 6000; 

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
    prevAlong = 0;
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
  along: number; 
  nextIdx: number;
  dwellLeft: number;
};

export type BuggyView = {
  id: number;
  lng: number;
  lat: number;
  along: number;
  status: string;
};

function useSimulatedBuggies(): BuggyView[] {
  const [views, setViews] = useState<BuggyView[]>([]);

  useEffect(() => {
    const n = STOPS.length;

    const buggies: Buggy[] = Array.from({ length: BUGGY_COUNT }, (_, i) => {
      const idx = Math.floor((i * n) / BUGGY_COUNT);
      return { id: i + 1, along: STOPS[idx].along, nextIdx: idx, dwellLeft: DWELL_MS };
    });

    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const dtMs = Math.min(now - last, 100);
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
          const remaining = (target - b.along + LOOP_LEN) % LOOP_LEN;

          if (remaining <= step) {
            b.along = target; 
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
          return {
            id: b.id,
            lng,
            lat,
            along: b.along,
            status: b.dwellLeft > 0 ? `At ${stop}` : `Heading to ${stop}`,
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
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
    route: { type: "geojson", data: LOOP },
  },
  layers: [
    { id: "osm", type: "raster", source: "osm" },
    {
      id: "route-casing",
      type: "line",
      source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#1558c9",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 18, 17],
      },
    },
    {
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
        style={{ width: "100%", height: "100%" }}
      >

        {STOPS.map((s) => (
          <Marker key={s.name} longitude={s.lng} latitude={s.lat} anchor="center">
            <div
              title={s.name}
              style={{
                position: "relative",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#fff",
                border: "3px solid #1f2937",
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
                  color: "#1f2937",
                  textShadow:
                    "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 4px #fff",
                }}
              >
                {s.name}
              </span>
            </div>
          </Marker>
        ))}

        {buggies.map((b) => (
          <Marker key={b.id} longitude={b.lng} latitude={b.lat} anchor="center">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#f59e0b",
                color: "#111",
                fontWeight: 700,
                fontSize: 13,
                display: "grid",
                placeItems: "center",
                border: "2px solid #fff",
                boxShadow: "0 1px 4px rgba(0,0,0,.4)",
              }}
            >
              {b.id}
            </div>
          </Marker>
        ))}
      </MapGL>

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          background: "rgba(255,255,255,.95)",
          color: "#111",
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
      </div>
    </div>
  );
}