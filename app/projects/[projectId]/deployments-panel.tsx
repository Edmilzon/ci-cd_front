"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/src/lib/api";
import { useAuth } from "@/src/auth/AuthProvider";
import { approveProjectDeployment, getProjectDeployments, rejectProjectDeployment, rollbackProjectDeployment, type ProjectDeployment } from "@/src/lib/project-api";

const statusLabels: Record<ProjectDeployment["status"], string> = {
  WAITING_APPROVAL: "Esperando aprobación", APPROVED: "Aprobado", IN_PROGRESS: "En curso",
  SUCCEEDED: "Exitoso", FAILED: "Fallido", REJECTED: "Rechazado",
};

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "No pudimos actualizar los despliegues. Inténtalo de nuevo.";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ProjectDeploymentsPanel({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { user } = useAuth();
  const [deployments, setDeployments] = useState<ProjectDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError("");
    try { setDeployments(await getProjectDeployments(projectId)); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void refresh(true); }, [refresh]);

  const hasActive = deployments.some((deployment) => ["WAITING_APPROVAL", "APPROVED", "IN_PROGRESS"].includes(deployment.status));
  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => { void refresh(); }, 8000);
    return () => window.clearInterval(timer);
  }, [hasActive, refresh]);

  async function review(deployment: ProjectDeployment, approve: boolean) {
    setBusyId(deployment.id); setError(""); setNotice("");
    try {
      if (approve) await approveProjectDeployment(projectId, deployment.id);
      else await rejectProjectDeployment(projectId, deployment.id);
      setNotice(approve ? "Despliegue aprobado. El worker continuará cuando lo consulte." : "Despliegue rechazado.");
      await refresh();
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusyId(""); }
  }

  async function rollback(deployment: ProjectDeployment) {
    if (!window.confirm(`¿Encolar rollback de ${deployment.pipelineName} en ${deployment.environmentName} al commit ${deployment.sourceCommitSha.slice(0, 10)}?`)) return;
    setBusyId(deployment.id); setError(""); setNotice("");
    try {
      const run = await rollbackProjectDeployment(projectId, deployment.id);
      setNotice(`Rollback encolado en la ejecución ${run.id.slice(0, 8)}.`);
      await refresh();
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusyId(""); }
  }

  return <section className="project-section-card deployment-panel">
    <div className="project-section-heading">
      <div><span className="section-icon deployment-icon">⇧</span><div><h2>Despliegues</h2><p>Historial por entorno, aprobación de production y rollback al commit publicado.</p></div></div>
      <button className="projects-secondary" onClick={() => void refresh(true)} disabled={loading}>Actualizar</button>
    </div>
    {error && <div className="projects-alert deployment-alert" role="alert">{error}</div>}
    {notice && <div className="projects-success deployment-alert" role="status">✓ {notice}</div>}
    {loading ? <div className="projects-state"><span className="projects-spinner" /> Cargando despliegues…</div>
      : !deployments.length ? <div className="project-section-empty deployment-empty"><span>⇧</span><strong>Aún no hay despliegues</strong><p>Agrega <code>environment: staging</code> o <code>environment: production</code> a un trabajo YAML. Production pide aprobación a otra persona mantenedora.</p><Link className="projects-secondary" href={`/projects/${projectId}/pipelines`}>Configurar pipeline</Link></div>
        : <div className="deployment-list">{deployments.map((deployment) => {
          const isRequester = user?.email?.toLowerCase() === deployment.requestedBy.toLowerCase();
          const waiting = deployment.status === "WAITING_APPROVAL";
          const pending = busyId === deployment.id;
          return <article className="deployment-row" key={deployment.id}>
            <span className={`deployment-mark status-${deployment.status.toLowerCase()}`}>⇧</span>
            <div className="deployment-main">
              <div className="deployment-title"><strong>{deployment.pipelineName}</strong><span className="deployment-environment">{deployment.environmentName}</span><span className={`deployment-status status-${deployment.status.toLowerCase()}`}>{statusLabels[deployment.status]}</span></div>
              <div className="deployment-meta"><span>{deployment.repositoryName} · {deployment.branchName}</span><code title={deployment.sourceCommitSha}>{deployment.sourceCommitSha.slice(0, 12)}</code><span>{dateLabel(deployment.requestedAt)} · por {deployment.requestedBy}</span></div>
              {deployment.approvedBy && <small className="deployment-approver">Aprobado por {deployment.approvedBy}{deployment.approvedAt ? ` · ${dateLabel(deployment.approvedAt)}` : ""}</small>}
              {deployment.rollbackOfDeploymentId && <small className="deployment-rollback-note">Rollback al despliegue {deployment.rollbackOfDeploymentId.slice(0, 8)}</small>}
            </div>
            <div className="deployment-actions">
              <Link className="projects-secondary" href={`/projects/${projectId}/pipelines?pipelineId=${deployment.pipelineId}&runId=${deployment.runId}`}>Ver ejecución</Link>
              {deployment.githubHtmlUrl && <a className="deployment-github-link" href={deployment.githubHtmlUrl} target="_blank" rel="noreferrer">GitHub ↗</a>}
              {canManage && waiting && <><button className="projects-primary" onClick={() => void review(deployment, true)} disabled={pending || isRequester}>{pending ? "Guardando…" : "Aprobar"}</button><button className="project-danger-outline" onClick={() => void review(deployment, false)} disabled={pending || isRequester}>Rechazar</button></>}
              {canManage && deployment.status === "SUCCEEDED" && <button className="projects-secondary" onClick={() => void rollback(deployment)} disabled={pending}>{pending ? "Encolando…" : "Rollback"}</button>}
              {canManage && waiting && isRequester && <small className="deployment-self-review">La persona solicitante no puede aprobar su propio despliegue.</small>}
            </div>
          </article>;
        })}</div>}
    <div className="deployment-standard-note">CDCI conserva el SHA del código publicado y sincroniza el estado del despliegue con GitHub. El rollback reutiliza ese SHA y pasa otra vez por la aprobación de production.</div>
  </section>;
}
