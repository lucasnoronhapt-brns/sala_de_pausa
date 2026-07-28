"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./tv.css";

const POLL_INTERVAL_MS = 45_000;

function TikTokSlide({ item, active, cycle, cls, onEnded }) {
  const firedRef = useRef(false);

  // O iframe só é montado enquanto o slide está ativo, e a key={cycle}
  // remonta-o a cada volta: o autoplay dispara de novo mesmo quando a
  // playlist tem um único item.
  useEffect(() => {
    firedRef.current = false;
    if (!active) return;

    const advanceOnce = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      onEnded();
    };

    const handler = (event) => {
      const data = event.data;
      if (!data || !data["x-tiktok-player"]) return;
      if (data.type === "onStateChange" && data.value === 0) {
        // vídeo terminou
        advanceOnce();
      } else if (data.type === "onPlayerError") {
        // 3002 = AUTOPLAY_ERROR, 1001 = INVALID_VIDEO, 2001 = SERVER_ERROR
        console.error("TikTok player error:", data.value);
        advanceOnce();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [active, cycle, onEnded]);

  return (
    <div className={cls}>
      {active && (
        <iframe
          key={cycle}
          src={`https://www.tiktok.com/player/v1/${item.image_url}?autoplay=1&muted=1&controls=0&loop=0&rel=0&description=0`}
          title={item.title || "TikTok"}
          allow="autoplay; encrypted-media; fullscreen"
        />
      )}
    </div>
  );
}

function VideoSlide({ item, active, cycle, cls, onEnded }) {
  const ref = useRef(null);

  // Recomeça do zero quando o slide entra; pausa quando sai.
  // `cycle` cobre o caso da playlist com um único vídeo: cada volta
  // reinicia a reprodução mesmo sem mudança de slide.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active, cycle]);

  return (
    <div className={cls}>
      <video
        ref={ref}
        src={item.image_url}
        muted
        playsInline
        preload="auto"
        onEnded={active ? onEnded : undefined}
      />
    </div>
  );
}
const CACHE_KEY = "signage_playlist_v1";

// Fundos atribuídos automaticamente aos slides de texto,
// de forma estável (o mesmo item mantém sempre o mesmo fundo).
const GRADIENTS = [
  "linear-gradient(160deg, #1a2a6c, #b21f1f, #fdbb2d)",
  "linear-gradient(160deg, #0f2027, #203a43, #2c5364)",
  "linear-gradient(160deg, #42275a, #734b6d)",
  "linear-gradient(160deg, #134e5e, #71b280)",
  "linear-gradient(160deg, #2c3e50, #4ca1af)",
  "linear-gradient(160deg, #5f2c82, #49a09d)",
];

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function gradientFor(item) {
  return GRADIENTS[hashCode(item.id || "") % GRADIENTS.length];
}

// Auto-ajuste do tamanho da letra conforme o comprimento do texto
function titleClass(t) {
  return t && t.length > 40 ? "long" : "";
}
function bodyClass(t) {
  if (!t) return "";
  if (t.length > 280) return "xlong";
  if (t.length > 140) return "long";
  return "";
}

// Filtro de agendamento: item só aparece dentro da janela de datas
function isVisibleNow(item, now) {
  if (item.start_date && new Date(item.start_date) > now) return false;
  if (item.end_date && new Date(item.end_date) < now) return false;
  return true;
}

export default function TvPage() {
  const [items, setItems] = useState([]);
  const [current, setCurrent] = useState(0);
  // Incrementa a cada avanço; força a remontagem do player TikTok
  // mesmo quando a playlist só tem um item (senão o vídeo não repetia).
  const [cycle, setCycle] = useState(0);
  const [rot, setRot] = useState("270");
  const [debugOn, setDebugOn] = useState(false);
  const [clock, setClock] = useState("");
  const progressRef = useRef(null);

  // Rotação e debug via URL (?rot=90|270|0, ?debug=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("rot");
    if (["90", "270", "0"].includes(r)) setRot(r);
    setDebugOn(params.get("debug") === "1");
  }, []);

  // Polling à base de dados, com cache local como fallback
  useEffect(() => {
    let cancelled = false;

    async function load() {
      let all = null;
      if (supabase) {
        const { data, error } = await supabase
          .from("playlist_items")
          .select("*")
          .eq("active", true)
          .order("order_index", { ascending: true });
        if (!error && data) all = data;
      }

      if (all) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(all));
        } catch {}
      } else {
        // Sem rede ou sem config: usa a última playlist conhecida
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) all = JSON.parse(cached);
        } catch {}
      }

      if (!all || cancelled) return;

      const now = new Date();
      const visible = all.filter((it) => isVisibleNow(it, now));

      // Só re-renderiza se houver mesmo diferença (evita piscar)
      setItems((prev) =>
        JSON.stringify(prev) === JSON.stringify(visible) ? prev : visible
      );
    }

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Se a playlist encolher, garante que o índice continua válido
  useEffect(() => {
    if (items.length > 0 && current >= items.length) setCurrent(0);
  }, [items, current]);

  // Avanço automático de slide + barra de progresso
  useEffect(() => {
    if (items.length === 0) return;
    const item = items[current % items.length];
    const durationMs = (item.duration_seconds || 8) * 1000;

    const bar = progressRef.current;
    if (bar) {
      bar.classList.remove("animating");
      bar.style.width = "0%";
      bar.style.transitionDuration = "0s";
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          bar.classList.add("animating");
          bar.style.transitionDuration = durationMs + "ms";
          bar.style.width = "100%";
        })
      );
    }

    // Para vídeo, este timer é só um teto de segurança (se o vídeo
    // falhar ou encravar); normalmente o slide avança no onEnded.
    const id = setTimeout(advance, durationMs);
    return () => clearTimeout(id);
  }, [items, current, cycle]);

  const advance = () => {
    setCycle((n) => n + 1);
    setCurrent((c) => (c + 1) % (items.length || 1));
  };

  // Relógio (prova de vida)
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("pt-PT", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`rotate-wrapper rot-${rot}`}>
      {items.length === 0 ? (
        <div className="fallback">
          <h1>Sala de Pausa</h1>
          <p>
            {supabase
              ? "Sem conteúdo agendado de momento."
              : "Supabase não configurado (.env.local em falta)."}
          </p>
        </div>
      ) : (
        items.map((item, i) => (
          <Slide
            key={item.id}
            item={item}
            active={i === current % items.length}
            cycle={cycle}
            onVideoEnd={advance}
          />
        ))
      )}

      <div className="clock">{clock}</div>
      <div className="progress" ref={progressRef}></div>
      {debugOn && (
        <div className="debug">
          slide {items.length ? (current % items.length) + 1 : 0}/{items.length} | rot=
          {rot} | poll={POLL_INTERVAL_MS / 1000}s
        </div>
      )}
    </div>
  );
}

