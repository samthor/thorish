// dist/browser/entrypoint.js
var clamp = (low, high, number) => Math.max(Math.min(high, number), low);

// build-test/entrypoint-browser.ts
console.info(clamp(1, 2, 5));
