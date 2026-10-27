# Flip countdown implementation plan

Latest scope and verification are recorded in `2026-10-27-countdown-offline.md`:
the user subsequently requested minutes/seconds and offline reload support.

> **For agentic workers:** Use superpowers:executing-plans to implement this small change in this session. Steps use checkbox syntax for tracking.

**Goal:** An editable playlist slide counting down to the user's final McDonald's shift on 30 November 2026, with mechanical flip-clock tiles.

**Architecture:** Add an internal `/countdown` page. The admin offers a “Contagem regressiva” type but persists it as an existing `webpage` item whose relative URL contains its settings. Existing TV playback, restaurant permissions, scheduling and polling continue to apply, with no schema change. Recognize these URLs when editing existing items.

**Tech stack:** Existing Next.js 16 / React 19, CSS animation, native Intl and Node's test runner; no added dependencies.

**Spec:** User's approved description in chat: a slide between existing content, flipping tiles, editable date/time. Initial date 2026-11-30. Subsequent correction: show only the total remaining hours, without days, minutes or seconds. Partial hours round up until the target instant; an unknown exit time shows “-- horas” and “Hora de saída por confirmar”.

## Global constraints

- Latest user correction: the public slide shows only numeric flip tiles to preserve the mystery. No brand, title, date, unit label, message, status, loading text or visible error text. Missing/invalid settings show “--”; completion stays at “00”. Hide the TV's clock, progress and debug overlays during this slide. Admin retains configuration and validation messages; title is an admin-only name.
- Preserve existing user changes in `supabase/add_restaurants.sql`.
- Keep all changes local; no publishing, commits or live database writes.
- Default time zone Europe/London from client context; explicitly editable.
- Never invent an end-of-shift time. Unknown time shows “-- horas” and “Hora de saída por confirmar”. A provisional time can be entered and updated later.
- Use wall-clock time in the selected zone, accumulate hours across all days and clamp at zero. Round partial hours up to avoid premature completion.
- Mechanical clock palette: case #842b27, dark tiles #282725, ivory digits #fff4dd, brass details #dfb966, ink #171614. Centered content; condensed system display digits with tabular numerals. Red housing recalls a retro alarm clock and the restaurant's red/yellow palette. The flipping tiles are the main visual element.
- Support portrait and landscape TVs, smaller screens and reduced motion.

## Review focus

- A TV in another zone must count to the configured instant, with DST accounted for.
- A date without a time must not imply the shift ended at midnight on that date, or switch to a days display.
- Editing a saved countdown must recover the selected date/time/title and preserve duration, scheduling and restaurant.
- Empty/invalid URL settings must show a useful state, never NaN or a negative timer.
- Other webpage slides must retain their existing behavior.

### Task 1: Countdown settings and arithmetic

**Files:** `lib/countdown.mjs`, `tests/countdown.test.mjs`, `package.json`.

**Interfaces:** `DEFAULT_COUNTDOWN`; `getCountdownState(config, now)` returns `{phase, totalHours}`; `buildCountdownUrl(config)` returns an internal URL; `readCountdownUrl(url)` returns settings or null for unrelated URLs; `countdownForItem(item)` recognizes saved webpage items only.

- [ ] Write failing behavior tests for calendar-day counting, optional time, exact remaining units, zero/expired state, timezone/DST handling, invalid dates/times and URL round-trip/edit recognition.
- [ ] Run `node --test tests/countdown.test.mjs` and confirm expected failures.
- [ ] Implement the helpers, run `npm.cmd test`, confirm green.

### Task 2: Display and playlist editor

**Files:** `app/countdown/page.js`, `app/countdown/FlipCountdown.js`, `app/countdown/countdown.module.css`, `app/admin/page.js`, `app/admin/admin.css`, `README.md`.

**Consumes:** Task 1 interfaces.

- [ ] Add the countdown route using async Next.js searchParams and a client display that recalculates from Date.now every second.
- [ ] Make each changing digit animate as a hinged top/bottom tile; clean timers on unmount and honor reduced motion. Show the target date, optional personal message and a clear finished state.
- [ ] Add countdown fields to the existing admin form, a preview link, URL serialization on save, recognition on edit, and the correct label/icon in the playlist.
- [ ] Verify with unit tests, production build and browser checks of landscape, portrait, flipping, expiry, admin editing and a mixed playlist.
- [ ] Document adding/editing the slide. Review final diff and preserve pre-existing changes.

## Execution notes

Ruling: Execute in the existing shared checkout without git mutations or commits. This keeps the user's installed dependencies, environment and local changes available and makes the result immediately reviewable in their workspace.

Ruling: Save settings using the existing webpage contract, rather than introduce database columns. This avoids any migration or live database changes for this display feature.
