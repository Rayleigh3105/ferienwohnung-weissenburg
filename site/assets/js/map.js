// The two 3D maps of the page, both drawn with MapLibre from the self-hosted OSM data:
// - the scroll-driven "Anflug" from a bird's-eye view of the Altstadt down to the house,
// - the close-up that shows the way from the front of the house to the apartment door.
// Neither map is interactive on purpose: on phones a map would swallow the page scroll.

const HOUSE = [10.97016, 49.031135];
const HOUSE_HEIGHT_M = 14;
const ALTSTADT_BOUNDS = [
  [10.9661, 49.0278],
  [10.9762, 49.0338],
];

const COLORS = {
  land: '#f4ecdc',
  farm: '#eee5c9',
  meadow: '#e2eac3',
  park: '#d2e5b6',
  forest: '#bcd7a2',
  pitch: '#cfe4b4',
  water: '#a9d6e4',
  plaza: '#fcf5ea',
  roadCasing: '#e6d7bf',
  road: '#ffffff',
  rail: '#c8b6a1',
  wall: '#d8ab83',
  home: '#e4572e',
  mark: '#f3a679',
  old: '#f7cdac',
  new: '#ebe0d2',
  tree: '#9cc685',
};

// Labels shown on the bird's-eye view. `minZoom` hides labels that would crowd the overview.
const LABELS = [
  { name: 'Marktplatz', at: [10.97195, 49.03055] },
  { name: 'Ellinger Tor', at: [10.9715, 49.03255] },
  { name: 'Spitaltor', at: [10.9708, 49.02987] },
  { name: 'Karmeliterkirche', at: [10.97345, 49.03116] },
  { name: 'Seeweiher', at: [10.97514, 49.02817] },
  { name: 'Römerkastell Biriciana', at: [10.96234, 49.0308] },
  { name: 'Römische Thermen', at: [10.95862, 49.03059] },
  { name: 'Bahnhof', at: [10.96563, 49.02957] },
];

const byLayer = (layer, extra) => (extra ? ['all', ['==', ['get', 'l'], layer], extra] : ['==', ['get', 'l'], layer]);
const landFill = (cls, color) => ({
  id: `land-${cls}`,
  type: 'fill',
  source: 'osm',
  filter: byLayer('land', ['==', ['get', 'c'], cls]),
  paint: { 'fill-color': color },
});
const zoomWidth = (pairs) => ['interpolate', ['exponential', 1.6], ['zoom'], ...pairs.flat()];
// Road width by zoom with separate values for major and minor roads ([zoom, major, minor] stops).
const roadWidth = (stops) =>
  ['interpolate', ['exponential', 1.6], ['zoom'], ...stops.flatMap(([z, major, minor]) => [z, ['match', ['get', 'c'], 'major', major, minor]])];

