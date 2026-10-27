// Run against a production server: node scripts/verify-offline.mjs
// Exercises the real worker with served HTML/assets and a disconnected fetch.
// This is an isolated cache simulation, not a replacement for the kiosk test.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const base = new URL(process.argv[2] || "http://127.0.0.1:3000");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Use a local production server");
const source = await readFile(new URL("../public/signage-sw.js", import.meta.url), "utf8");
const listeners = {};
const entries = new Map();
const cache = {
  async put(key, response) { entries.set(String(key), response.clone()); },
  async match(key) { return entries.get(String(key))?.clone(); },
};
let disconnected = false;
vm.runInNewContext(source, {
  self: {
    location: { origin: base.origin },
    addEventListener: (type, handler) => { listeners[type] = handler; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  },
  caches: { open: async () => cache, keys: async () => [], delete: async () => true },
  URL, Request, Response, AbortController, setTimeout, clearTimeout, Promise,
  fetch: (input, init) => disconnected ? Promise.reject(new Error("Disconnected")) : fetch(input, init),
});

async function prime(url) {
  const html = await (await fetch(url)).text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+)"/g)]
    .map((match) => new URL(match[1].replaceAll("&amp;", "&"), base).href))];
  assert.ok(assets.some((url) => url.endsWith(".js")), "Page references JavaScript");
  assert.ok(assets.some((url) => url.endsWith(".css")), "Page references styles");
  let work;
  let ready;
  listeners.message({
    data: { type: "CACHE_SCREEN", url, assets }, source: { url },
    ports: [{ postMessage: (result) => { ready = result.ok; } }],
    waitUntil: (promise) => { work = promise; },
  });
  await work;
  assert.equal(ready, true, "Every initial asset was prepared");
  return { url, assets };
}

async function request(url, mode = "navigate") {
  let response;
  listeners.fetch({ request: { url, method: "GET", mode }, respondWith: (value) => { response = value; } });
  return response;
}

const workerResponse = await fetch(new URL("/signage-sw.js", base));
assert.equal(workerResponse.status, 200);
assert.match(workerResponse.headers.get("Cache-Control"), /no-cache/);
assert.equal(workerResponse.headers.get("Service-Worker-Allowed"), "/");
assert.match(workerResponse.headers.get("Content-Type"), /javascript/);

const screens = [
  await prime(new URL("/countdown?date=2026-11-30&time=18%3A00&zone=Europe%2FLondon", base).href),
  await prime(new URL("/tv/offline-verification?rot=270", base).href),
];
disconnected = true;
for (const screen of screens) {
  const page = await request(screen.url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<html/);
  for (const asset of screen.assets) {
    const response = await request(asset, "cors");
    assert.equal(response.status, 200, `Offline asset: ${new URL(asset).pathname}`);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
}
assert.equal((await request(new URL("/tv/never-prepared", base).href)).status, 0);
console.log(`Offline smoke check passed: ${screens.length} public pages and ${entries.size - screens.length} static assets; disconnected navigation and assets restored. Worker headers verified.`);
