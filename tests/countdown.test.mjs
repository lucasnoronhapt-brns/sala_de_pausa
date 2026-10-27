import test from "node:test";
import assert from "node:assert/strict";
import {
  getCountdownState,
  buildCountdownUrl,
  readCountdownUrl,
  countdownForItem,
} from "../lib/countdown.mjs";

const config = {
  date: "2026-11-30", time: "", timeZone: "Europe/London",
  title: "Último dia no McDonald's", message: "Até à próxima!",
};
test("unknown shift time waits for a time rather than displaying invented hours or days", () => {
  assert.deepEqual(getCountdownState(config, Date.parse("2026-10-27T23:59:00Z")), {
    phase: "pending", totalHours: null, minutes: null, seconds: null,
  });
});

test("hours accumulate across days instead of wrapping back to zero after 24", () => {
  assert.deepEqual(getCountdownState({ ...config, time: "18:30" }, Date.parse("2026-11-28T18:30:00Z")), {
    phase: "counting", totalHours: 48, minutes: 0, seconds: 0,
  });
});

test("remaining time uses accumulated hours with minutes and seconds", () => {
  assert.deepEqual(getCountdownState({ ...config, time: "18:30" }, Date.parse("2026-11-29T16:27:56Z")), {
    phase: "counting", totalHours: 26, minutes: 2, seconds: 4,
  });
});

test("entering the final hour does not finish the countdown an hour early", () => {
  assert.deepEqual(getCountdownState({ ...config, time: "18:30" }, Date.parse("2026-11-30T17:30:00Z")), {
    phase: "counting", totalHours: 1, minutes: 0, seconds: 0,
  });
});

test("the last fractional second stays positive until the target instant", () => {
  assert.deepEqual(getCountdownState({ ...config, time: "18:30" }, Date.parse("2026-11-30T18:29:59.900Z")), {
    phase: "counting", totalHours: 0, minutes: 0, seconds: 1,
  });
});

for (const now of ["2026-11-30T18:30:00Z", "2026-12-01T20:00:00Z"]) {
  test(`a finished countdown stays at zero at ${now}`, () => {
    assert.deepEqual(getCountdownState({ ...config, time: "18:30" }, Date.parse(now)), {
      phase: "finished", totalHours: 0, minutes: 0, seconds: 0,
    });
  });
}

test("a summer target uses London daylight saving, independently of the host clock", () => {
  assert.deepEqual(getCountdownState({ ...config, date: "2027-07-01", time: "18:00" }, Date.parse("2027-07-01T16:00:00Z")), {
    phase: "counting", totalHours: 1, minutes: 0, seconds: 0,
  });
});

test("a countdown across the autumn clock change counts the extra elapsed hour", () => {
  assert.deepEqual(getCountdownState({ ...config, date: "2026-10-25", time: "18:00" }, Date.parse("2026-10-24T17:00:00Z")), {
    phase: "counting", totalHours: 25, minutes: 0, seconds: 0,
  });
});

test("the displayed hour total follows the chosen zone even on a device in another zone", () => {
  assert.deepEqual(getCountdownState({ ...config, time: "18:30", timeZone: "America/Sao_Paulo" }, Date.parse("2026-11-30T18:30:00Z")), {
    phase: "counting", totalHours: 3, minutes: 0, seconds: 0,
  });
});

test("editing the exit time updates the total hours without changing the date", () => {
  const edited = readCountdownUrl(buildCountdownUrl({ ...config, time: "23:30" }));
  assert.deepEqual(getCountdownState(edited, Date.parse("2026-11-30T18:30:00Z")), {
    phase: "counting", totalHours: 5, minutes: 0, seconds: 0,
  });
});

test("a clock resumed after being suspended recalculates from wall time instead of losing ticks", () => {
  const saved = readCountdownUrl(buildCountdownUrl({ ...config, time: "18:30" }));
  assert.deepEqual(getCountdownState(saved, Date.parse("2026-11-30T17:30:01Z")), {
    phase: "counting", totalHours: 0, minutes: 59, seconds: 59,
  });
  assert.deepEqual(getCountdownState(saved, Date.parse("2026-11-30T17:32:05Z")), {
    phase: "counting", totalHours: 0, minutes: 57, seconds: 55,
  });
});

for (const invalid of [
  { date: "2026-02-30" }, { date: "" }, { time: "24:00" }, { time: "nonsense" },
  { timeZone: "Not/AZone" }, { date: "2027-03-28", time: "01:30" },
]) {
  test(`invalid settings are rejected: ${JSON.stringify(invalid)}`, () => {
    assert.throws(() => getCountdownState({ ...config, ...invalid }, Date.parse("2026-10-27T12:00:00Z")), /.+/);
  });
}

test("URL settings survive saving and editing including accents, punctuation and optional time", () => {
  const url = buildCountdownUrl(config);
  assert.equal(typeof url, "string");
  assert.match(url, /^\/countdown\?/);
  assert.deepEqual(readCountdownUrl(url), config);
  assert.deepEqual(readCountdownUrl(buildCountdownUrl({ ...config, time: "23:45" })), { ...config, time: "23:45" });
});

test("saved countdown webpage items are recognized when reopened for editing", () => {
  assert.deepEqual(countdownForItem({ type: "webpage", image_url: "/countdown?date=2026-11-30&time=18%3A30&zone=Europe%2FLondon&title=Adeus&message=Obrigado" }), {
    date: "2026-11-30", time: "18:30", timeZone: "Europe/London", title: "Adeus", message: "Obrigado",
  });
});

test("unrelated or external webpage slides are not mistaken for countdowns", () => {
  for (const url of ["https://example.com/countdown?date=2026-11-30", "/countdown-other", "//example.com/countdown", "javascript:alert(1)", null]) {
    assert.equal(readCountdownUrl(url), null);
  }
  assert.equal(countdownForItem({ type: "text", image_url: "/countdown?date=2026-11-30" }), null);
});

test("malformed saved countdowns can be recognized and corrected in the editor", () => {
  assert.deepEqual(readCountdownUrl("/countdown?date=bad&time=25%3A00&zone=Invalid"), {
    date: "bad", time: "25:00", timeZone: "Invalid", title: "Último dia no McDonald's", message: "",
  });
  assert.throws(() => buildCountdownUrl({ ...config, date: "bad" }));
});
