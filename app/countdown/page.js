import { DEFAULT_COUNTDOWN } from "@/lib/countdown.mjs";
import FlipCountdown from "./FlipCountdown";

export const metadata = {
  title: "Cronómetro",
};

export default async function CountdownPage({ searchParams }) {
  const params = await searchParams;
  const setting = (key, fallback) => typeof params[key] === "string" ? params[key] : fallback;
  const config = {
    date: setting("date", DEFAULT_COUNTDOWN.date),
    time: setting("time", DEFAULT_COUNTDOWN.time),
    timeZone: setting("zone", DEFAULT_COUNTDOWN.timeZone),
    title: setting("title", DEFAULT_COUNTDOWN.title) || DEFAULT_COUNTDOWN.title,
    message: setting("message", DEFAULT_COUNTDOWN.message),
  };
  return <FlipCountdown config={config} />;
}
