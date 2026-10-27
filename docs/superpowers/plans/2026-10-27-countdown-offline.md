# Countdown with seconds and offline reload

**Goal:** Keep the mystery slide showing only accumulated hours, minutes and seconds, and keep it usable through network loss and reload after an initial connected visit.

**User requirements:** No explanatory text on the slide. Flip tiles. Date/time editable later. The TV regularly loses internet. Keep this work local, with no production playlist writes or publication.

**Architecture:** Retain the existing internal countdown URL and iframe playlist contract. Compute hours/minutes/seconds from Date.now in the browser. Prepare a public-screen-only service worker cache for exact TV/countdown navigation URLs and same-origin immutable Next assets. Register only in production on supported secure contexts. Prime the first page and all loaded/preloaded JS/CSS/fonts explicitly, as first-load requests happen before the worker controls the page. Acknowledge successful priming via a MessageChannel, with no visible TV text. Keep auth/API/external requests outside cache handling.

**Files:** `lib/countdown.mjs`; `app/countdown/FlipCountdown.js` and CSS; `lib/offline-screen.mjs`; `public/signage-sw.js`; `lib/tv-cache.mjs`; `app/tv/TvDisplay.js`; `next.config.mjs`; admin helper text; README; behavior tests.

- [x] Write and observe failing tests for accumulated hours/minutes/seconds, resume after suspension, offline HTML/assets, exact URL isolation, API bypass, immediate cached playlist and rotation.
- [x] Implement arithmetic, worker and cache helpers; run Node suite.
- [x] Wire countdown/TV preparation, reconnect retry, immediate cached playlist display and cached rotation.
- [x] Update form help and document initial preparation, HTTPS/localhost, production builds and device verification.
- [x] Build production and verify served HTML/assets/worker headers. `node scripts/verify-offline.mjs`: two public pages and 14 static assets recovered with simulated disconnected fetch; service worker response headers checked.
- [x] Independent review, resolve important findings and rerun affected checks. Reviewer reproduced an interrupted-deployment issue; HTML now commits only after all dependencies are cached and matching the client's deployment. Both regressions were observed failing before the fix and passing after it. Reviewer confirmed resolution and independently ran all eight worker tests.

**Checks:** `npm.cmd test`, `npm.cmd run build`; verify a countdown page and all initial static files can be primed and retrieved with a disconnected fetch implementation. Explicitly test that 503 does not replace a cached screen. Check the worker cannot serve another restaurant or a different countdown URL.

**Limits:** Storage/browser support and initial online preparation are required. External slides are not downloaded. Actual Fully Kiosk device reload remains a device-level check; do not claim it was tested from this Windows workspace.

Final verification: 36 Node tests pass; production build passes; smoke with two real served pages and 14 static assets passes with disconnected fetch. No publication, commits or live playlist writes performed.
