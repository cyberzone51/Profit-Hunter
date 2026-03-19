const originalFetch = window.fetch;
Object.defineProperty(window, 'fetch', {
  value: originalFetch,
  writable: true,
  configurable: true,
});
