import test from "node:test";
import assert from "node:assert/strict";
import { refreshPlaylist, readRotation, saveRotation } from "../lib/tv-cache.mjs";

function storageWith(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
const countdown = { id: "clock", type: "webpage", active: true, restaurant_slug: "loja-a", image_url: "/countdown?date=2026-11-30&time=18%3A00" };

test("saved playlist is displayed immediately even while the server never responds", async () => {
  const storage = storageWith({ "signage_playlist_v1:loja-a": JSON.stringify([countdown]) });
  const shown = [];
  let finishNetwork;
  const done = refreshPlaylist({
    storage, screenSlug: "loja-a", onPlaylist: (items) => shown.push(items),
    fetchPlaylist: () => new Promise((resolve) => { finishNetwork = resolve; }),
  });
  assert.deepEqual(shown, [[countdown]]);
  finishNetwork([]);
  await done;
  assert.deepEqual(shown, [[countdown], []]);
  assert.equal(storage.getItem("signage_playlist_v1:loja-a"), "[]");
});

test("a network error leaves the cached countdown available", async () => {
  const shown = [];
  await refreshPlaylist({
    storage: storageWith({ "signage_playlist_v1:loja-a": JSON.stringify([countdown]) }),
    screenSlug: "loja-a", onPlaylist: (items) => shown.push(items),
    fetchPlaylist: async () => { throw new Error("Offline"); },
  });
  assert.deepEqual(shown, [[countdown]]);
});

test("cached items remain separated by restaurant and corrupted storage can recover online", async () => {
  const shown = [];
  const storage = storageWith({ "signage_playlist_v1:loja-a": JSON.stringify([countdown]), "signage_playlist_v1:loja-b": "broken" });
  await refreshPlaylist({ storage, screenSlug: "loja-b", onPlaylist: (items) => shown.push(items), fetchPlaylist: async () => [] });
  assert.deepEqual(shown, [[]]);
});

test("disabled and expired items are not revived by offline cache", async () => {
  const shown = [];
  const stored = [countdown, { ...countdown, id: "off", active: false }, { ...countdown, id: "old", end_date: "2026-10-01T00:00:00Z" }, { ...countdown, id: "future", start_date: "2026-12-01T00:00:00Z" }];
  await refreshPlaylist({
    storage: storageWith({ "signage_playlist_v1:loja-a": JSON.stringify(stored) }), screenSlug: "loja-a",
    onPlaylist: (items) => shown.push(items), now: Date.parse("2026-10-27T12:00:00Z"),
  });
  assert.deepEqual(shown, [[countdown]]);
});

test("rotation survives an offline restart and never leaks between restaurants", () => {
  const storage = storageWith();
  saveRotation(storage, "loja-a", 270);
  assert.equal(readRotation(storage, "loja-a"), "270");
  assert.equal(readRotation(storage, "loja-b"), null);
  saveRotation(storage, "loja-b", 0);
  assert.equal(readRotation(storage, "loja-b"), "0");
});

test("unavailable browser storage does not stop online playback", async () => {
  const storage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); } };
  const shown = [];
  await refreshPlaylist({ storage, screenSlug: "loja-a", onPlaylist: (items) => shown.push(items), fetchPlaylist: async () => [countdown] });
  assert.deepEqual(shown, [[countdown]]);
  assert.equal(readRotation(storage, "loja-a"), null);
  assert.doesNotThrow(() => saveRotation(storage, "loja-a", 270));
});
