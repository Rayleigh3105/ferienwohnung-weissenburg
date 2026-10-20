// Full-screen photo viewer for the gallery: swipe (scroll snapping), arrow keys and buttons.
// Without JavaScript every gallery tile is a plain link to the large photo.

export function initGallery(gallery) {
  const tiles = gallery ? [...gallery.querySelectorAll('[data-gallery-item]')] : [];
  if (!tiles.length || typeof HTMLDialogElement !== 'function') return;

  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', 'Fotos der Wohnung');
  dialog.innerHTML = `
    <div class="lightbox__track"></div>
    <p class="lightbox__counter" aria-live="polite"></p>
    <button class="lightbox__button lightbox__close" type="button" aria-label="Schließen"><svg class="icon"><use href="#i-close"/></svg></button>
    <button class="lightbox__button lightbox__prev" type="button" aria-label="Vorheriges Foto"><svg class="icon"><use href="#i-prev"/></svg></button>
    <button class="lightbox__button lightbox__next" type="button" aria-label="Nächstes Foto"><svg class="icon"><use href="#i-next"/></svg></button>`;
  const track = dialog.querySelector('.lightbox__track');
  // The viewer itself takes the focus when it opens: arrow keys work right away and no button
  // shows a focus ring after a tap. The scrolling track is swiped, not tabbed to.
  dialog.tabIndex = -1;
  track.tabIndex = -1;
  const counter = dialog.querySelector('.lightbox__counter');
  const prev = dialog.querySelector('.lightbox__prev');
  const next = dialog.querySelector('.lightbox__next');

  for (const tile of tiles) {
    const slide = document.createElement('figure');
    slide.className = 'lightbox__slide';
    const picture = tile.querySelector('picture').cloneNode(true);
    for (const el of picture.querySelectorAll('source, img')) el.setAttribute('sizes', '100vw');
    picture.querySelector('img').loading = 'lazy';
    const caption = document.createElement('figcaption');
    caption.textContent = tile.querySelector('img').alt;
    slide.append(picture, caption);
    track.append(slide);
  }
  document.body.append(dialog);

  let index = 0;
  let opener = null;
  const count = tiles.length;
  const render = () => {
    counter.textContent = `${index + 1} / ${count}`;
    prev.disabled = index === 0;
    next.disabled = index === count - 1;
  };
  const go = (i, behavior = 'smooth') => {
    index = Math.max(0, Math.min(count - 1, i));
    render();
    track.scrollTo({ left: index * track.clientWidth, behavior });
  };
  // After a swipe, pick up the photo the track snapped to once scrolling has settled.
  let settle = 0;
  track.addEventListener(
    'scroll',
    () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        index = Math.round(track.scrollLeft / track.clientWidth);
        render();
      }, 120);
    },
    { passive: true },
  );

  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  dialog.querySelector('.lightbox__close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault(); // the track would scroll a little on its own as well
    go(index + step);
  });
  // A tap next to the photo closes the viewer, like on most photo apps.
  track.addEventListener('click', (event) => {
    if (!event.target.closest('img')) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
  window.addEventListener('resize', () => dialog.open && go(index, 'auto'));

  tiles.forEach((tile, i) => {
    tile.addEventListener('click', (event) => {
      event.preventDefault();
      opener = tile;
      dialog.showModal();
      dialog.focus({ preventScroll: true });
      go(i, 'auto');
    });
  });
}
