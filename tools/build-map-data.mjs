#!/usr/bin/env node
// Builds the self-hosted map data for the scroll-driven "Anflug" map.
//
// Input:  OpenStreetMap data from the Overpass API (cached in tools/.cache).
// Output: site/assets/data/altstadt.json - one compact GeoJSON FeatureCollection.
//
// Usage:
//   node tools/build-map-data.mjs            # uses the cache if present
//   node tools/build-map-data.mjs --refresh  # downloads fresh OSM data first
//
// Map data (c) OpenStreetMap contributors, ODbL. The attribution is shown on the map.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheFile = join(root, 'tools/.cache/osm-weissenburg.json');
const queryFile = join(root, 'tools/overpass-query.overpassql');
const outFile = join(root, 'site/assets/data/altstadt.json');

// OSM way of the house (Pfarrgasse 3, ehem. Pfarrwitwenhaus).
const HOME_WAY_ID = 282861246;
const LANDMARK_IDS = new Set([
  27855049, // Römermuseum
  282861360, // Reichsstadtmuseum
  31260824, // Altes Rathaus
]);

async function loadOsm(refresh) {
  if (!refresh && existsSync(cacheFile)) {
    return JSON.parse(await readFile(cacheFile, 'utf8'));
  }
  const query = await readFile(queryFile, 'utf8');
  for (let attempt = 0, wait = 5000; attempt < 6; attempt++, wait *= 2) {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'User-Agent': 'ferienwohnung-weissenburg map build', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
    });
    if (res.ok) {
      const json = await res.json();
      await mkdir(dirname(cacheFile), { recursive: true });
      await writeFile(cacheFile, JSON.stringify(json));
      return json;
    }
    console.warn(`Overpass responded ${res.status}, retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error('Overpass API not reachable');
}

const round = (n) => Math.round(n * 1e6) / 1e6;
const toCoords = (geometry) => geometry.map((p) => [round(p.lon), round(p.lat)]);
const isClosed = (c) => c.length > 3 && c[0][0] === c.at(-1)[0] && c[0][1] === c.at(-1)[1];

// Joins the member ways of a multipolygon relation into closed rings.
function assembleRings(members) {
  const parts = members.filter((m) => m.type === 'way' && m.geometry).map((m) => toCoords(m.geometry));
  const rings = [];
  while (parts.length) {
    let ring = parts.shift();
    let extended = true;
    while (!isClosed(ring) && extended) {
      extended = false;
      const end = ring.at(-1);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const same = (a, b) => a[0] === b[0] && a[1] === b[1];
        if (same(p[0], end)) ring = ring.concat(p.slice(1));
        else if (same(p.at(-1), end)) ring = ring.concat(p.slice(0, -1).reverse());
        else continue;
        parts.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (isClosed(ring)) rings.push(ring);
  }
  return rings;
}

function polygonsOf(el) {
  if (el.type === 'way' && el.geometry) {
    const c = toCoords(el.geometry);
    return isClosed(c) ? [[c]] : [];
  }
  if (el.type === 'relation' && el.members) {
    const outers = assembleRings(el.members.filter((m) => m.role !== 'inner'));
    const inners = assembleRings(el.members.filter((m) => m.role === 'inner'));
    return outers.map((o) => [o, ...inners.filter((i) => pointInRing(i[0], o))]);
  }
  return [];
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function centroid(ring) {
  let x = 0;
  let y = 0;
  for (const [px, py] of ring) {
    x += px;
    y += py;
  }
  return [x / ring.length, y / ring.length];
}

function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// Deterministic pseudo random number in [0, 1) so heights do not change between builds.
const jitter = (id) => ((Math.sin(id * 12.9898) * 43758.5453) % 1 + 1) % 1;

const SMALL_BUILDINGS = new Set(['garage', 'garages', 'carport', 'shed', 'hut', 'roof', 'greenhouse', 'service', 'kiosk']);

function buildingHeight(tags, id, inAltstadt) {
  // OSM often tags a church with its tower height; the footprint is the nave, so keep it at nave height.
  if (tags.building === 'church') return 20;
  const h = parseFloat(tags.height);
  if (Number.isFinite(h) && h > 0) return Math.min(h, 30);
  if (SMALL_BUILDINGS.has(tags.building)) return 3;
  const levels = parseFloat(tags['building:levels']);
  if (Number.isFinite(levels)) {
    const roof = parseFloat(tags['roof:levels']);
    return levels * 3 + (Number.isFinite(roof) ? roof * 2.5 : inAltstadt ? 4 : 2);
  }
  return inAltstadt ? 11 + jitter(id) * 4 : 7 + jitter(id) * 3;
}

const LAND_CLASSES = [
  ['water', (t) => t.natural === 'water' || t.waterway === 'riverbank' || t.leisure === 'swimming_pool'],
  ['forest', (t) => ['forest'].includes(t.landuse) || ['wood', 'scrub'].includes(t.natural)],
  ['pitch', (t) => ['pitch', 'track', 'playground'].includes(t.leisure)],
  ['park', (t) => ['park', 'garden', 'dog_park'].includes(t.leisure) || ['grass', 'recreation_ground', 'village_green', 'cemetery'].includes(t.landuse)],
  ['meadow', (t) => ['meadow'].includes(t.landuse) || ['grassland', 'heath', 'wetland'].includes(t.natural)],
  ['farm', (t) => ['farmland', 'farmyard', 'orchard', 'allotments', 'vineyard'].includes(t.landuse)],
];

const ROAD_CLASSES = {
  major: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'],
  minor: ['residential', 'unclassified', 'living_street', 'pedestrian', 'service', 'road'],
  path: ['footway', 'path', 'steps', 'cycleway', 'track', 'bridleway'],
};
const roadClass = (hw) => Object.keys(ROAD_CLASSES).find((k) => ROAD_CLASSES[k].includes(hw));

// Small octagon around a point, used for the little 3D trees.
function octagon([lon, lat], radiusM) {
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ring.push([round(lon + Math.cos(a) * dLon), round(lat + Math.sin(a) * dLat)]);
  }
  ring.push(ring[0]);
  return ring;
}

// Turns a wall line into thin quads so it can be extruded.
function wallQuads(coords, widthM) {
  const quads = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const k = Math.cos((y1 * Math.PI) / 180);
    const dx = (x2 - x1) * k;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (!len) continue;
    const off = widthM / 2 / 111320;
    const nx = (-dy / len) * off / k;
    const ny = (dx / len) * off;
    quads.push([
      [round(x1 + nx), round(y1 + ny)],
      [round(x2 + nx), round(y2 + ny)],
      [round(x2 - nx), round(y2 - ny)],
      [round(x1 - nx), round(y1 - ny)],
      [round(x1 + nx), round(y1 + ny)],
    ]);
  }
  return quads;
}

async function main() {
  const osm = await loadOsm(process.argv.includes('--refresh'));
  const els = osm.elements;

  // The Altstadt outline is the hull around the medieval city wall (the Roman fort in the west is excluded).
  const wallPoints = [];
  for (const el of els) {
    const t = el.tags ?? {};
    const isWall = t.barrier === 'city_wall' || t.historic === 'citywalls' || t.historic === 'city_gate';
    if (!isWall || !el.geometry || /porta/i.test(t.name ?? '')) continue;
    for (const p of el.geometry) if (p.lon > 10.9655) wallPoints.push([p.lon, p.lat]);
  }
  const altstadt = convexHull(wallPoints);
  altstadt.push(altstadt[0]);

  const features = [];
  const add = (layer, geometry, props = {}) => features.push({ type: 'Feature', geometry, properties: { l: layer, ...props } });

  for (const el of els) {
    const t = el.tags ?? {};

    if (t.building && t.building !== 'roof' && !t['building:part']) {
      for (const poly of polygonsOf(el)) {
        const inAltstadt = pointInRing(centroid(poly[0]), altstadt);
        let kind = inAltstadt ? 'old' : 'new';
        if (t.building === 'church' || t.historic === 'city_gate' || t.historic === 'citywalls' || LANDMARK_IDS.has(el.id)) kind = 'mark';
        if (el.type === 'way' && el.id === HOME_WAY_ID) kind = 'home';
        add('building', { type: 'Polygon', coordinates: poly }, { k: kind, h: Math.round(buildingHeight(t, el.id, inAltstadt) * 10) / 10 });
      }
      continue;
    }

    const land = LAND_CLASSES.find(([, test]) => test(t));
    if (land) {
      for (const poly of polygonsOf(el)) add('land', { type: 'Polygon', coordinates: poly }, { c: land[0] });
      continue;
    }

    if ((t.place === 'square' || (t.highway === 'pedestrian' && t.area === 'yes')) && el.type !== 'node') {
      for (const poly of polygonsOf(el)) add('plaza', { type: 'Polygon', coordinates: poly });
      continue;
    }

    if (el.type === 'way' && t.highway && t.area !== 'yes') {
      const c = roadClass(t.highway);
      if (c) add('road', { type: 'LineString', coordinates: toCoords(el.geometry) }, { c });
      continue;
    }

    if (el.type === 'way' && t.railway === 'rail') {
      add('rail', { type: 'LineString', coordinates: toCoords(el.geometry) });
      continue;
    }

    if (el.type === 'way' && ['river', 'stream', 'canal'].includes(t.waterway)) {
      add('waterway', { type: 'LineString', coordinates: toCoords(el.geometry) }, { c: t.waterway === 'river' ? 'river' : 'stream' });
      continue;
    }

    if (el.type === 'way' && t.barrier === 'city_wall') {
      for (const q of wallQuads(toCoords(el.geometry), 1.8)) add('wall', { type: 'Polygon', coordinates: [q] }, { h: 7 });
      continue;
    }

    if (el.type === 'node' && t.natural === 'tree') {
      const r = 2.2 + jitter(el.id) * 1.6;
      add('tree', { type: 'Polygon', coordinates: [octagon([el.lon, el.lat], r)] }, { h: Math.round((6 + jitter(el.id + 7) * 5) * 10) / 10 });
    }
  }

  // Draw order inside a layer type does not matter, but a stable order keeps diffs small.
  const order = ['land', 'plaza', 'waterway', 'road', 'rail', 'wall', 'building', 'tree'];
  features.sort((a, b) => order.indexOf(a.properties.l) - order.indexOf(b.properties.l));

  const out = {
    type: 'FeatureCollection',
    attribution: '© OpenStreetMap contributors (ODbL)',
    features,
  };
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(out));

  const counts = features.reduce((acc, f) => ((acc[f.properties.l] = (acc[f.properties.l] ?? 0) + 1), acc), {});
  console.log('Wrote', outFile, counts);

  await writePlan(features);
}

// ---------------------------------------------------------------------------
// Static, illustrated city plan for the "Lage" section (site/assets/img/altstadtplan.svg).
// Pin positions are printed as percentages so they can be placed as HTML on top of the image.

const PLAN = { west: 10.9566, east: 10.9772, north: 49.0344, south: 49.0266 };
const PLAN_PINS = {
  home: [10.97016, 49.031135],
  andreas: [10.97048, 49.03186],
  markt: [10.97195, 49.03055],
  ellinger: [10.9715, 49.03251],
  spital: [10.9708, 49.02987],
  karmeliter: [10.97345, 49.03116],
  bahnhof: [10.96563, 49.02957],
  seeweiher: [10.97514, 49.02817],
  kastell: [10.96234, 49.0308],
  thermen: [10.95862, 49.03059],
  parkhaus: [10.96975, 49.032961], // Parkhaus Doerfler-Villa (kostenlos)
};

async function writePlan(features) {
  const latC = (PLAN.north + PLAN.south) / 2;
  const kx = 111320 * Math.cos((latC * Math.PI) / 180);
  const ky = 110574;
  const width = Math.round((PLAN.east - PLAN.west) * kx);
  const height = Math.round((PLAN.north - PLAN.south) * ky);
  const px = ([lon, lat]) => [Math.round((lon - PLAN.west) * kx * 10) / 10, Math.round((PLAN.north - lat) * ky * 10) / 10];
  const inView = (coords) =>
    coords.some(([lon, lat]) => lon > PLAN.west - 0.002 && lon < PLAN.east + 0.002 && lat > PLAN.south - 0.002 && lat < PLAN.north + 0.002);
  const ringPath = (ring) => `M${ring.map((c) => px(c).join(' ')).join('L')}Z`;
  const linePath = (coords) => `M${coords.map((c) => px(c).join(' ')).join('L')}`;

  const groups = { farm: [], meadow: [], park: [], pitch: [], forest: [], water: [], plaza: [], waterway: [], major: [], minor: [], path: [], rail: [], wall: [], old: [], new: [], mark: [], home: [], tree: [] };
  for (const f of features) {
    const { l, c, k } = f.properties;
    const g = f.geometry;
    const outer = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates;
    if (!inView(outer)) continue;
    if (l === 'land') groups[c].push(g.coordinates.map(ringPath).join(''));
    else if (l === 'plaza') groups.plaza.push(g.coordinates.map(ringPath).join(''));
    else if (l === 'waterway') groups.waterway.push(linePath(g.coordinates));
    else if (l === 'road') groups[c].push(linePath(g.coordinates));
    else if (l === 'rail') groups.rail.push(linePath(g.coordinates));
    else if (l === 'wall') groups.wall.push(ringPath(g.coordinates[0]));
    else if (l === 'building') groups[k].push(g.coordinates.map(ringPath).join(''));
    else if (l === 'tree') {
      const ring = g.coordinates[0];
      const [cx, cy] = px(centroid(ring.slice(0, -1)));
      const r = Math.round(Math.hypot(...px(ring[0]).map((v, i) => v - [cx, cy][i])) * 10) / 10;
      groups.tree.push(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`);
    }
  }
  const p = (name, attrs) => (groups[name].length ? `<path ${attrs} d="${groups[name].join('')}"/>` : '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<title>Plan der Altstadt von Weißenburg in Bayern</title>
<defs><filter id="s" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="1.6" dy="2.2" stdDeviation="0" flood-color="#b98c68" flood-opacity=".55"/></filter></defs>
<rect width="100%" height="100%" fill="#f4ecdc"/>
${p('farm', 'fill="#eee5c9"')}${p('meadow', 'fill="#e2eac3"')}${p('park', 'fill="#d2e5b6"')}${p('pitch', 'fill="#cfe4b4"')}${p('forest', 'fill="#bcd7a2"')}${p('water', 'fill="#a9d6e4"')}
${p('waterway', 'fill="none" stroke="#a9d6e4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"')}
${p('plaza', 'fill="#fcf5ea"')}
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
${p('path', 'stroke="#fffaf2" stroke-width="2.2"')}
${p('minor', 'stroke="#e6d7bf" stroke-width="9"')}${p('major', 'stroke="#e6d7bf" stroke-width="15"')}
${p('minor', 'stroke="#fff" stroke-width="6.5"')}${p('major', 'stroke="#fff" stroke-width="12"')}
${p('rail', 'stroke="#c8b6a1" stroke-width="3" stroke-dasharray="9 6"')}
</g>
${p('wall', 'fill="#c99a70"')}
<g filter="url(#s)">${p('new', 'fill="#ebe0d2"')}${p('old', 'fill="#f7cdac"')}${p('mark', 'fill="#f3a679"')}${p('home', 'fill="#e4572e"')}</g>
<g fill="#9cc685" stroke="#86b170" stroke-width="1">${groups.tree.join('')}</g>
</svg>
`;
  const planFile = join(root, 'site/assets/img/altstadtplan.svg');
  await writeFile(planFile, svg);

  const pins = Object.fromEntries(
    Object.entries(PLAN_PINS).map(([key, c]) => {
      const [x, y] = px(c);
      return [key, { x: `${((x / width) * 100).toFixed(2)}%`, y: `${((y / height) * 100).toFixed(2)}%` }];
    }),
  );
  console.log('Wrote', planFile, `${width}x${height}`, `${Math.round(svg.length / 1024)} KB`);
  console.log('Plan pin positions:', pins);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
