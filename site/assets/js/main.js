import { createAltstadtMap } from './map.js';
import { initGallery } from './gallery.js';

const root = document.documentElement;
const motion = root.classList.contains('motion');
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* ------------------------------------------------------------------ Scroll scenes */

const scenes = [...document.querySelectorAll('[data-scene]')].map((el) => ({ el, p: -1 }));
const anflug = document.querySelector('#anflug');
const reveal = document.querySelector('.scene--reveal');
let mapController = null;

function update() {
  const vh = window.innerHeight;
  for (const scene of scenes) {
    const rect = scene.el.getBoundingClientRect();
    const p = clamp01(-rect.top / Math.max(1, rect.height - vh));
    if (Math.abs(p - scene.p) < 0.00005) continue;
    scene.p = p;
    scene.el.style.setProperty('--p', p.toFixed(5));
    if (scene.el === anflug) {
      mapController?.setProgress(p);
      anflug.classList.toggle('past-hero', p > 0.14);
    }
    if (scene.el === reveal) reveal.classList.toggle('is-revealed', p * (Number(reveal.style.getPropertyValue('--len')) - 1) >= 1);
  }
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

/* ------------------------------------------------------------------ "Zur Wohnung": guided flight */

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
    guidedScrollTo(revealTop + window.innerHeight * 1.3, 5000);
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

/* ------------------------------------------------------------------ Galerie */

initGallery(document.querySelector('[data-gallery]'));

/* ------------------------------------------------------------------ Lage: center the plan on the house */

const plan = document.querySelector('[data-plan]');
if (plan && plan.scrollWidth > plan.clientWidth) {
  const home = plan.querySelector('.plan__pin--home');
  const x = parseFloat(home.style.getPropertyValue('--x')) / 100;
  plan.scrollLeft = x * plan.scrollWidth - plan.clientWidth / 2;
}
