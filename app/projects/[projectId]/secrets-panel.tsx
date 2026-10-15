"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/src/lib/api";
import { deleteProjectSecret, getProjectSecrets, saveProjectSecret, type ProjectSecret } from "@/src/lib/project-api";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "No pudimos completar la operación. Inténtalo nuevamente.";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function ProjectSecretsPanel({ projectId }: { projectId: string }) {
  const [secrets, setSecrets] = useState<ProjectSecret[]>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try { setSecrets(await getProjectSecrets(projectId)); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim().toUpperCase();
    if (!normalizedName || value.length < 8) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await saveProjectSecret(projectId, normalizedName, value);
      setValue(""); setName("");
      setNotice(`Se guardó ${saved.name}. Su valor no vuelve a mostrarse.`);
      await load();
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  async function remove(secret: ProjectSecret) {
    if (!window.confirm(`¿Eliminar el secreto ${secret.name}? Los pipelines que lo usen fallarán hasta volver a configurarlo.`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await deleteProjectSecret(projectId, secret.name); setNotice(`${secret.name} eliminado.`); await load(); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  return <section className="project-section-card project-secrets-card" aria-labelledby="project-secrets-title">
    <div className="project-section-heading">
      <div><span className="section-icon secrets-icon" aria-hidden="true">⌑</span><div><h2 id="project-secrets-title">Secretos de CI</h2><p>Solo los trabajos que los declaren podrán recibirlos como variables de entorno.</p></div></div>
      <span className="secret-count">{secrets.length} {secrets.length === 1 ? "secreto" : "secretos"}</span>
    </div>
    <div className="secret-security-note"><strong>Protección activa</strong><span>Se cifran en el backend y su valor nunca vuelve a la interfaz. Los logs ocultan coincidencias exactas; no imprimas secretos ni habilites red externa para código que no controles.</span></div>
    {error && <div className="projects-alert secret-alert" role="alert"><span>!</span>{error}</div>}
    {notice && <div className="projects-success secret-alert" role="status">✓ {notice}</div>}
    <form className="secret-form" onSubmit={(event) => void save(event)}>
      <label><span>Nombre de variable</span><input required maxLength={100} pattern="[A-Za-z_][A-Za-z0-9_]*" autoCapitalize="characters" value={name} onChange={(event) => setName(event.target.value.toUpperCase())} placeholder="NPM_TOKEN" /></label>
      <label><span>Valor secreto</span><input required minLength={8} maxLength={4096} type="password" autoComplete="new-password" spellCheck={false} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Se guardará cifrado" /></label>
      <button className="projects-primary" disabled={busy || !name.trim() || value.length < 8}>{busy ? "Guardando…" : "Guardar secreto"}</button>
      <small>Al guardar un nombre existente se reemplaza su valor. Mínimo 8 caracteres.</small>
    </form>
    {loading ? <div className="projects-state secret-loading"><span className="projects-spinner" /> Cargando secretos…</div>
      : secrets.length ? <div className="secret-list">{secrets.map((secret) => <article className="secret-row" key={secret.name}>
        <span className="secret-key-icon" aria-hidden="true">•••</span><div className="secret-copy"><strong>{secret.name}</strong><small>Actualizado {dateLabel(secret.updatedAt)} por {secret.updatedBy}</small></div>
        <span className="secret-never-shown">Valor oculto</span><button type="button" className="project-icon-button" aria-label={`Eliminar secreto ${secret.name}`} title="Eliminar secreto" onClick={() => void remove(secret)} disabled={busy}>×</button>
      </article>)}</div> : <div className="project-section-empty secret-empty"><strong>Aún no hay secretos</strong><p>Guarda aquí tokens de paquetes o credenciales que necesite un trabajo del pipeline.</p></div>}
    <p className="secret-yaml-help">En YAML: <code>secrets: [NPM_TOKEN]</code> dentro del trabajo. Cada trabajo recibe únicamente los nombres que declara.</p>
  </section>;
}
