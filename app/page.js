import Link from "next/link";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 40, maxWidth: 480, margin: "0 auto" }}>
      <h1>Sinalização Digital — Sala de Pausa</h1>
      <ul style={{ lineHeight: 2.2, fontSize: "1.1rem" }}>
        <li>
          <Link href="/tv">/tv</Link> — display para a televisão
        </li>
        <li>
          <Link href="/admin">/admin</Link> — gestão da playlist
        </li>
      </ul>
    </main>
  );
}
