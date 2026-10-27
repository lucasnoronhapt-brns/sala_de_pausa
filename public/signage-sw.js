/* Public TV/countdown shell only. Auth, database calls and external media pass through. */
const SCREEN_CACHE = "signage-screens-v1";
const NETWORK_TIMEOUT_MS = 3000;

function screenUrl(url) {
  return url.origin === self.location.origin &&
    (url.pathname === "/countdown" || /^\/tv(?:\/[^/]+)?\/?$/.test(url.pathname));
}

function staticUrl(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

async function fetchBounded(request) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      fetch(request, { signal: controller.signal }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Screen network timeout"));
        }, NETWORK_TIMEOUT_MS);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

async function cacheResource(url, page = false) {
  const cache = await caches.open(SCREEN_CACHE);
  const existing = await cache.match(url);
  if (!page && existing) return existing;
  try {
    const request = new Request(url, {
      credentials: "omit", cache: "reload",
      ...(page ? { headers: { Accept: "text/html" } } : {}),
    });
    const response = await fetchBounded(request);
    if (!response.ok || response.redirected || (page && !response.headers.get("Content-Type")?.includes("text/html"))) {
      throw new Error("Screen unavailable");
    }
    // HTML is committed only by CACHE_SCREEN, after its dependencies are ready.
    // A successful navigation alone must not replace a working offline page.
    if (!page) await cache.put(url, response.clone());
    return response;
  } catch (error) {
    if (existing) return existing;
    throw error;
  }
}

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("signage-screens-") && name !== SCREEN_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_SCREEN") return;
  event.waitUntil((async () => {
    try {
      const url = new URL(event.data.url);
      const source = new URL(event.source.url);
      if (!screenUrl(url) || !screenUrl(source) || url.href !== source.href) throw new Error("Not a screen");
      const assets = [...new Set((event.data.assets || []).filter((asset) => {
        try { return staticUrl(new URL(asset)); } catch { return false; }
      }))];
      const page = await cacheResource(url.href, true);
      const html = await page.clone().text();
      const clientAssets = new Set(assets);
      const references = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
        .map((match) => new URL(match[1].replace(/&amp;/g, "&"), url));
      // The deployment may change between rendering and priming. In that case
      // retain the last complete page, rather than mix different builds.
      if (references.some((asset) => staticUrl(asset) && !clientAssets.has(asset.href))) {
        throw new Error("Screen deployment changed during preparation");
      }
      await Promise.all(assets.map((asset) => cacheResource(asset)));
      const cache = await caches.open(SCREEN_CACHE);
      await cache.put(url.href, page.clone());
      event.ports?.[0]?.postMessage({ ok: true });
    } catch {
      event.ports?.[0]?.postMessage({ ok: false });
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (staticUrl(url)) {
    event.respondWith(cacheResource(url.href).catch(() => Response.error()));
  } else if (request.mode === "navigate" && screenUrl(url)) {
    // Keep the full URL: each countdown's date/time and each restaurant are
    // separate entries. An offline screen can never inherit another one's HTML.
    event.respondWith(cacheResource(url.href, true).catch(() => Response.error()));
  }
});
