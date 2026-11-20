// Sets the saved theme before the page paints. shared.js keeps this value up to date.
try {
  document.documentElement.dataset.theme = localStorage.getItem('theme') || 'system';
} catch {
  // Without the cached value, the page follows the system theme until shared.js loads the saved one.
}
