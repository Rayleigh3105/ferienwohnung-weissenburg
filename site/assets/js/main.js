import { createAltstadtMap } from './map.js';

const root = document.documentElement;
const motion = root.classList.contains('motion');
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* ------------------------------------------------------------------ Scroll scenes */

const scenes = [...document.querySelectorAll('[data-scene]')].map((el) => ({ el, p: -1 }));
const anflug = document.querySelector('#anflug');
const reveal = document.querySelector('.scene--reveal');
const sheet = document.querySelector('#ausstattung');
const header = document.querySelector('[data-header]');
const roomName = header.querySelector('[data-room-name]');
const roomDots = [...header.querySelectorAll('[data-room-dot]')];
let mapController = null;
let currentRoom = null;

function setRoom(sceneEl) {
  if (sceneEl === currentRoom) return;
  currentRoom = sceneEl;
  header.classList.toggle('is-touring', Boolean(sceneEl));
  if (!sceneEl) return;
  const room = Number(sceneEl.dataset.room);
  roomName.textContent = sceneEl.dataset.roomName;
  for (const dot of roomDots) {
    const n = Number(dot.dataset.roomDot);
    dot.classList.toggle('is-done', n < room);
    dot.classList.toggle('is-current', n === room);
  }
}

function update() {
  const vh = window.innerHeight;
  let room = null;

  for (const scene of scenes) {
    const rect = scene.el.getBoundingClientRect();
    const p = clamp01(-rect.top / Math.max(1, rect.height - vh));
    if (Math.abs(p - scene.p) > 0.00005) {
      scene.p = p;
      scene.el.style.setProperty('--p', p.toFixed(5));
      if (scene.el === anflug) {
        mapController?.setProgress(p);
        anflug.classList.toggle('past-hero', p > 0.14);
      }
      if (scene.el === reveal) reveal.classList.toggle('is-revealed', p * (Number(reveal.style.getPropertyValue('--len')) - 1) >= 1);
    }

    if (scene.el.dataset.room) {
      const threshold = scene.el === reveal ? -0.7 * vh : 0.4 * vh;
      if (rect.top <= threshold && rect.bottom > 0.4 * vh) room = scene.el;
    }
  }

  if (sheet.getBoundingClientRect().top < 0.5 * vh) room = null;
  setRoom(room);
}

let frame = 0;
const requestUpdate = () => {
  if (!frame) frame = requestAnimationFrame(() => {
    frame = 0;
    update();
  });
};

if (motion) {
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  update();
}

/* ------------------------------------------------------------------ Map */

createAltstadtMap(anflug.querySelector('[data-map]'), {
  dataUrl: new URL('../data/altstadt.json', import.meta.url).href,
  libUrl: new URL('../vendor/maplibre-gl/maplibre-gl.mjs', import.meta.url).href,
})
  .then((controller) => {
    mapController = controller;
    controller.setProgress(motion ? scenes[0].p : 0.5);
    anflug.classList.add('is-ready');
  })
  .catch((error) => {
    console.warn('Karte konnte nicht geladen werden:', error);
    anflug.classList.add('no-map');
  });

/* ------------------------------------------------------------------ "Rundgang starten": guided flight */

function guidedScrollTo(targetY, duration) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const start = performance.now();
  let raf = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    for (const type of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.removeEventListener(type, stop);
  };
  for (const type of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.addEventListener(type, stop, { passive: true });

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const step = (now) => {
    const t = clamp01((now - start) / duration);
    window.scrollTo(0, startY + distance * ease(t));
    if (t < 1) raf = requestAnimationFrame(step);
    else stop();
  };
  raf = requestAnimationFrame(step);
}

for (const link of document.querySelectorAll('[data-autoplay]')) {
  link.addEventListener('click', (event) => {
    if (!motion) return;
    event.preventDefault();
    const revealTop = reveal.getBoundingClientRect().top + window.scrollY;
    guidedScrollTo(revealTop + window.innerHeight * 1.35, 7000);
  });
}

// In-page links to far away sections jump smoothly without stepping through every scene animation.
for (const link of document.querySelectorAll('a[href^="#"]:not([data-autoplay])')) {
  const target = link.hash.length > 1 && document.querySelector(link.hash);
  if (!target) continue;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    target.scrollIntoView({ behavior: motion ? 'smooth' : 'auto' });
    history.replaceState(null, '', link.hash);
  });
}

/* ------------------------------------------------------------------ Lage: center the plan on the house */

const plan = document.querySelector('[data-plan]');
if (plan && plan.scrollWidth > plan.clientWidth) {
  const home = plan.querySelector('.plan__pin--home');
  const x = parseFloat(home.style.getPropertyValue('--x')) / 100;
  plan.scrollLeft = x * plan.scrollWidth - plan.clientWidth / 2;
}
