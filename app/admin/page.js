"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./admin.css";

const EMPTY_FORM = {
  type: "text",
  title: "",
  body: "",
  url: "",
  duration_seconds: 8,
  start_date: "",
  end_date: "",
};

const TYPE_LABELS = {
  text: "Texto",
  image: "Imagem",
  image_text: "Imagem + texto",
  video: "Vídeo",
  webpage: "Página web",
};

function needsFile(type) {
  return ["image", "image_text", "video"].includes(type);
}
function needsText(type) {
  return ["text", "image_text"].includes(type);
}

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabase) {
    return (
      <div className="admin">
        <h1>Admin</h1>
        <div className="msg error">
          Supabase não configurado — copia <code>.env.local.example</code> para{" "}
          <code>.env.local</code> e preenche as chaves.
        </div>
      </div>
    );
  }

  if (!ready) return <div className="admin">A carregar…</div>;
  return session ? <Manager session={session} /> : <Login />;
}

// ═══════════════════════════════════════════════════════════
// Login
// ═══════════════════════════════════════════════════════════
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Login falhou: " + error.message);
    setBusy(false);
  }

  return (
    <div className="admin">
      <h1>Sala de Pausa — Admin</h1>
      <form className="card" onSubmit={handleLogin}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="msg error">{error}</div>}
        <button className="btn" disabled={busy}>
          {busy ? "A entrar…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Gestor da playlist
// ═══════════════════════════════════════════════════════════
function Manager({ session }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function loadItems() {
    const { data, error } = await supabase
      .from("playlist_items")
      .select("*")
      .order("order_index", { ascending: true });
    if (error) setMsg({ type: "error", text: error.message });
    else setItems(data);
  }

  useEffect(() => {
    loadItems();
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Ao escolher um vídeo, lê a duração e preenche o campo automaticamente
  function handleFileChange(f) {
    setFile(f);
    if (f && f.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        set("duration_seconds", Math.min(120, Math.ceil(v.duration) + 2));
        URL.revokeObjectURL(v.src);
      };
      v.src = URL.createObjectURL(f);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      type: item.type,
      title: item.title || "",
      body: item.body || "",
      url: item.type === "webpage" ? item.image_url || "" : "",
      duration_seconds: item.duration_seconds,
      start_date: toLocalInput(item.start_date),
      end_date: toLocalInput(item.end_date),
    });
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadFile() {
    if (file.size > 50 * 1024 * 1024)
      throw new Error("Ficheiro demasiado grande (máx. 50 MB no plano free).");
    const ext = file.name.split(".").pop().toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) throw new Error("Upload falhou: " + error.message);
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (needsText(form.type) && !form.title && !form.body)
        throw new Error("Preenche pelo menos o título ou o texto.");
      if (needsFile(form.type) && !file && !editingId)
        throw new Error(form.type === "video" ? "Escolhe um vídeo." : "Escolhe uma imagem.");
      if (form.type === "webpage" && !form.url)
        throw new Error("Indica o URL da página.");

      const record = {
        type: form.type,
        title: form.title || null,
        body: form.body || null,
        duration_seconds: Number(form.duration_seconds) || 8,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      };

      if (needsFile(form.type) && file) record.image_url = await uploadFile();
      if (form.type === "webpage") record.image_url = form.url;
      if (form.type === "text") record.image_url = null;

      if (editingId) {
        const { error } = await supabase
          .from("playlist_items")
          .update(record)
          .eq("id", editingId);
        if (error) throw new Error(error.message);
        setMsg({ type: "ok", text: "Item atualizado." });
      } else {
        record.order_index =
          items.length > 0 ? Math.max(...items.map((i) => i.order_index)) + 1 : 0;
        record.active = true;
        const { error } = await supabase.from("playlist_items").insert(record);
        if (error) throw new Error(error.message);
        setMsg({ type: "ok", text: "Item adicionado à playlist." });
      }

      cancelEdit();
      await loadItems();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
    setBusy(false);
  }

  async function toggleActive(item) {
    await supabase
      .from("playlist_items")
      .update({ active: !item.active })
      .eq("id", item.id);
    await loadItems();
  }

  async function remove(item) {
    if (!confirm(`Apagar "${item.title || item.type}"?`)) return;
    await supabase.from("playlist_items").delete().eq("id", item.id);
    await loadItems();
  }

  async function move(item, dir) {
    const idx = items.findIndex((i) => i.id === item.id);
    const other = items[idx + dir];
    if (!other) return;
    await Promise.all([
      supabase
        .from("playlist_items")
        .update({ order_index: other.order_index })
        .eq("id", item.id),
      supabase
        .from("playlist_items")
        .update({ order_index: item.order_index })
        .eq("id", other.id),
    ]);
    await loadItems();
  }

  return (
    <div className="admin">
      <div className="topbar">
        <h1>Playlist da TV</h1>
        <button className="btn small secondary" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>
          {editingId ? "Editar item" : "Novo item"}
        </h2>

        <label>Tipo</label>
        <select value={form.type} onChange={(e) => set("type", e.target.value)}>
          <option value="text">Só texto</option>
          <option value="image">Só imagem</option>
          <option value="image_text">Imagem + texto</option>
          <option value="video">Vídeo</option>
          <option value="webpage">Página web (URL)</option>
        </select>

        {needsFile(form.type) && (
          <>
            <label>
              {form.type === "video" ? "Vídeo (mp4/webm, máx. 50 MB)" : "Imagem"}
              {editingId ? " (deixa vazio para manter o atual)" : ""}
            </label>
            <input
              type="file"
              accept={form.type === "video" ? "video/mp4,video/webm" : "image/*"}
              ref={fileRef}
              onChange={(e) => handleFileChange(e.target.files[0] || null)}
            />
          </>
        )}

        {form.type === "webpage" && (
          <>
            <label>URL da página (ex.: ranking do jogo)</label>
            <input
              type="text"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://..."
            />
          </>
        )}

        {needsText(form.type) && (
          <>
            <label>Título</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex.: Reunião de equipa"
            />
            <label>Texto</label>
            <textarea
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder="Ex.: Sexta-feira às 15h00, na sala de formação."
            />
          </>
        )}

        <div className="row">
          <div>
            <label>
              {form.type === "video"
                ? "Duração máxima (s) — o slide avança quando o vídeo acabar"
                : "Duração (segundos)"}
            </label>
            <input
              type="number"
              min="3"
              max="120"
              value={form.duration_seconds}
              onChange={(e) => set("duration_seconds", e.target.value)}
            />
          </div>
        </div>

        <div className="row">
          <div>
            <label>Mostrar a partir de (opcional)</label>
            <input
              type="datetime-local"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </div>
          <div>
            <label>Mostrar até (opcional)</label>
            <input
              type="datetime-local"
              value={form.end_date}
              onChange={(e) => set("end_date", e.target.value)}
            />
          </div>
        </div>

        <button className="btn" disabled={busy}>
          {busy ? "A guardar…" : editingId ? "Guardar alterações" : "Adicionar"}
        </button>{" "}
        {editingId && (
          <button type="button" className="btn secondary" onClick={cancelEdit}>
            Cancelar
          </button>
        )}
      </form>

      <h2>Itens ({items.length})</h2>
      {items.map((item, idx) => (
        <div key={item.id} className={`card item ${item.active ? "" : "inactive"}`}>
          {item.type === "video" ? (
            <div className="thumb placeholder">🎬</div>
          ) : item.type === "webpage" ? (
            <div className="thumb placeholder">🌐</div>
          ) : item.image_url ? (
            <img className="thumb" src={item.image_url} alt="" />
          ) : (
            <div className="thumb placeholder">📝</div>
          )}
          <div className="info">
            <div className="title">
              {item.title || item.body || (item.type === "webpage" ? item.image_url : "(sem título)")}
            </div>
            <div className="meta">
              {TYPE_LABELS[item.type] || item.type}
              {" · "}
              {item.duration_seconds}s
              {item.start_date && <> · de {fmtDate(item.start_date)}</>}
              {item.end_date && <> · até {fmtDate(item.end_date)}</>}
              {!item.active && " · INATIVO"}
            </div>
          </div>
          <div className="actions">
            <div className="rowbtns">
              <button className="btn small secondary" onClick={() => move(item, -1)} disabled={idx === 0}>
                ↑
              </button>
              <button
                className="btn small secondary"
                onClick={() => move(item, 1)}
                disabled={idx === items.length - 1}
              >
                ↓
              </button>
            </div>
            <div className="rowbtns">
              <button className="btn small" onClick={() => startEdit(item)}>
                Editar
              </button>
              <button className="btn small secondary" onClick={() => toggleActive(item)}>
                {item.active ? "Pausar" : "Ativar"}
              </button>
              <button className="btn small danger" onClick={() => remove(item)}>
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="card">A playlist está vazia — adiciona o primeiro item acima.</div>
      )}
    </div>
  );
}
