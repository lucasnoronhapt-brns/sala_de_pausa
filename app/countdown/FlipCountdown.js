"use client";

import { useEffect, useState } from "react";
import { getCountdownState } from "@/lib/countdown.mjs";
import { prepareOfflineScreen } from "@/lib/offline-screen.mjs";
import styles from "./countdown.module.css";

function FlipDigit({ value }) {
  const [digits, setDigits] = useState({ previous: value, current: value });
  if (digits.current !== value) {
    setDigits({ previous: digits.current, current: value });
  }

  return (
    <span className={styles.digit} aria-hidden="true">
      <span className={styles.top}><span>{digits.current}</span></span>
      <span className={styles.bottom}><span>{digits.current}</span></span>
      {digits.previous !== digits.current && (
        <span key={`${digits.previous}-${digits.current}`} className={styles.flaps}>
          <span className={`${styles.bottom} ${styles.oldBottom}`}><span>{digits.previous}</span></span>
          <span className={`${styles.top} ${styles.fallingTop}`}><span>{digits.previous}</span></span>
          <span className={`${styles.bottom} ${styles.fallingBottom}`}><span>{digits.current}</span></span>
        </span>
      )}
      <span className={styles.hinge} />
    </span>
  );
}

function FlipUnit({ value }) {
  return (
    <div className={styles.unit}>
      <div className={styles.digits}>
        {String(value).padStart(2, "0").split("").map((digit, i) => <FlipDigit key={i} value={digit} />)}
      </div>
    </div>
  );
}

export default function FlipCountdown({ config }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const prepare = () => { prepareOfflineScreen(); };
    tick();
    prepare();
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", prepare);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", prepare);
    };
  }, []);

  let state = null;
  if (now !== null) {
    try {
      state = getCountdownState(config, now);
    } catch {} // Invalid settings are explained in the admin, never on the TV.
  }

  const pending = state?.phase === "pending";
  const spokenTime = state ? pending ? "Cronómetro por configurar"
    : `${state.totalHours} horas, ${state.minutes} minutos e ${state.seconds} segundos` : "A carregar a contagem";
  const digitCount = Math.max(2, String(state?.totalHours ?? "--").length) + 4;

  return (
    <main lang="pt-PT" className={styles.scene} style={{ "--places": digitCount }}>
      <section className={styles.content} aria-label="Contagem regressiva">
        <div className={styles.clock} role="timer" aria-label={spokenTime} aria-live="off">
          <span className={styles.screws} aria-hidden="true" />
          <div className={styles.units} aria-hidden="true">
            <FlipUnit value={state?.totalHours ?? "--"} />
            <span className={styles.separator}>:</span>
            <FlipUnit value={state?.minutes ?? "--"} />
            <span className={styles.separator}>:</span>
            <FlipUnit value={state?.seconds ?? "--"} />
          </div>
        </div>
      </section>
    </main>
  );
}
