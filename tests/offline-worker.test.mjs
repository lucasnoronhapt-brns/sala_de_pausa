import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const workerSource = await readFile(new URL("../public/signage-sw.js", import.meta.url), "utf8").catch(() => "");
const origin = "https://signage.test";

function harness() {
  const listeners = {};
  const stores = new Map();
  const requests = [];
  const responses = new Map();
  const blocked = new Set();
  let offline = false;
  let status = 200;
  const keyFor = (request) => new URL(typeof request === "string" ? request : request.url, origin).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async put(request, response) { entries.set(keyFor(request), response.clone()); },
        async match(request) { return entries.get(keyFor(request))?.clone(); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  vm.runInNewContext(workerSource, {
    self: {
      location: { origin }, addEventListener: (name, listener) => { listeners[name] = listener; },
      skipWaiting: async () => {}, clients: { claim: async () => {} },
    },
    caches, URL, Request, Response, AbortController, setTimeout, clearTimeout, Promise,
    fetch: async (input) => {
      const url = keyFor(input);
      requests.push(url);
      if (offline || blocked.has(url)) throw new Error("Network disconnected");
      return new Response(responses.get(url) ?? `cached:${url}`, { status, headers: { "Content-Type": new URL(url).pathname.startsWith("/_next/static/") ? "text/javascript" : "text/html" } });
    },
  });
  return {
    listeners, caches, stores, requests,
    goOffline() { offline = true; }, failServer() { status = 503; },
    serve(url, body) { responses.set(url, body); },
    block(url) { blocked.add(url); },
    async prime(url, assets) {
      assert.equal(typeof listeners.message, "function", "worker handles initial cache preparation");
      let work;
      let result;
      listeners.message({ data: { type: "CACHE_SCREEN", url, assets }, source: { url }, ports: [{ postMessage: (message) => { result = message; } }], waitUntil: (promise) => { work = promise; } });
      await work;
      return result;
    },
    async request(url, mode = "navigate") {
      assert.equal(typeof listeners.fetch, "function", "worker handles offline requests");
      let response;
      listeners.fetch({ request: { url, method: "GET", mode }, respondWith: (promise) => { response = promise; }, waitUntil() {} });
      return response;
    },
  };
}

test("a first connected visit prepares the exact countdown page and its assets for offline reload", async () => {
  const worker = harness();
  const url = `${origin}/countdown?date=2026-11-30&time=18%3A00&zone=Europe%2FLondon`;
  const asset = `${origin}/_next/static/chunks/clock.js`;
  assert.deepEqual(JSON.parse(JSON.stringify(await worker.prime(url, [asset]))), { ok: true });
  worker.goOffline();
  assert.equal(await (await worker.request(url)).text(), `cached:${url}`);
  assert.equal(await (await worker.request(asset, "cors")).text(), `cached:${asset}`);
});

test("TV reload uses its own cached page, including its rotation URL", async () => {
  const worker = harness();
  const url = `${origin}/tv/loja-a?rot=270`;
  await worker.prime(url, []);
  worker.goOffline();
  assert.equal(await (await worker.request(url)).text(), `cached:${url}`);
});

test("a server error falls back to the cached screen instead of replacing it with an error page", async () => {
  const worker = harness();
  const url = `${origin}/tv/loja-a`;
  await worker.prime(url, []);
  worker.failServer();
  assert.equal(await (await worker.request(url)).text(), `cached:${url}`);
});

test("cached countdown settings are never mixed between different URLs", async () => {
  const worker = harness();
  const one = `${origin}/countdown?date=2026-11-30&time=18%3A00`;
  const two = `${origin}/countdown?date=2026-11-30&time=23%3A00`;
  await worker.prime(one, []);
  await worker.prime(two, []);
  worker.goOffline();
  assert.equal(await (await worker.request(one)).text(), `cached:${one}`);
  assert.equal(await (await worker.request(two)).text(), `cached:${two}`);
});

test("admin, APIs, external content and non-GET requests bypass the offline cache", async () => {
  const worker = harness();
  for (const url of [`${origin}/admin`, `${origin}/api/private`, `${origin}/tv-other`, "https://database.test/rest/v1/playlist_items"]) {
    assert.equal(await worker.request(url), undefined);
  }
  let intercepted = false;
  worker.listeners.fetch({ request: { url: `${origin}/tv`, method: "POST", mode: "navigate" }, respondWith() { intercepted = true; } });
  assert.equal(intercepted, false);
  const result = await worker.prime(`${origin}/admin`, [`${origin}/api/private`, "https://example.com/script.js"]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: false });
  assert.deepEqual(worker.requests, []);
});

test("initial preparation only caches same-origin static files, never supplied API or external URLs", async () => {
  const worker = harness();
  const url = `${origin}/tv`;
  const asset = `${origin}/_next/static/chunks/player.css`;
  await worker.prime(url, [asset, `${origin}/api/private`, "https://example.com/a.js"]);
  assert.deepEqual(worker.requests.sort(), [url, asset].sort());
});

test("an interrupted deployment upgrade preserves the last complete offline page and scripts", async () => {
  const worker = harness();
  const url = `${origin}/tv/loja-a`;
  const a = `${origin}/_next/static/chunks/build-a.js`;
  const b = `${origin}/_next/static/chunks/build-b.js`;
  const htmlA = '<html><script src="/_next/static/chunks/build-a.js"></script></html>';
  const htmlB = '<html><script src="/_next/static/chunks/build-b.js"></script></html>';
  worker.serve(url, htmlA);
  await worker.prime(url, [a]);
  worker.serve(url, htmlB);
  assert.equal(await (await worker.request(url)).text(), htmlB);
  worker.block(b);
  assert.equal((await worker.prime(url, [b])).ok, false);
  worker.goOffline();
  assert.equal(await (await worker.request(url)).text(), htmlA);
  assert.equal(await (await worker.request(a, "cors")).text(), `cached:${a}`);
});

test("a deployment racing with preparation cannot pair new HTML with the previous build's assets", async () => {
  const worker = harness();
  const url = `${origin}/countdown?time=18%3A00`;
  const a = `${origin}/_next/static/chunks/build-a.js`;
  const b = `${origin}/_next/static/chunks/build-b.js`;
  const htmlA = '<html><script src="/_next/static/chunks/build-a.js"></script></html>';
  worker.serve(url, htmlA);
  await worker.prime(url, [a]);
  worker.serve(url, '<html><script src="/_next/static/chunks/build-b.js"></script></html>');
  assert.equal((await worker.prime(url, [a])).ok, false);
  worker.goOffline();
  assert.equal(await (await worker.request(url)).text(), htmlA);
  assert.equal((await worker.request(b, "cors")).status, 0);
});