function createStyle(data) {
  return {
    version: 8,
    sources: {
      osm: { type: 'geojson', data, maxzoom: 16, tolerance: 0.2, buffer: 64 },
    },
    sky: {
      'sky-color': '#cfe7ef',
      'horizon-color': '#f7efe2',
      'fog-color': '#f6efe3',
      'sky-horizon-blend': 0.7,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.35,
      'atmosphere-blend': 0,
    },
    light: { anchor: 'viewport', color: '#fff6ea', intensity: 0.32, position: [1.2, 200, 35] },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': COLORS.land } },
      landFill('farm', COLORS.farm),
      landFill('meadow', COLORS.meadow),
      landFill('park', COLORS.park),
      landFill('pitch', COLORS.pitch),
      landFill('forest', COLORS.forest),
      landFill('water', COLORS.water),
      {
        id: 'waterway',
        type: 'line',
        source: 'osm',
        filter: byLayer('waterway'),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.water, 'line-width': zoomWidth([[13, 1], [18, 10]]) },
      },
      { id: 'plaza', type: 'fill', source: 'osm', filter: byLayer('plaza'), paint: { 'fill-color': COLORS.plaza } },
      {
        id: 'road-casing',
        type: 'line',
        source: 'osm',
        filter: byLayer('road', ['!=', ['get', 'c'], 'path']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLORS.roadCasing,
          'line-width': roadWidth([[13, 2.5, 1.2], [18, 26, 15]]),
        },
      },
      {
        id: 'path',
        type: 'line',
        source: 'osm',
        filter: byLayer('road', ['==', ['get', 'c'], 'path']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.road, 'line-opacity': 0.85, 'line-width': zoomWidth([[14, 0.6], [18, 4]]) },
      },
      {
        id: 'road',
        type: 'line',
        source: 'osm',
        filter: byLayer('road', ['!=', ['get', 'c'], 'path']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLORS.road,
          'line-width': roadWidth([[13, 1.5, 0.6], [18, 22, 12]]),
        },
      },
      {
        id: 'rail',
        type: 'line',
        source: 'osm',
        filter: byLayer('rail'),
        paint: { 'line-color': COLORS.rail, 'line-width': zoomWidth([[13, 1], [18, 4]]), 'line-dasharray': [2, 1.5] },
      },
      {
        id: 'wall',
        type: 'fill-extrusion',
        source: 'osm',
        filter: byLayer('wall'),
        paint: { 'fill-extrusion-color': COLORS.wall, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 1 },
      },
      {
        id: 'building',
        type: 'fill-extrusion',
        source: 'osm',
        filter: byLayer('building'),
        paint: {
          'fill-extrusion-color': ['match', ['get', 'k'], 'home', COLORS.home, 'mark', COLORS.mark, 'old', COLORS.old, COLORS.new],
          'fill-extrusion-height': ['get', 'h'],
          'fill-extrusion-opacity': 1,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'tree',
        type: 'fill-extrusion',
        source: 'osm',
        filter: byLayer('tree'),
        paint: { 'fill-extrusion-color': COLORS.tree, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 1.2 },
      },
    ],
  };
}

// The way to the apartment door in meters east/north of HOUSE: from the front door along the
// Pfarrgasse to the corner of the house, then into the alley behind it.
const DOOR_ROUTE_M = [[-3.5, 12], [-9.5, 12], [-11.4, 11.3], [-12.2, 9.6], [-12.3, 2], [-11.8, -3.4]];
const ALLEY_CORNER_M = [-12.2, 11];
const FLAT_DOOR_M = [-10.4, -3.4];

const metersToLngLat = ([x, y]) => [HOUSE[0] + x / (111320 * Math.cos((HOUSE[1] * Math.PI) / 180)), HOUSE[1] + y / 110574];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

function interpolateCamera(keyframes, p) {
  let i = 0;
  while (i < keyframes.length - 2 && p > keyframes[i + 1].p) i++;
  const a = keyframes[i];
  const b = keyframes[i + 1];
  const t = smooth(clamp01((p - a.p) / (b.p - a.p)));
  return {
    center: [lerp(a.center[0], b.center[0], t), lerp(a.center[1], b.center[1], t)],
    zoom: lerp(a.zoom, b.zoom, t),
    pitch: lerp(a.pitch, b.pitch, t),
    bearing: lerp(a.bearing, b.bearing, t),
    padding: Object.fromEntries(Object.keys(a.padding).map((side) => [side, lerp(a.padding[side], b.padding[side], t)])),
  };
}

function createPin() {
  const el = document.createElement('div');
  el.className = 'map-pin';
  el.innerHTML = `
    <span class="map-pin__label">Ihre Ferienwohnung</span>
    <svg class="map-pin__icon" viewBox="0 0 40 52" aria-hidden="true">
      <path d="M20 51c-1.2 0-17-17.7-17-30.5C3 10.8 10.6 3 20 3s17 7.8 17 17.5C37 33.3 21.2 51 20 51Z" />
      <path class="map-pin__house" d="M12.5 20.5 20 14l7.5 6.5V29a1 1 0 0 1-1 1h-4.2v-5.4h-4.6V30h-4.2a1 1 0 0 1-1-1v-8.5Z" />
    </svg>
    <span class="map-pin__pulse" aria-hidden="true"></span>`;
  return el;
}

