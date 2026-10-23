"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { deferEffect } from "@/src/lib/defer-effect";
import { ApiError } from "@/src/lib/api";
import {
  createProjectServer,
  deleteProjectServer,
  executeProjectServerCommand,
  getProjectServers,
  testProjectServer,
  updateProjectServer,
  type ProjectServer,
  type ProjectServerCommandResult,
} from "@/src/lib/project-api";

type ServerForm = {
  name: string;
  host: string;
  port: string;
  username: string;
  hostKeyFingerprint: string;
  password: string;
};

const emptyForm: ServerForm = { name: "", host: "", port: "22", username: "root", hostKeyFingerprint: "", password: "" };

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "No pudimos completar la operación. Inténtalo nuevamente.";
}

function dateLabel(value: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusLabel(status: ProjectServer["lastStatus"]) {
  if (status === "CONNECTED") return "Conectado";
  if (status === "FAILED") return "Falló la conexión";
  return "Sin probar";
}

function statusClass(status: ProjectServer["lastStatus"]) {
  return status.toLowerCase();
}

export default function ProjectServersPanel({ projectId }: { projectId: string }) {
  const [servers, setServers] = useState<ProjectServer[]>([]);
  const [form, setForm] = useState<ServerForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [consoleServer, setConsoleServer] = useState<ProjectServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try { setServers(await getProjectServers(projectId)); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => deferEffect(() => { void load(); }), [load]);

  function updateField(field: keyof ServerForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function beginEdit(server: ProjectServer) {
    setEditingId(server.id);
    setForm({ name: server.name, host: server.host, port: String(server.port), username: server.username, hostKeyFingerprint: server.hostKeyFingerprint ?? "", password: "" });
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const port = Number(form.port);
    const name = form.name.trim();
    const host = form.host.trim();
    const username = form.username.trim();
    const hostKeyFingerprint = form.hostKeyFingerprint.trim();
    if (!name || !host || !username || !Number.isInteger(port) || port < 1 || port > 65535) {
      setError("Completa el nombre, el host, el puerto y el usuario SSH.");
      return;
    }
    if (!/^SHA256:[A-Za-z0-9+/]{43}$/.test(hostKeyFingerprint)) {
      setError("Ingresa la huella SSH en formato SHA256:… y verifícala por un canal confiable.");
      return;
    }
    if (!editingId && !form.password) {
      setError("Escribe la contraseña SSH del servidor.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      if (editingId) {
        const saved = await updateProjectServer(projectId, editingId, {
          name, host, port, username, ...(form.password ? { password: form.password } : {}),
        hostKeyFingerprint,
        });
        setNotice(`Servidor ${saved.name} actualizado.`);
      } else {
        const saved = await createProjectServer(projectId, { name, host, port, username, hostKeyFingerprint, password: form.password });
        setNotice(`Servidor ${saved.name} agregado. Ya puedes probar la conexión.`);
      }
      resetForm();
      await load();
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  async function test(server: ProjectServer) {
    setTestingId(server.id); setError(""); setNotice("");
    try {
      const result = await testProjectServer(projectId, server.id);
      setServers((current) => current.map((item) => item.id === result.server.id ? result.server : item));
      setConsoleServer((current) => current?.id === result.server.id ? result.server : current);
      setNotice(`Conexión establecida con ${server.name} en ${result.latencyMs} ms. ${result.osInfo || ""}`.trim());
    } catch (requestError) {
      const message = errorMessage(requestError);
      await load();
      setServers((current) => current.map((item) => item.id === server.id ? { ...item, lastStatus: "FAILED" } : item));
      setError(message);
    } finally { setTestingId(null); }
  }

  async function remove(server: ProjectServer) {
    if (!window.confirm(`¿Eliminar el servidor ${server.name}? Se borrarán su host y su contraseña cifrada.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await deleteProjectServer(projectId, server.id);
      if (editingId === server.id) resetForm();
      if (consoleServer?.id === server.id) setConsoleServer(null);
      setNotice(`Servidor ${server.name} eliminado.`);
      await load();
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  return <>
    <section id="project-servers" className="project-section-card project-servers-card" aria-labelledby="project-servers-title">
      <div className="project-section-heading">
        <div><span className="section-icon servers-icon" aria-hidden="true">▣</span><div><h2 id="project-servers-title">Servidores</h2><p>Conecta por SSH y administra tus servidores desde CDCI.</p></div></div>
        <span className="server-count">{servers.length} {servers.length === 1 ? "servidor" : "servidores"}</span>
      </div>
      <div className="server-security-note">
        <strong>Acceso cifrado y verificado</strong>
        <span>La contraseña se guarda cifrada y nunca vuelve a la interfaz. Antes de conectar, CDCI exige que la huella SSH SHA-256 coincida. Verifícala con el administrador del host por un canal confiable; no uses una huella obtenida únicamente por esta conexión.</span>
      </div>
      {error && <div className="projects-alert server-alert" role="alert"><span>!</span>{error}</div>}
      {notice && <div className="projects-success server-alert" role="status">✓ {notice}</div>}

      <form className="server-form" onSubmit={(event) => void save(event)}>
        <label><span>Nombre</span><input required maxLength={100} value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Producción" /></label>
        <label><span>Host o IP</span><input required maxLength={253} value={form.host} onChange={(event) => updateField("host", event.target.value)} placeholder="192.168.1.10 o mi-servidor.com" autoCapitalize="none" spellCheck={false} /></label>
        <label><span>Puerto</span><input required type="number" min={1} max={65535} value={form.port} onChange={(event) => updateField("port", event.target.value)} /></label>
        <label><span>Usuario SSH</span><input required maxLength={100} value={form.username} onChange={(event) => updateField("username", event.target.value)} placeholder="root" autoCapitalize="none" spellCheck={false} /></label>
        <label><span>Huella de host SSH · SHA-256</span><input required maxLength={50} pattern="SHA256:[A-Za-z0-9+/]{43}" value={form.hostKeyFingerprint} onChange={(event) => updateField("hostKeyFingerprint", event.target.value)} placeholder="SHA256:…" autoCapitalize="none" spellCheck={false} /></label>
        <label><span>Contraseña SSH</span><input required={!editingId} minLength={editingId ? undefined : 1} maxLength={4096} type="password" autoComplete="new-password" value={form.password} onChange={(event) => updateField("password", event.target.value)} placeholder={editingId ? "Dejar vacía para conservar" : "Se guardará cifrada"} /></label>
        <button className="projects-primary" disabled={busy || !form.name.trim() || !form.host.trim() || !form.username.trim() || (!editingId && !form.password)}>{busy ? "Guardando…" : editingId ? "Guardar cambios" : "Agregar servidor"}</button>
        {editingId && <button type="button" className="projects-secondary server-cancel" onClick={resetForm} disabled={busy}>Cancelar edición</button>}
        <small>Obtén la huella en el servidor con <code>ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256</code> (o la clave activa) y confírmala fuera de CDCI. {editingId ? "Deja la contraseña vacía para conservar la actual." : "La contraseña se cifra y no se vuelve a mostrar."}</small>
      </form>

      {loading ? <div className="projects-state server-loading"><span className="projects-spinner" /> Cargando servidores…</div>
        : servers.length ? <div className="server-list">{servers.map((server) => <article className="server-row" key={server.id}>
          <span className="server-avatar" aria-hidden="true">▣</span>
          <div className="server-copy">
            <strong>{server.name}</strong>
            <span className="server-endpoint">{server.username}@{server.host}:{server.port}</span>
            <small>Última conexión: {dateLabel(server.lastConnectedAt)}</small>
            <small className="server-fingerprint">Huella SSH: {server.hostKeyFingerprint || "Pendiente; edita el servidor para fijarla"}</small>
          </div>
          <span className={`server-status status-${statusClass(server.lastStatus)}`}>{statusLabel(server.lastStatus)}</span>
          <div className="server-actions">
            <button type="button" className="projects-secondary server-action" onClick={() => void test(server)} disabled={busy || testingId !== null || !server.hostKeyFingerprint}>{testingId === server.id ? "Probando…" : "Probar"}</button>
            <button type="button" className="projects-secondary server-action" onClick={() => setConsoleServer(server)} disabled={busy || !server.hostKeyFingerprint}>Consola</button>
            <button type="button" className="projects-secondary server-action" onClick={() => beginEdit(server)} disabled={busy}>Editar</button>
            <button type="button" className="project-icon-button" aria-label={`Eliminar servidor ${server.name}`} title="Eliminar servidor" onClick={() => void remove(server)} disabled={busy}>×</button>
          </div>
        </article>)}</div> : <div className="project-section-empty server-empty"><strong>Aún no hay servidores</strong><p>Agrega la IP, el usuario y la contraseña SSH para probar la conexión y abrir una consola de administración.</p></div>}
    </section>

    {consoleServer && <ServerConsole projectId={projectId} server={consoleServer} onClose={() => setConsoleServer(null)} />}
  </>;
}

type ConsoleEntry = ProjectServerCommandResult & { id: number };

function ServerConsole({ projectId, server, onClose }: { projectId: string; server: ProjectServer; onClose: () => void }) {
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;
    setBusy(true); setError("");
    try {
      const result = await executeProjectServerCommand(projectId, server.id, value);
      setEntries((current) => [...current, { ...result, id: Date.now() }]);
      setCommand("");
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  return <div className="project-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="server-console" role="dialog" aria-modal="true" aria-labelledby="server-console-title">
      <div className="project-modal-heading server-console-heading">
        <div><span className="projects-eyebrow">CONSOLA SSH · {server.username}@{server.host}:{server.port}</span><h2 id="server-console-title">{server.name}</h2></div>
        <button type="button" className="project-close" onClick={onClose} aria-label="Cerrar consola">×</button>
      </div>
      <div className="server-console-output" ref={outputRef} aria-live="polite">
        {entries.length === 0 && <p className="server-console-welcome">Escribe un comando para ejecutarlo en <strong>{server.host}</strong>. La salida aparecerá aquí.</p>}
        {entries.map((entry) => <div className="server-console-entry" key={entry.id}>
          <div className="server-console-command"><span>$</span> {entry.command}</div>
          {entry.output && <pre>{entry.output}</pre>}
          {entry.errorOutput && <pre className="server-console-stderr">{entry.errorOutput}</pre>}
          {!entry.output && !entry.errorOutput && <pre className="server-console-empty">(sin salida)</pre>}
          <div className="server-console-meta">Código de salida {entry.exitStatus} · {entry.durationMillis} ms</div>
        </div>)}
      </div>
      {error && <div className="projects-alert server-console-error" role="alert"><span>!</span>{error}</div>}
      <form className="server-console-form" onSubmit={(event) => void run(event)}>
        <span aria-hidden="true">$</span>
        <input autoFocus value={command} onChange={(event) => setCommand(event.target.value)} maxLength={4000} placeholder="uname -a" aria-label="Comando para el servidor" autoCapitalize="none" spellCheck={false} />
        <button className="projects-primary" disabled={busy || !command.trim()}>{busy ? "Ejecutando…" : "Ejecutar"}</button>
      </form>
      <p className="server-console-note">Los comandos se ejecutan con el usuario <strong>{server.username}</strong>. No se guardan en el historial de actividad ni en los logs.</p>
    </section>
  </div>;
}
