"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/src/auth/AuthProvider";
import { ApiError } from "@/src/lib/api";
import { addPipelineVersion, createPipeline, deletePipeline, getPipelineRunLogs, getPipelineRuns, getPipelineVersion, getPipelineVersions, getPipelines, getProject, getProjectRepositories, queuePipelineRun, validatePipeline, type Pipeline, type PipelineRun, type PipelineRunLog, type PipelineValidation, type PipelineVersion, type PipelineVersionDetail, type Project, type ProjectRepository } from "@/src/lib/project-api";

function errorMessage(error: unknown) { return error instanceof ApiError ? error.message : "No pudimos completar la operación. Inténtalo nuevamente."; }
function dateLabel(value: string) { return new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
const runLabels: Record<PipelineRun["status"], string> = { QUEUED: "En cola", RUNNING: "En ejecución", SUCCEEDED: "Completada", FAILED: "Fallida", CANCELLED: "Cancelada" };
async function loadRunLogs(projectId: string, runId: string, afterId = 0) {
  const result: PipelineRunLog[] = [];
  let cursor = afterId;
  for (let page = 0; page < 8; page += 1) {
    const entries = await getPipelineRunLogs(projectId, runId, cursor);
    if (!entries.length) break;
    result.push(...entries);
    cursor = entries.at(-1)?.id ?? cursor;
    if (entries.length < 250) break;
  }
  return result;
}
function starterYaml(repositoryName: string) {
  const safeName = repositoryName.trim() || "Build";
  return `name: ${safeName} build\ntriggers:\n  - manual\njobs:\n  build:\n    name: Build\n    image: node:22-bookworm-slim\n    network: bridge\n    steps:\n      - name: Install dependencies\n        run: npm ci\n      - name: Build\n        run: npm run build\n`;
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
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runLogs, setRunLogs] = useState<PipelineRunLog[]>([]);
  const lastRunLogId = useRef(0);
  const runLogsReady = useRef(false);
  const [runBusy, setRunBusy] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);

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

  useEffect(() => {
    if (!selected) { setRuns([]); setSelectedRunId(""); setRunLogs([]); return; }
    let active = true;
    setRuns([]); setSelectedRunId(""); setRunLogs([]);
    setRunsLoading(true);
    getPipelineRuns(projectId, selected.id)
      .then((history) => {
        if (!active) return;
        setRuns(history);
        setSelectedRunId((current) => history.some((run) => run.id === current) ? current : history[0]?.id ?? "");
      })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setRunsLoading(false); });
    return () => { active = false; };
  }, [projectId, selected?.id]);

  useEffect(() => {
    if (!selectedRunId) { lastRunLogId.current = 0; runLogsReady.current = false; setRunLogs([]); return; }
    let active = true;
    lastRunLogId.current = 0; runLogsReady.current = false; setRunLogs([]);
    loadRunLogs(projectId, selectedRunId)
      .then((entries) => { if (active) { setRunLogs(entries.slice(-250)); lastRunLogId.current = entries.at(-1)?.id ?? 0; runLogsReady.current = true; } })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); });
    return () => { active = false; };
  }, [projectId, selectedRunId]);

  const hasActiveRuns = runs.some((run) => run.status === "QUEUED" || run.status === "RUNNING");
  useEffect(() => {
    if (!selected || !hasActiveRuns) return;
    let active = true;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const history = await getPipelineRuns(projectId, selected.id);
          if (!active) return;
          setRuns(history);
          if (selectedRunId && runLogsReady.current) {
            const entries = await loadRunLogs(projectId, selectedRunId, lastRunLogId.current);
            if (!active) return;
            if (entries.length) {
              setRunLogs((current) => [...current, ...entries].slice(-250));
              lastRunLogId.current = entries.at(-1)?.id ?? lastRunLogId.current;
            }
          }
        } catch (requestError) { if (active) setError(errorMessage(requestError)); }
      })();
    }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [projectId, selected?.id, selectedRunId, hasActiveRuns]);

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

  async function runNow() {
    if (!selected || !project) return;
    const repo = repositories.find((repository) => repository.id === selected.repositoryId);
    setRunBusy(true); setError("");
    try {
      const queued = await queuePipelineRun(project.id, selected.id, repo?.defaultBranch);
      setNotice(`Ejecución ${queued.id.slice(0, 8)} encolada para ${queued.branchName}.`);
      setRuns((current) => [queued, ...current.filter((run) => run.id !== queued.id)].slice(0, 100));
      setSelectedRunId(queued.id);
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setRunBusy(false); }
  }

  async function refreshRuns() {
    if (!selected) return;
    setRunsLoading(true); setError("");
    try {
      const history = await getPipelineRuns(projectId, selected.id);
      setRuns(history);
      const targetRunId = history.some((run) => run.id === selectedRunId) ? selectedRunId : history[0]?.id ?? "";
      setSelectedRunId(targetRunId);
      const cursor = targetRunId === selectedRunId ? lastRunLogId.current : 0;
      runLogsReady.current = false;
      const entries = targetRunId ? await loadRunLogs(projectId, targetRunId, cursor) : [];
      setRunLogs((current) => cursor ? [...current, ...entries].slice(-250) : entries.slice(-250));
      lastRunLogId.current = entries.at(-1)?.id ?? (cursor ? lastRunLogId.current : 0);
      runLogsReady.current = true;
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setRunsLoading(false); }
  }

  return <main className="projects-shell">
    <header className="projects-topbar"><Link className="projects-brand" href="/" aria-label="CDCI, volver al resumen"><span className="brand-symbol"><i /><i /><i /></span><strong>cdci<span>.</span></strong></Link><nav aria-label="Ruta"><Link href="/projects">Proyectos</Link><span>/</span><Link href={`/projects/${projectId}`}>{project?.name ?? "Proyecto"}</Link><span>/</span><strong>Pipelines</strong></nav><div className="projects-account"><span>{user?.fullName}</span><button onClick={() => void signOut()}>Salir</button></div></header>

    <div className="projects-content pipeline-page">
      <div className="project-back"><Link href={`/projects/${projectId}`}>← Volver al proyecto</Link><span>YAML · versiones inmutables</span></div>
      <div className="projects-heading"><div><span className="projects-eyebrow">{project?.name ?? "PROYECTO"} · AUTOMATIZACIÓN</span><h1>Pipelines</h1><p>Define los trabajos del repositorio, valida su estructura y conserva cada versión.</p></div>{project?.canManage && repositories.length > 0 && <button className="projects-primary" onClick={openCreate}>＋ Nuevo pipeline</button>}</div>

      {error && <div className="projects-alert" role="alert"><span>!</span>{error}<button onClick={() => setError("")} aria-label="Cerrar error">×</button></div>}
      {notice && <div className="projects-success" role="status">✓ {notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}

      <div className="pipeline-runner-note"><span className="pipeline-note-icon">◷</span><div><strong>Ejecuciones aisladas · historial en vivo</strong><span>Cada paso corre en un contenedor efímero con límites de recursos. La red queda apagada salvo que el trabajo solicite bridge.</span></div><span className="pipeline-pending-badge">DOCKER · SANDBOX</span></div>

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
                <div className="pipeline-editor-help"><span>Esquema CDCI</span><span>triggers: manual · solo ejecuciones manuales en v1</span><span>jobs → image · network · secrets · steps → run</span><span>Declara secretos del proyecto por nombre; nunca escribas el valor en YAML.</span></div>
                {validation && <div className={`pipeline-validation ${validation.valid ? "is-valid" : "is-invalid"}`} role="status">{validation.valid ? <><strong>✓ YAML válido</strong><span>{validation.name} · {validation.jobs} trabajos · {validation.steps} pasos</span></> : <><strong>Revisa la definición</strong>{validation.errors.map((item, index) => <span key={index}>• {item}</span>)}</>}</div>}
                <div className="pipeline-editor-actions"><button type="button" className="projects-secondary" onClick={() => void checkYaml()} disabled={busy || !yaml.trim()}>{busy ? "Validando…" : "Validar YAML"}</button><button className="projects-primary" disabled={busy || !validation?.valid || (creating && !repositoryId)}>{busy ? "Guardando…" : creating ? "Crear versión 1" : "Guardar nueva versión"}</button></div>
              </form> : selected ? <>
                <div className="pipeline-detail-heading"><div><span className="projects-eyebrow">PIPELINE · {selected.repositoryName}</span><h2>{selected.name}</h2><p>Actualizado {dateLabel(selected.updatedAt)}</p></div><div className="pipeline-detail-actions"><span className="pipeline-version-pill">v{selected.currentVersion}</span>{project?.canManage && <><button className="projects-primary" onClick={() => void runNow()} disabled={runBusy}>{runBusy ? "Encolando…" : "▶ Ejecutar"}</button><button className="projects-secondary" onClick={openNewVersion} disabled={detailLoading}>Nueva versión</button><button className="project-danger-outline" onClick={() => void removePipeline()} disabled={busy || runs.length > 0}>Eliminar</button></>}</div></div>
                <div className="pipeline-version-toolbar"><label>Versión<select value={selectedVersion || selected.currentVersion} onChange={(event) => void changeVersion(Number(event.target.value))}>{versions.map((version) => <option key={version.versionNumber} value={version.versionNumber}>Versión {version.versionNumber} · {dateLabel(version.createdAt)}</option>)}</select></label>{versionDetail && <span>SHA-256 · {versionDetail.sha256.slice(0, 12)}…</span>}</div>
                {detailLoading ? <div className="projects-state pipeline-loading"><span className="projects-spinner" /> Cargando versión…</div> : versionDetail ? <pre className="pipeline-yaml-view"><code>{versionDetail.yaml}</code></pre> : <div className="pipeline-list-empty">No se pudo cargar esta versión.</div>}
                {versionDetail && <div className="pipeline-version-byline">Guardada por {versionDetail.createdBy} · {dateLabel(versionDetail.createdAt)}</div>}
                <div className="pipeline-runs-panel">
                  <div className="pipeline-runs-heading"><div><strong>Ejecuciones manuales</strong><span>Versiones y resultados solicitados para este pipeline.</span></div><button className="projects-secondary" onClick={() => void refreshRuns()} disabled={runsLoading}>{runsLoading ? "Actualizando…" : "Actualizar"}</button></div>
                  {runsLoading && !runs.length ? <div className="pipeline-runs-empty"><span className="projects-spinner" /> Cargando historial…</div> : !runs.length ? <div className="pipeline-runs-empty">Aún no hay ejecuciones. Pulsa “Ejecutar” para agregar una a la cola.</div> : <div className="pipeline-runs-list">{runs.map((run) => <button key={run.id} className={`pipeline-run-row ${run.id === selectedRunId ? "is-selected" : ""}`} onClick={() => setSelectedRunId(run.id)}><span className={`run-status-dot status-${run.status.toLowerCase()}`} /><span className="pipeline-run-copy"><strong>{runLabels[run.status]} · v{run.pipelineVersion}</strong><small>{run.branchName} · {dateLabel(run.requestedAt)} · {run.requestedBy}</small></span><span className={`run-status-badge status-${run.status.toLowerCase()}`}>{runLabels[run.status]}</span></button>)}</div>}
                  {runs.find((run) => run.id === selectedRunId)?.failureMessage && <div className="pipeline-run-failure" role="alert">{runs.find((run) => run.id === selectedRunId)?.failureMessage}</div>}
                  {selectedRunId && <div className="pipeline-run-log-box"><div className="pipeline-run-log-heading"><strong>Logs de la ejecución</strong><span>{runLogs.length} eventos</span></div>{runLogs.length ? <div className="pipeline-run-log-list">{runLogs.map((entry) => <div className="pipeline-run-log-line" key={entry.id}><time>{new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(entry.createdAt))}</time><span className={`log-stream stream-${entry.stream.toLowerCase()}`}>{entry.stream}</span><code>{entry.message}</code></div>)}</div> : <div className="pipeline-runs-empty">No hay logs disponibles todavía.</div>}</div>}
                </div>
              </> : <div className="pipeline-select-empty"><span>◇</span><h2>Selecciona un pipeline</h2><p>El historial y la definición YAML aparecerán aquí.</p></div>}
            </section>
          </div>}
      <footer className="projects-footer">CDCI · Definiciones YAML y control de versiones</footer>
    </div>
  </main>;
}
