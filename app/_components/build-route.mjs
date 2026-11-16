import { writeFileSync } from "node:fs";

const WAYPOINTS = [
  { name: "Stop 1 - Jalan Teknik Elektro", lat: -7.288303, lng: 112.792708 },
  { name: "Stop 2 - Jalan Teknik Mesin", lat: -7.284404, lng: 112.793044 },
  { name: "Bundaran Manarul Ilmi", lat: -7.281605, lng: 112.792561, stop: false },
  { name: "Stop 3 - Taman Alumni", lat: -7.279976, lng: 112.791092 },
  { name: "Stop 4", lat: -7.280328, lng: 112.792165 },
  { name: "Stop 5 - Teknik Teknologi", lat: -7.282137, lng: 112.793935 },
  { name: "Stop 6", lat: -7.285031, lng: 112.793466 },
];

if (WAYPOINTS.some((w) => w.lat === 0 && w.lng === 0)) {
  throw new Error("Fill in real lat/lng for every waypoint first.");
}

const path = [...WAYPOINTS, WAYPOINTS[0]].map((w) => `${w.lng},${w.lat}`).join(";");
const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`;

const res = await fetch(url);
const json = await res.json();
if (json.code !== "Ok") throw new Error(json.message ?? json.code);

const route = json.routes[0].geometry.coordinates;
const stops = WAYPOINTS.filter((w) => w.stop !== false).map(({ name, lat, lng }) => ({
  name,
  lat,
  lng,
}));

writeFileSync("route.json", JSON.stringify({ route, stops }));
console.log(`route.json written: ${route.length} points, ${(json.routes[0].distance / 1000).toFixed(2)} km`);
