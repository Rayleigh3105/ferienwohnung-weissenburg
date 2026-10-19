// Runs before the first paint: switches on the scroll-driven layout, unless the visitor
// prefers reduced motion or the browser cannot run the main module.
if ('noModule' in HTMLScriptElement.prototype && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('motion');
}
