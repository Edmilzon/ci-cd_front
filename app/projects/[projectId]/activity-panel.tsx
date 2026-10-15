"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/src/lib/api";
import { getProjectActivity, type ActivityCategory, type ProjectActivityPage } from "@/src/lib/project-api";

const categories: { value: "ALL" | ActivityCategory; label: string }[] = [
  { value: "ALL", label: "Toda la actividad" },
  { value: "PROJECT", label: "Proyecto y repositorios" },
  { value: "ACCESS", label: "Accesos" },
  { value: "PIPELINE", label: "Pipelines" },
  { value: "DEPLOYMENT", label: "Despliegues" },
  { value: "SECRET", label: "Secretos" },
];

const categoryNames: Record<ActivityCategory, string> = {
  PROJECT: "Proyecto", ACCESS: "Acceso", PIPELINE: "Pipeline", DEPLOYMENT: "Despliegue", SECRET: "Secreto",
};

function activityError(error: unknown) {
  return error instanceof ApiError ? error.message : "No pudimos cargar la actividad del proyecto.";
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz",
  }).format(new Date(value));
}

export default function ProjectActivityPanel({ projectId }: { projectId: string }) {
  const [category, setCategory] = useState<"ALL" | ActivityCategory>("ALL");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ProjectActivityPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getProjectActivity(projectId, category, page).then((data) => {
      if (active) setResult(data);
    }).catch((requestError: unknown) => {
      if (active) setError(activityError(requestError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [projectId, category, page, retry]);

  function changeCategory(value: "ALL" | ActivityCategory) {
    setCategory(value);
    setPage(0);
  }

  return <section className="project-section-card project-activity-card" aria-labelledby="project-activity-title">
    <div className="project-section-heading">
      <div><span className="section-icon">◷</span><div><h2 id="project-activity-title">Actividad del proyecto</h2><p>Historial de cambios con actor y hora local.</p></div></div>
      <div className="project-activity-actions"><label className="project-activity-filter"><span>Filtrar</span><select value={category} onChange={(event) => changeCategory(event.target.value as "ALL" | ActivityCategory)} aria-label="Filtrar actividad por categoría">
        {categories.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
      </select></label><button className="projects-secondary" onClick={() => setRetry((value) => value + 1)} disabled={loading}>{loading ? "Actualizando…" : "Actualizar"}</button></div>
    </div>

    {error && <div className="project-activity-error" role="alert"><span>{error}</span><button className="projects-secondary" onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div>}
    {loading ? <div className="projects-state"><span className="projects-spinner" /> Cargando actividad…</div>
      : !error && result?.content.length ? <>
        <div className="project-activity-list" aria-live="polite">
          {result.content.map((item) => <article className="project-activity-row" key={item.id}>
            <span className={`project-activity-mark category-${item.category.toLowerCase()}`} aria-hidden="true">{item.category === "DEPLOYMENT" ? "⇧" : item.category === "PIPELINE" ? "⌘" : item.category === "ACCESS" ? "♧" : item.category === "SECRET" ? "◇" : "•"}</span>
            <div className="project-activity-copy"><strong>{item.summary}</strong><span>{item.actorEmail} <i>·</i> {categoryNames[item.category]}</span></div>
            <time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time>
          </article>)}
        </div>
        <footer className="project-activity-footer"><span>{result.totalElements} {result.totalElements === 1 ? "evento" : "eventos"} · página {result.page + 1} de {Math.max(result.totalPages, 1)}</span><div><button className="projects-secondary" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={loading || page === 0}>Anterior</button><button className="projects-secondary" onClick={() => setPage((value) => value + 1)} disabled={loading || page + 1 >= (result?.totalPages ?? 0)}>Siguiente</button></div></footer>
      </> : !error && <div className="project-section-empty"><span>◷</span><strong>No hay actividad para este filtro</strong><p>Los cambios del proyecto aparecerán aquí a medida que el equipo trabaje.</p></div>}
  </section>;
}
