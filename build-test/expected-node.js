// dist/node.esm.js
var clamp = (low, high, number) => Math.max(Math.min(high, number), low);

// build-test/entrypoint-node.ts
console.info(clamp(1, 2, 5));
