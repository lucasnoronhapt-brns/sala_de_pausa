export const DEFAULT_COUNTDOWN = {
  date: "2026-11-30",
  time: "",
  timeZone: "Europe/London",
  title: "Último dia no McDonald's",
  message: "",
};

const formatters = new Map();

function dateTimestamp(date) {
  const value = typeof date === "string" && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)
    ? Date.parse(`${date}T00:00:00Z`)
    : NaN;
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) {
    throw new Error("Indica uma data válida para o último dia.");
  }
  return value;
}

function zonedParts(timestamp, timeZone) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      });
    } catch {
      throw new Error("Escolhe um fuso horário válido.");
    }
    formatters.set(timeZone, formatter);
  }
  return Object.fromEntries(formatter.formatToParts(timestamp)
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]));
}

function targetTimestamp(dateMs, time, timeZone) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("Indica uma hora de saída válida.");
  }
  const [hour, minute] = time.split(":").map(Number);
  const wallTime = dateMs + hour * 3_600_000 + minute * 60_000;
  let candidate = wallTime;
  // Resolve wall-clock time in the selected IANA zone, not the device zone.
  // Checking the round-trip also rejects nonexistent times during a DST jump.
  for (let attempt = 0; attempt < 4; attempt++) {
    const p = zonedParts(candidate, timeZone);
    const observed = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    if (observed === wallTime) return candidate;
    candidate += wallTime - observed;
  }
  throw new Error("Esta hora não existe nesse dia devido à mudança de hora. Escolhe outra hora.");
}

export function getCountdownState(settings, now = Date.now()) {
  const { date, time, timeZone } = { ...DEFAULT_COUNTDOWN, ...settings };
  const dateMs = dateTimestamp(date);
  if (!Number.isFinite(now)) throw new Error("Não foi possível ler a hora atual.");
  zonedParts(now, timeZone); // Validate the zone even while the exit time is unknown.

  if (!time) {
    return { phase: "pending", totalHours: null, minutes: null, seconds: null };
  }

  const remaining = Math.max(0, Math.ceil((targetTimestamp(dateMs, time, timeZone) - now) / 1000));
  return {
    phase: remaining > 0 ? "counting" : "finished",
    totalHours: Math.floor(remaining / 3600),
    minutes: Math.floor(remaining / 60) % 60,
    seconds: remaining % 60,
  };
}

export function buildCountdownUrl(settings) {
  const config = { ...DEFAULT_COUNTDOWN, ...settings };
  getCountdownState(config); // Validate before saving or opening a preview.
  const params = new URLSearchParams({
    date: config.date, time: config.time, zone: config.timeZone,
    title: config.title.trim() || DEFAULT_COUNTDOWN.title, message: config.message,
  });
  return `/countdown?${params}`;
}

export function readCountdownUrl(url) {
  // Only our internal route is treated as an editable countdown. External
  // webpage slides, including ones called /countdown, keep their own behavior.
  if (typeof url !== "string" || !/^\/countdown(?:\?|$)/.test(url)) return null;
  const params = new URL(url, "https://signage.invalid").searchParams;
  return {
    date: params.get("date") ?? DEFAULT_COUNTDOWN.date,
    time: params.get("time") ?? DEFAULT_COUNTDOWN.time,
    timeZone: params.get("zone") ?? DEFAULT_COUNTDOWN.timeZone,
    title: params.get("title") || DEFAULT_COUNTDOWN.title,
    message: params.get("message") ?? DEFAULT_COUNTDOWN.message,
  };
}

export function countdownForItem(item) {
  return item.type === "webpage" ? readCountdownUrl(item.image_url) : null;
}
