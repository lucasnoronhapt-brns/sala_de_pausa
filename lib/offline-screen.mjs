let preparation;

export function prepareOfflineScreen() {
  if (preparation) return preparation;
  preparation = prepare().catch(() => false).then((ok) => {
    if (!ok) preparation = undefined;
    return ok;
  });
  return preparation;
}

async function prepare() {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return false;
  // Development bundles/HMR are not stable offline assets. Test with npm run build
  // followed by npm start (or on the HTTPS deployment).
  if (process.env.NODE_ENV !== "production") return false;
  if (document.readyState !== "complete") {
    await new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        window.removeEventListener("load", finish);
        resolve();
      };
      const timer = setTimeout(finish, 3000);
      window.addEventListener("load", finish, { once: true });
    });
  }
  await navigator.serviceWorker.register("/signage-sw.js", { scope: "/", updateViaCache: "none" });
  const registration = await navigator.serviceWorker.ready;
  const assets = [...new Set([
    ...performance.getEntriesByType("resource").map((entry) => entry.name),
    ...Array.from(document.querySelectorAll("script[src], link[href]"), (node) => node.src || node.href),
  ])].filter((asset) => {
    try {
      const url = new URL(asset, location.href);
      return url.origin === location.origin && url.pathname.startsWith("/_next/static/");
    } catch { return false; }
  });
  const ok = await new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); resolve(false); }, 15000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data?.ok === true);
    };
    registration.active.postMessage({ type: "CACHE_SCREEN", url: location.href, assets }, [channel.port2]);
  });
  document.documentElement.dataset.offlineReady = String(ok);
  return ok;
}
