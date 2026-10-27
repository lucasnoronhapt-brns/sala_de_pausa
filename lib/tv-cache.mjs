function playlistKey(screenSlug) {
  return `signage_playlist_v1:${screenSlug || "all"}`;
}

export function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

export async function refreshPlaylist({ storage, screenSlug, onPlaylist, fetchPlaylist, now = Date.now() }) {
  const publish = (items) => {
    if (!Array.isArray(items)) return;
    onPlaylist(items.filter((item) => item && item.active !== false
      && (!item.start_date || new Date(item.start_date).getTime() <= now)
      && (!item.end_date || new Date(item.end_date).getTime() >= now)));
  };
  // Publish synchronously before any network wait: disconnected kiosks must not
  // sit on an empty screen until a database request eventually times out.
  try {
    publish(JSON.parse(storage.getItem(playlistKey(screenSlug))));
  } catch {}
  if (!fetchPlaylist) return;
  try {
    const items = await fetchPlaylist();
    if (!Array.isArray(items)) return;
    try { storage.setItem(playlistKey(screenSlug), JSON.stringify(items)); } catch {}
    publish(items);
  } catch {} // Keep the cached playlist on connection errors.
}

export function readRotation(storage, screenSlug) {
  try {
    const rotation = storage.getItem(`signage_rotation_v1:${screenSlug || "all"}`);
    return ["0", "90", "270"].includes(rotation) ? rotation : null;
  } catch { return null; }
}

export function saveRotation(storage, screenSlug, rotation) {
  if (!["0", "90", "270"].includes(String(rotation))) return;
  try { storage.setItem(`signage_rotation_v1:${screenSlug || "all"}`, String(rotation)); } catch {}
}