function Slide({ item, active, cycle, onVideoEnd }) {
  const cls = `slide tpl-${item.type} ${active ? "active" : ""}`;

  if (item.type === "video") {
    return (
      <VideoSlide item={item} active={active} cycle={cycle} cls={cls} onEnded={onVideoEnd} />
    );
  }

  if (item.type === "tiktok") {
    return (
      <TikTokSlide item={item} active={active} cycle={cycle} cls={cls} onEnded={onVideoEnd} />
    );
  }

  if (item.type === "webpage") {
    return (
      <div className={cls}>
        <iframe src={item.image_url} title={item.title || "webpage"} />
      </div>
    );
  }

  if (item.type === "image") {
    return (
      <div className={cls}>
        <img src={item.image_url} alt={item.title || ""} />
      </div>
    );
  }

  if (item.type === "image_text") {
    return (
      <div className={cls} style={{ background: gradientFor(item) }}>
        <div className="img-area">
          <img src={item.image_url} alt={item.title || ""} />
        </div>
        <div className="text-area">
          {item.title && <h1 className={titleClass(item.title)}>{item.title}</h1>}
          {item.body && <p className={bodyClass(item.body)}>{item.body}</p>}
        </div>
      </div>
    );
  }

  // type === "text"
  return (
    <div className={cls} style={{ background: gradientFor(item) }}>
      <div className="kicker">Sala de Pausa</div>
      {item.title && <h1 className={titleClass(item.title)}>{item.title}</h1>}
      {item.body && <p className={bodyClass(item.body)}>{item.body}</p>}
    </div>
  );
}
