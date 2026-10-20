// Runs before the first paint. `js`: the main module will run (parts that need it may show).
// `motion`: the scroll-driven layout, unless the visitor prefers reduced motion.
if ('noModule' in HTMLScriptElement.prototype) {
  document.documentElement.classList.add('js');
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('motion');
}