// MapLibre controls the marker element's own opacity, so the label fades on an inner element.
function createLabel(name) {
  const el = document.createElement('div');
  el.className = 'map-label';
  const text = document.createElement('span');
  text.className = 'map-label__text';
  text.textContent = name;
  el.append(text);
  return el;
}

// MapLibre and the map data are loaded once and shared by both maps.
let resources = null;
function loadResources({ libUrl, dataUrl }) {
  resources ??= Promise.all([
    import(libUrl),
    fetch(dataUrl).then((r) => {
      if (!r.ok) throw new Error(`Map data: HTTP ${r.status}`);
      return r.json();
    }),
  ]);
  return resources;
}

/**
 * Loads MapLibre lazily and renders the map into `container`.
 * Resolves with a controller whose `setProgress(p)` moves the camera (p in [0, 1]).
 */
export async function createAltstadtMap(container, urls) {
  const [maplibre, data] = await loadResources(urls);

  const map = new maplibre.Map({
    container,
    style: createStyle(data),
    bounds: ALTSTADT_BOUNDS,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    maxPitch: 70,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    canvasContextAttributes: { antialias: true },
  });

  const pinEl = createPin();
  const pin = new maplibre.Marker({ element: pinEl, anchor: 'bottom', pitchAlignment: 'viewport', rotationAlignment: 'viewport' })
    .setLngLat(HOUSE)
    .addTo(map);

  const labels = LABELS.map((l) => ({
    ...l,
    el: createLabel(l.name),
  }));
  for (const l of labels) {
    new maplibre.Marker({ element: l.el, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat(l.at).addTo(map);
  }

  let keyframes = [];
  const computeKeyframes = () => {
    const vw = container.clientWidth;
    const vh = container.clientHeight;
    const portrait = vh > vw;
    // As a full-screen backdrop the camera first focuses next to the title (below it on phones,
    // right of it on wide screens). Close to the house it focuses on the upper part of the screen,
    // because the gallery slides up from below. The small static map needs no room for anything.
    const fullscreen = vh >= window.innerHeight * 0.9;
    const none = { top: 0, bottom: 0, left: 0, right: 0 };
    const besideTitle = !fullscreen ? none : portrait ? { ...none, top: vh * 0.36 } : { ...none, left: vw * 0.4 };
    const aboveGallery = !fullscreen ? none : { ...none, bottom: vh * (portrait ? 0.4 : 0.3) };
    map.setPadding(besideTitle);
    const overview = map.cameraForBounds(ALTSTADT_BOUNDS, {
      padding: portrait ? { top: vh * 0.12, bottom: vh * 0.06, left: 16, right: 16 } : { top: 70, bottom: 50, left: 20, right: 50 },
    });
    const start = [overview.center.lng, overview.center.lat];
    // Start a little further out than "fit", so the Altstadt shows up together with its surroundings.
    const zoom = Math.min(overview.zoom - 0.35, 16);
    // The scene scrolls 2 screen heights: approach (0 … 0.5), then the gallery slides over the map.
    keyframes = [
      { p: 0, center: start, zoom, pitch: 18, bearing: -6, padding: besideTitle },
      { p: 0.5, center: HOUSE, zoom: 17.4, pitch: 50, bearing: -28, padding: aboveGallery },
      { p: 1, center: HOUSE, zoom: 18.8, pitch: 58, bearing: -40, padding: aboveGallery },
    ];
  };

  let progress = 0;
  const apply = () => {
    if (!keyframes.length) return;
    const cam = interpolateCamera(keyframes, progress);
    map.jumpTo(cam);

    // Lift the pin from the ground to the roof of the house.
    const metersPerPixel = (40075016.686 * Math.cos((HOUSE[1] * Math.PI) / 180)) / (512 * 2 ** cam.zoom);
    const lift = (HOUSE_HEIGHT_M * Math.sin((cam.pitch * Math.PI) / 180)) / metersPerPixel;
    pin.setOffset([0, -lift]);

    // Hide labels that would be cut off at the edges or sit under the title.
    const { clientWidth: width, clientHeight: height } = container;
    const { top: freeTop, left: freeLeft } = map.getPadding();
    for (const l of labels) {
      const { x, y } = map.project(l.at);
      const halfLabel = l.el.offsetWidth / 2 + 8;
      const offscreen = x < Math.max(halfLabel, freeLeft) || x > width - halfLabel || y < freeTop + 20 || y > height - 48;
      const hidden = cam.zoom < (l.minZoom ?? 0) || cam.zoom > 18 || offscreen;
      l.el.classList.toggle('is-hidden', hidden);
    }
    pinEl.classList.toggle('is-near', cam.zoom > 16.8);
  };

  await new Promise((resolve) => map.once('load', resolve));
  computeKeyframes();
  apply();
  map.on('resize', () => {
    computeKeyframes();
    apply();
  });

  return {
    setProgress(p) {
      progress = clamp01(p);
      apply();
    },
    map,
  };
}

function createBadge(text, className) {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = text;
  return el;
}

/**
 * Close-up of the house with the way from the front door to the apartment door.
 * The dashed line moves along the way and the camera sways a little, but only while the map is
 * on screen and the visitor does not prefer reduced motion.
 */
export async function createDoorRouteMap(container, urls, { animate }) {
  const [maplibre, data] = await loadResources(urls);
  const route = DOOR_ROUTE_M.map(metersToLngLat);
  const style = createStyle(data);
  style.sources.route = { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: route } } };
  // Like a model: everything is drawn lower (the neighbours much lower), so nothing hides the
  // street and the alley, and the red house stays the landmark.
  for (const layer of style.layers) {
    if (layer.id === 'building') layer.paint['fill-extrusion-height'] = ['*', ['get', 'h'], ['case', ['==', ['get', 'k'], 'home'], 0.6, 0.3]];
    if (layer.id === 'tree' || layer.id === 'wall') layer.paint['fill-extrusion-height'] = ['*', ['get', 'h'], 0.4];
  }
  const beforeWall = style.layers.findIndex((l) => l.id === 'wall');
  style.layers.splice(
    beforeWall,
    0,
    {
      id: 'route-casing',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 15 },
    },
    {
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': COLORS.home, 'line-width': 7, 'line-dasharray': [0, 4, 3] },
    },
  );

  const bearing = 160;
  const zoomFor = () => (container.clientWidth < 600 ? 18.9 : 19.3);
  const map = new maplibre.Map({
    container,
    style,
    center: metersToLngLat([-7, 0]),
    zoom: zoomFor(),
    pitch: 42,
    bearing,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    canvasContextAttributes: { antialias: true },
  });

  // The labels sit next to the way (left of the start, right of the corner, beyond the door).
  const place = (el, at, anchor, offset) =>
    new maplibre.Marker({ element: el, anchor, offset, pitchAlignment: 'viewport', rotationAlignment: 'viewport' })
      .setLngLat(metersToLngLat(at))
      .addTo(map);
  place(createBadge('<b>1</b> Vorderseite', 'route-badge'), DOOR_ROUTE_M[0], 'right', [-6, 0]);
  place(createBadge('<b>2</b>', 'route-badge route-badge--round'), ALLEY_CORNER_M, 'left', [10, 0]);
  place(createBadge('<b>3</b> Ihre Tür', 'route-badge route-badge--door'), FLAT_DOOR_M, 'bottom', [0, -10]);

  await new Promise((resolve) => map.once('load', resolve));
  map.on('resize', () => map.setZoom(zoomFor()));
  if (!animate) return map;

  // "Marching ants": shift the dash pattern step by step, and sway the camera slowly.
  // Sequence from the MapLibre "animate a line" example: dash 3, gap 4, shifted by 0.5 per step.
  const dashes = [
    [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
    [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
  ];
  let visible = false;
  let raf = 0;
  let lastStep = -1;
  const frame = (now) => {
    const step = Math.floor(now / 50) % dashes.length;
    if (step !== lastStep) {
      map.setPaintProperty('route', 'line-dasharray', dashes[step]);
      lastStep = step;
    }
    map.setBearing(bearing + Math.sin(now / 3500) * 10);
    raf = visible ? requestAnimationFrame(frame) : 0;
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }).observe(container);
  return map;
}
