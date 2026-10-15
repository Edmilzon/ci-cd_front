"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/src/auth/AuthProvider";
import { ApiError } from "@/src/lib/api";
import { addPipelineVersion, createPipeline, deletePipeline, getPipelineVersion, getPipelineVersions, getPipelines, getProject, getProjectRepositories, validatePipeline, type Pipeline, type PipelineValidation, type PipelineVersion, type PipelineVersionDetail, type Project, type ProjectRepository } from "@/src/lib/project-api";

function errorMessage(error: unknown) { return error instanceof ApiError ? error.message : "No pudimos completar la operación. Inténtalo nuevamente."; }
function dateLabel(value: string) { return new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function starterYaml(repositoryName: string) {
  const safeName = repositoryName.trim() || "Build";
  return `name: ${safeName} build\ntriggers:\n  - push\njobs:\n  build:\n    name: Build\n    steps:\n      - name: Install dependencies\n        run: npm ci\n      - name: Build\n        run: npm run build\n`;
}

export default function ProjectPipelinesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, signOut } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [repositories, setRepositories] = useState<ProjectRepository[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [versionDetail, setVersionDetail] = useState<PipelineVersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [repositoryId, setRepositoryId] = useState("");
  const [yaml, setYaml] = useState("");
  const [validation, setValidation] = useState<PipelineValidation | null>(null);
  const [selectedVersion, setSelectedVersion] = useState(0);

  const selected = useMemo(() => pipelines.find((pipeline) => pipeline.id === selectedId) ?? null, [pipelines, selectedId]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [currentProject, currentRepositories, currentPipelines] = await Promise.all([getProject(projectId), getProjectRepositories(projectId), getPipelines(projectId)]);
      setProject(currentProject); setRepositories(currentRepositories); setPipelines(currentPipelines);
      setSelectedId((current) => currentPipelines.some((pipeline) => pipeline.id === current) ? current : currentPipelines[0]?.id ?? "");
      setRepositoryId((current) => currentRepositories.some((repository) => repository.id === current) ? current : currentRepositories[0]?.id ?? "");
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selected) { setVersions([]); setVersionDetail(null); return; }
    let active = true;
    setDetailLoading(true);
    Promise.all([getPipelineVersions(projectId, selected.id), getPipelineVersion(projectId, selected.id, selected.currentVersion)])
      .then(([history, detail]) => {
        if (!active) return;
        setVersions(history); setVersionDetail(detail); setSelectedVersion(detail.versionNumber);
      })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [projectId, selected?.id, selected?.currentVersion]);

  async function changeVersion(number: number) {
    if (!selected) return;
    setSelectedVersion(number); setDetailLoading(true); setError("");
    try { setVersionDetail(await getPipelineVersion(projectId, selected.id, number)); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setDetailLoading(false); }
  }

  function openCreate() {
    setCreating(true); setValidation(null); setError("");
    const first = repositories[0];
    setRepositoryId(first?.id ?? ""); setYaml(starterYaml(first?.fullName ?? "")); setEditorOpen(true);
  }

  function openNewVersion() {
    setCreating(false); setValidation(null); setError(""); setYaml(versionDetail?.yaml ?? ""); setEditorOpen(true);
  }

  function closeEditor() { setEditorOpen(false); setValidation(null); }

  async function checkYaml() {
    setBusy(true); setError(""); setValidation(null);
    try { const result = await validatePipeline(projectId, yaml); setValidation(result); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  async function savePipeline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation?.valid || !project) return;
    setBusy(true); setError("");
    try {
      if (creating) {
        if (!repositoryId) return;
        const created = await createPipeline(project.id, repositoryId, yaml);
        setNotice(`Pipeline “${created.name}” creado como versión 1.`);
        await load(); setSelectedId(created.id);
      } else if (selected) {
        const saved = await addPipelineVersion(project.id, selected.id, yaml);
        setNotice(`Versión ${saved.versionNumber} guardada. Las versiones anteriores se conservan.`);
        await load(); setSelectedId(selected.id);
      }
      closeEditor();
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  async function removePipeline() {
    if (!selected || !window.confirm(`¿Eliminar “${selected.name}” y todo su historial de versiones?`)) return;
    setBusy(true); setError("");
    try { await deletePipeline(projectId, selected.id); setNotice("Pipeline e historial eliminados."); setSelectedId(""); await load(); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  return <main className="projects-shell">
    <header className="projects-topbar"><Link className="projects-brand" href="/" aria-label="CDCI, volver al resumen"><span className="brand-symbol"><i /><i /><i /></span><strong>cdci<span>.</span></strong></Link><nav aria-label="Ruta"><Link href="/projects">Proyectos</Link><span>/</span><Link href={`/projects/${projectId}`}>{project?.name ?? "Proyecto"}</Link><span>/</span><strong>Pipelines</strong></nav><div className="projects-account"><span>{user?.fullName}</span><button onClick={() => void signOut()}>Salir</button></div></header>

    <div className="projects-content pipeline-page">
      <div className="project-back"><Link href={`/projects/${projectId}`}>← Volver al proyecto</Link><span>YAML · versiones inmutables</span></div>
      <div className="projects-heading"><div><span className="projects-eyebrow">{project?.name ?? "PROYECTO"} · AUTOMATIZACIÓN</span><h1>Pipelines</h1><p>Define los trabajos del repositorio, valida su estructura y conserva cada versión.</p></div>{project?.canManage && repositories.length > 0 && <button className="projects-primary" onClick={openCreate}>＋ Nuevo pipeline</button>}</div>

      {error && <div className="projects-alert" role="alert"><span>!</span>{error}<button onClick={() => setError("")} aria-label="Cerrar error">×</button></div>}
      {notice && <div className="projects-success" role="status">✓ {notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}

      <div className="pipeline-runner-note"><span className="pipeline-note-icon">◷</span><div><strong>Runner pendiente de aislamiento</strong><span>Las definiciones se pueden guardar y versionar. La ejecución se habilitará al configurar un worker aislado.</span></div><span className="pipeline-pending-badge">EJECUCIÓN DESHABILITADA</span></div>

      {loading ? <div className="projects-state"><span className="projects-spinner" /> Cargando pipelines…</div>
        : repositories.length === 0 ? <div className="projects-empty"><span className="empty-project-mark">⌘</span><h2>Conecta un repositorio primero</h2><p>Los pipelines se asocian a un repositorio GitHub conectado al proyecto.</p><Link className="projects-primary" href={`/projects/${projectId}`}>Ir al proyecto</Link></div>
          : <div className="pipeline-layout">
            <section className="pipeline-list-card">
              <div className="pipeline-list-heading"><div><strong>Definiciones</strong><span>{pipelines.length} {pipelines.length === 1 ? "pipeline" : "pipelines"}</span></div>{project?.canManage && <button className="pipeline-plus" onClick={openCreate} aria-label="Crear pipeline">＋</button>}</div>
              {!pipelines.length ? <div className="pipeline-list-empty"><span>◇</span><strong>Aún no hay pipelines</strong><p>Crea una definición YAML para empezar.</p>{project?.canManage && <button className="projects-secondary" onClick={openCreate}>Crear pipeline</button>}</div>
                : <div className="pipeline-list">{pipelines.map((pipeline) => <button className={`pipeline-list-item ${pipeline.id === selectedId ? "is-selected" : ""}`} key={pipeline.id} onClick={() => { closeEditor(); setSelectedId(pipeline.id); }}><span className="pipeline-file-icon">⌘</span><span className="pipeline-list-copy"><strong>{pipeline.name}</strong><small>{pipeline.repositoryName}</small></span><span className="pipeline-version-pill">v{pipeline.currentVersion}</span></button>)}</div>}
            </section>

            <section className="pipeline-detail-card">
              {editorOpen ? <form onSubmit={(event) => void savePipeline(event)} className="pipeline-editor">
                <div className="pipeline-detail-heading"><div><span className="projects-eyebrow">{creating ? "NUEVA DEFINICIÓN" : `NUEVA VERSIÓN · ${selected?.name ?? ""}`}</span><h2>{creating ? "Crear pipeline" : "Guardar versión"}</h2></div><button type="button" className="project-close" onClick={closeEditor} aria-label="Cerrar editor">×</button></div>
                {creating && <label className="pipeline-form-label">Repositorio<select value={repositoryId} onChange={(event) => { setRepositoryId(event.target.value); setValidation(null); }} required>{repositories.map((repository) => <option value={repository.id} key={repository.id}>{repository.fullName} · {repository.defaultBranch}</option>)}</select></label>}
                <label className="pipeline-form-label">Definición YAML<textarea className="pipeline-yaml-input" value={yaml} onChange={(event) => { setYaml(event.target.value); setValidation(null); }} spellCheck={false} required maxLength={65536} aria-label="Definición YAML del pipeline" /></label>
                <div className="pipeline-editor-help"><span>Esquema CDCI</span><span>triggers: push · pull_request · manual</span><span>jobs → steps → run</span></div>
                {validation && <div className={`pipeline-validation ${validation.valid ? "is-valid" : "is-invalid"}`} role="status">{validation.valid ? <><strong>✓ YAML válido</strong><span>{validation.name} · {validation.jobs} trabajos · {validation.steps} pasos</span></> : <><strong>Revisa la definición</strong>{validation.errors.map((item, index) => <span key={index}>• {item}</span>)}</>}</div>}
                <div className="pipeline-editor-actions"><button type="button" className="projects-secondary" onClick={() => void checkYaml()} disabled={busy || !yaml.trim()}>{busy ? "Validando…" : "Validar YAML"}</button><button className="projects-primary" disabled={busy || !validation?.valid || (creating && !repositoryId)}>{busy ? "Guardando…" : creating ? "Crear versión 1" : "Guardar nueva versión"}</button></div>
              </form> : selected ? <>
                <div className="pipeline-detail-heading"><div><span className="projects-eyebrow">PIPELINE · {selected.repositoryName}</span><h2>{selected.name}</h2><p>Actualizado {dateLabel(selected.updatedAt)}</p></div><div className="pipeline-detail-actions"><span className="pipeline-version-pill">v{selected.currentVersion}</span>{project?.canManage && <><button className="projects-secondary" onClick={openNewVersion} disabled={detailLoading}>Nueva versión</button><button className="project-danger-outline" onClick={() => void removePipeline()} disabled={busy}>Eliminar</button></>}</div></div>
                <div className="pipeline-version-toolbar"><label>Versión<select value={selectedVersion || selected.currentVersion} onChange={(event) => void changeVersion(Number(event.target.value))}>{versions.map((version) => <option key={version.versionNumber} value={version.versionNumber}>Versión {version.versionNumber} · {dateLabel(version.createdAt)}</option>)}</select></label>{versionDetail && <span>SHA-256 · {versionDetail.sha256.slice(0, 12)}…</span>}</div>
                {detailLoading ? <div className="projects-state pipeline-loading"><span className="projects-spinner" /> Cargando versión…</div> : versionDetail ? <pre className="pipeline-yaml-view"><code>{versionDetail.yaml}</code></pre> : <div className="pipeline-list-empty">No se pudo cargar esta versión.</div>}
                {versionDetail && <div className="pipeline-version-byline">Guardada por {versionDetail.createdBy} · {dateLabel(versionDetail.createdAt)}</div>}
              </> : <div className="pipeline-select-empty"><span>◇</span><h2>Selecciona un pipeline</h2><p>El historial y la definición YAML aparecerán aquí.</p></div>}
            </section>
          </div>}
      <footer className="projects-footer">CDCI · Definiciones YAML y control de versiones</footer>
    </div>
  </main>;
}
