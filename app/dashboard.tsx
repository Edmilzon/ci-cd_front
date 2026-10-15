"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/src/auth/AuthProvider";
import { ChangePasswordForm } from "@/src/auth/ChangePasswordForm";
import { API_BASE_URL } from "@/src/lib/api";
import { getDashboard, getOperationalHealth, type ActivityCategory, type DashboardDeployment, type DashboardRun, type DashboardSummary, type OperationalHealth } from "@/src/lib/project-api";
import { deferEffect } from "@/src/lib/defer-effect";

type Section = "Resumen" | "Pipelines" | "Despliegues" | "Actividad" | "Ajustes";
type Status = "Exitoso" | "Fallido" | "En cola" | "En ejecución" | "Cancelado";

const sections: { name: Section; icon: string }[] = [
  { name: "Resumen", icon: "grid" }, { name: "Pipelines", icon: "flow" },
  { name: "Despliegues", icon: "cloud" }, { name: "Actividad", icon: "clock" },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>,
    flow: <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v5a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v-1"/><path d="M6 12h.01"/></>,
    cloud: <><path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 8.5c0 .17.01.34.03.5A4.5 4.5 0 0 0 7 18Z"/><path d="m9 14 3 3 3-3M12 17v-6"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    users: <><path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 11a3.5 3.5 0 1 0-1-6.8M17 15h.6a3.4 3.4 0 0 1 3.4 3.4V20"/></>,
    shield: <><path d="m12 3 8 3v5c0 5.1-3.4 8.5-8 10-4.6-1.5-8-4.9-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
    audit: <><path d="M4 5h16M4 12h16M4 19h10"/><circle cx="18" cy="19" r="2.5"/><path d="M18 17.5v1.7l1 .6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    branch: <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8M18 16a8 8 0 0 0-8-8H8"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}

function statusFor(status: DashboardRun["status"]): Status {
  const labels: Record<DashboardRun["status"], Status> = { SUCCEEDED: "Exitoso", FAILED: "Fallido", QUEUED: "En cola", RUNNING: "En ejecución", CANCELLED: "Cancelado" };
  return labels[status];
}

function StatusPill({ status }: { status: Status }) {
  const icon = status === "Exitoso" ? "✓" : status === "Fallido" || status === "Cancelado" ? "×" : "";
  const active = status === "En cola" || status === "En ejecución";
  const tone = status === "En ejecución" ? "en-curso" : status === "En cola" ? "en-cola" : status === "Cancelado" ? "cancelado" : status.toLowerCase();
  return <span className={"status-pill status-" + tone}>{active ? <i className="status-spinner" /> : <b>{icon}</b>}{status}</span>;
}

function relativeTime(value: string) {
  const seconds = Math.round((Date.now() - Date.parse(value)) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return formatter.format(-Math.round(seconds / size), unit);
  return formatter.format(-seconds, "second");
}

function durationLabel(milliseconds: number | null) {
  if (milliseconds === null) return "En curso";
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds >= 3600) return Math.floor(seconds / 3600) + "h " + Math.floor((seconds % 3600) / 60) + "m";
  if (seconds >= 60) return Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
  return seconds + "s";
}

function PipelineTable({ items }: { items: DashboardRun[] }) {
  return <div className="pipeline-list">
    {items.length ? items.map((run, index) => <Link className="pipeline-row" key={run.id} href={"/projects/" + run.projectId + "/pipelines?pipelineId=" + run.pipelineId + "&runId=" + run.id} aria-label={"Abrir " + run.pipelineName + ", ejecución " + run.id}>
      <span className={"repo-mark " + ["violet", "blue", "orange", "pink"][index % 4]}>{run.pipelineName.slice(0, 1).toUpperCase()}</span>
      <span className="pipeline-info"><strong>{run.pipelineName}</strong><small>{run.repositoryName} <span>·</span> <span className="branch"><Icon name="branch" size={12} /> {run.branchName}</span></small></span>
      <span className="pipeline-commit">v{run.version} · {run.requestedBy}</span>
      <StatusPill status={statusFor(run.status)} />
      <span className="pipeline-time">{relativeTime(run.requestedAt)}<small>{durationLabel(run.durationMillis)}</small></span>
      <span className="row-arrow"><Icon name="arrow" size={16} /></span>
    </Link>) : <div className="empty-state">No hay ejecuciones que coincidan con estos filtros.</div>}
  </div>;
}

function RunChart({ data }: { data: DashboardSummary["dailyRuns"] }) {
  const maxCount = Math.max(1, ...data.map((day) => day.succeeded + day.failed + day.active));
  const dayLabel = new Intl.DateTimeFormat("es-BO", { weekday: "short", timeZone: "America/La_Paz" });
  return <div className="dashboard-chart" role="list" aria-label="Ejecuciones de los últimos siete días">
    {data.map((day) => {
      const total = day.succeeded + day.failed + day.active;
      return <div className="dashboard-chart-column" key={day.day} role="listitem" aria-label={day.day + ": " + total + " ejecuciones"}>
        <div className="dashboard-chart-bars" title={total + " ejecuciones · " + day.succeeded + " correctas · " + day.failed + " fallidas"}>
          <i className="dashboard-chart-success" style={{ height: (day.succeeded / maxCount * 100) + "%" }} />
          <i className="dashboard-chart-failed" style={{ height: (day.failed / maxCount * 100) + "%" }} />
          <i className="dashboard-chart-active" style={{ height: (day.active / maxCount * 100) + "%" }} />
        </div>
        <span>{dayLabel.format(new Date(day.day + "T12:00:00"))}</span>
      </div>;
    })}
  </div>;
}

function deploymentStatusLabel(status: DashboardDeployment["status"]) {
  const labels: Record<DashboardDeployment["status"], string> = {
    WAITING_APPROVAL: "Espera aprobación", APPROVED: "Aprobado", IN_PROGRESS: "En curso",
    SUCCEEDED: "Exitoso", FAILED: "Fallido", REJECTED: "Rechazado",
  };
  return labels[status];
}

export default function Home() {
  const { user, signOut } = useAuth();
  const [section, setSection] = useState<Section>("Resumen");
  const [statusFilter, setStatusFilter] = useState<"Todos" | Status>("Todos");
  const [activityCategory, setActivityCategory] = useState<"ALL" | ActivityCategory>("ALL");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [apiUrl, setApiUrl] = useState(() => typeof window === "undefined"
    ? API_BASE_URL
    : window.localStorage.getItem("cdci.apiBaseUrl") || API_BASE_URL);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [operationalHealth, setOperationalHealth] = useState<OperationalHealth | null>(null);
  const [healthError, setHealthError] = useState("");
  const [healthCheckedAt, setHealthCheckedAt] = useState("");
  const [healthChecking, setHealthChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refreshDashboard = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");
    try { setDashboard(await getDashboard()); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los datos del dashboard."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const refreshOperationalHealth = useCallback(async () => {
    setHealthChecking(true);
    setHealthError("");
    try {
      setOperationalHealth(await getOperationalHealth());
      setHealthCheckedAt(new Date().toISOString());
    } catch (requestError) {
      setOperationalHealth(null);
      setHealthCheckedAt(new Date().toISOString());
      setHealthError(requestError instanceof Error ? requestError.message : "No se pudo consultar el estado operativo.");
    } finally {
      setHealthChecking(false);
    }
  }, []);

  useEffect(() => deferEffect(() => {
    void refreshDashboard(true);
  }), [refreshDashboard]);

  useEffect(() => section === "Ajustes"
    ? deferEffect(() => { void refreshOperationalHealth(); })
    : undefined, [section, refreshOperationalHealth]);

  useEffect(() => {
    if (!dashboard?.activeRuns) return;
    const timer = window.setInterval(() => { void refreshDashboard(); }, 15000);
    return () => window.clearInterval(timer);
  }, [dashboard?.activeRuns, refreshDashboard]);

  const filteredRuns = useMemo(() => (dashboard?.recentRuns ?? []).filter((run) => {
    const matchesStatus = statusFilter === "Todos" || statusFor(run.status) === statusFilter;
    const haystack = (run.pipelineName + " " + run.projectName + " " + run.repositoryName + " " + run.branchName + " " + run.requestedBy).toLowerCase();
    return matchesStatus && haystack.includes(query.trim().toLowerCase());
  }), [dashboard, statusFilter, query]);

  const filteredActivity = useMemo(() => (dashboard?.recentActivity ?? []).filter((item) => {
    const matchesCategory = activityCategory === "ALL" || item.category === activityCategory;
    const haystack = `${item.summary} ${item.actorEmail} ${item.projectName} ${item.action}`.toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  }), [dashboard, activityCategory, query]);

  const todayLabel = useMemo(() => new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()).replace(",", "").toUpperCase(), []);
  const pageTitles: Record<Section, { title: string; subtitle: string }> = {
    Resumen: { title: "Resumen", subtitle: "Estado real de tus proyectos y ejecuciones." },
    Pipelines: { title: "Pipelines", subtitle: "Busca y revisa las ejecuciones recientes de tus proyectos." },
    Despliegues: { title: "Despliegues", subtitle: "Destinos y publicaciones de tus pipelines." },
    Actividad: { title: "Actividad", subtitle: "Cambios auditables de los proyectos donde puedes consultar el historial." },
    Ajustes: { title: "Ajustes", subtitle: "Configura la conexión con tu backend Spring Boot." },
  };

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  }

  const avatar = user?.fullName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  const successRate = dashboard?.successRate30Days ?? 0;
  const duration = dashboard?.medianDurationMillis30Days ?? null;

  return <main className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setSection("Resumen")} aria-label="CDCI, ir al resumen">
        <span className="brand-symbol"><i /><i /><i /></span><span className="brand-name">cdci<span>.</span></span><span className="brand-tag">CI/CD</span>
      </button>
      <div className="workspace-switcher"><span className="workspace-avatar">{avatar.slice(0, 1)}</span><span className="workspace-copy"><strong>{user?.fullName ?? "Cuenta CDCI"}</strong><small>Proyectos accesibles</small></span></div>
      <div className="nav-label">ESPACIO DE TRABAJO</div>
      <nav className="main-nav" aria-label="Navegación principal">
        {sections.map(({ name, icon }) => <button key={name} className={"nav-item " + (section === name ? "active" : "")} onClick={() => setSection(name)}><Icon name={icon} /><span>{name}</span>{name === "Pipelines" && dashboard && <span className="nav-count">{dashboard.pipelineCount}</span>}</button>)}
      </nav>
      {(user?.permissions?.includes("USER_READ") || user?.permissions?.includes("ROLE_READ") || user?.permissions?.includes("AUDIT_READ")) && <>
        <div className="nav-label admin-nav-label">ADMINISTRACIÓN</div>
        <nav className="main-nav" aria-label="Administración">
          {user?.permissions?.includes("USER_READ") && <Link className="nav-item admin-nav-item" href="/admin/users"><Icon name="users" /><span>Usuarios</span></Link>}
          {user?.permissions?.includes("ROLE_READ") && <Link className="nav-item admin-nav-item" href="/admin/roles"><Icon name="shield" /><span>Roles y permisos</span></Link>}
          {user?.permissions?.includes("AUDIT_READ") && <Link className="nav-item admin-nav-item" href="/admin/audit"><Icon name="audit" /><span>Auditoría</span></Link>}
        </nav>
      </>}
      <div className="nav-label projects-label">PROYECTOS <Link href="/projects" aria-label="Administrar proyectos">+</Link></div>
      <div className="project-nav"><Link href="/projects" className="project-nav-link"><span className="project-dot dot-violet" /> Administrar proyectos <span className="project-chevron">↗</span></Link></div>
      <div className="sidebar-bottom">
        <div className="upgrade-card"><span className="upgrade-spark">⌘</span><strong>{dashboard ? dashboard.projectCount + " proyectos visibles" : "Tus proyectos"}</strong><p>Conecta repositorios GitHub y revisa aquí sus ejecuciones.</p><Link href="/projects">Abrir proyectos <Icon name="arrow" size={14} /></Link></div>
        <button className={"nav-item settings-link " + (section === "Ajustes" ? "active" : "")} onClick={() => setSection("Ajustes")}><Icon name="settings" /><span>Ajustes</span></button>
        <div className="user-profile"><span className="user-avatar">{avatar}</span><span className="user-copy"><strong>{user?.fullName ?? "Usuario"}</strong><small>{user?.roles.map((role) => role === "ADMIN" ? "Administrador" : role === "VIEWER" ? "Lector" : role).join(", ")}</small></span><button aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => void signOut().catch(() => showNotice("No pudimos cerrar la sesión. Inténtalo otra vez."))}>↗</button></div>
      </div>
    </aside>

    <section className="main-panel">
      <header className="topbar">
        <div className="breadcrumbs"><span>CDCI</span><b>/</b><strong>{section}</strong></div>
        <div className="topbar-actions">
          <label className="search-box"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pipelines..." /><kbd>⌘ K</kbd></label>
          <button className="icon-button" aria-label="Actualizar dashboard" title="Actualizar datos" onClick={() => void refreshDashboard()} disabled={refreshing}><Icon name="clock" size={18} /></button>
          <span className="top-avatar">{avatar}</span>
        </div>
      </header>

      <div className="content-wrap">
        <div className="page-heading">
          <div><div className="eyebrow">{todayLabel} <span className="live-dot" /></div><h1>{pageTitles[section].title}</h1><p>{pageTitles[section].subtitle}</p></div>
          <div className="heading-actions"><span className={"demo-badge " + (error ? "data-disconnected" : "data-connected")}><i />{error ? "API sin conexión" : "Datos en vivo"}</span><Link className="primary-button" href="/projects"><Icon name="plus" size={17} /> Nuevo pipeline</Link></div>
        </div>

        {error && <div className="dashboard-alert" role="alert"><span>{error}</span><button className="secondary-button" onClick={() => void refreshDashboard()}>Reintentar</button></div>}

        {section === "Resumen" && <>
          <div className="stats-grid">
            <article className="stat-card"><div className="stat-head"><span>Proyectos visibles</span><span className="stat-icon purple"><Icon name="grid" size={17} /></span></div><div className="stat-value">{loading ? "—" : dashboard?.projectCount ?? 0}</div><div className="stat-foot">Según tu acceso actual</div></article>
            <article className="stat-card"><div className="stat-head"><span>Pipelines</span><span className="stat-icon green"><Icon name="flow" size={17} /></span></div><div className="stat-value">{loading ? "—" : dashboard?.pipelineCount ?? 0}</div><div className="stat-foot">En proyectos visibles</div></article>
            <article className="stat-card"><div className="stat-head"><span>Ejecuciones de hoy</span><span className="stat-icon blue"><span className="check-stat">✓</span></span></div><div className="stat-value">{loading ? "—" : dashboard?.runsToday ?? 0}</div><div className="stat-foot">Zona horaria America/La_Paz</div></article>
            <article className="stat-card"><div className="stat-head"><span>Éxito · últimos 30 días</span><span className="stat-icon orange"><Icon name="audit" size={17} /></span></div><div className="stat-value">{loading ? "—" : successRate.toFixed(1)}<span className="percent">%</span></div><div className="stat-foot">Solo ejecuciones terminadas</div></article>
          </div>

          <div className="dashboard-grid">
            <article className="panel chart-panel"><div className="panel-heading"><div><h2>Actividad de pipelines</h2><p>Ejecuciones reales de los últimos siete días</p></div><span className="stat-caption">{dashboard?.activeRuns ?? 0} activas</span></div>
              <div className="chart-legend"><span><i className="legend-success" /> Exitosas</span><span><i className="legend-failed" /> Fallidas</span><span><i className="legend-active" /> En curso</span></div>
              {loading ? <div className="projects-state"><span className="projects-spinner" /> Cargando actividad…</div> : <RunChart data={dashboard?.dailyRuns ?? []} />}
            </article>
            <article className="panel health-panel"><div className="panel-heading"><div><h2>Estado operativo</h2><p>Métricas de tus proyectos</p></div><span className="connection-badge"><i /> API</span></div>
              <div className="health-summary"><div className="health-ring"><div><strong>{loading ? "—" : dashboard?.activeRuns ?? 0}</strong><span>activas</span></div></div><div className="health-copy"><strong>{(dashboard?.activeRuns ?? 0) > 0 ? "Trabajo en ejecución" : "Sin trabajos activos"}</strong><span>En cola o ejecución</span><span>Mediana 30 días: {duration === null ? "—" : durationLabel(duration)}</span></div></div>
              <Link className="text-link" href="/projects">Administrar proyectos <Icon name="arrow" size={14} /></Link>
            </article>
          </div>

          <article className="panel recent-panel"><div className="panel-heading"><div><h2>Ejecuciones recientes</h2><p>Hasta 50 runs registrados por tus proyectos</p></div><button className="secondary-button" onClick={() => setSection("Pipelines")}>Ver todas <Icon name="arrow" size={14} /></button></div>{loading ? <div className="projects-state"><span className="projects-spinner" /> Cargando ejecuciones…</div> : dashboard?.recentRuns.length ? <PipelineTable items={dashboard.recentRuns.slice(0, 8)} /> : <div className="dashboard-empty"><strong>Aún no hay ejecuciones</strong><p>Conecta un repositorio y crea un pipeline para empezar.</p><Link href="/projects" className="secondary-button">Ver proyectos</Link></div>}</article>
        </>}

        {section === "Pipelines" && <article className="panel full-list-panel"><div className="panel-heading"><div><h2>Ejecuciones</h2><p>{dashboard?.recentRuns.length ?? 0} resultados recientes, máximo 50</p></div><div className="filter-select"><label htmlFor="status-filter">Estado</label><select id="status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "Todos" | Status)}><option>Todos</option><option>Exitoso</option><option>Fallido</option><option>En cola</option><option>En ejecución</option><option>Cancelado</option></select></div></div>{loading ? <div className="projects-state"><span className="projects-spinner" /> Cargando ejecuciones…</div> : <PipelineTable items={filteredRuns} />}</article>}

        {section === "Despliegues" && <article className="panel environments-panel"><div className="panel-heading"><div><h2>Despliegues recientes</h2><p>Publicaciones y aprobaciones en tus proyectos visibles</p></div><button className="secondary-button" onClick={() => void refreshDashboard()} disabled={refreshing}>{refreshing ? "Actualizando…" : "Actualizar"}</button></div>{loading ? <div className="projects-state"><span className="projects-spinner" /> Cargando despliegues…</div> : dashboard?.recentDeployments.length ? <div className="dashboard-deployments">{dashboard.recentDeployments.map((deployment) => <Link className="dashboard-deployment-row" key={deployment.id} href={`/projects/${deployment.projectId}`}><span className={`dashboard-deployment-mark status-${deployment.status.toLowerCase()}`}>⇧</span><span className="dashboard-deployment-copy"><strong>{deployment.pipelineName} <i>{deployment.environmentName}</i></strong><small>{deployment.projectName} · {deployment.repositoryName} · {deployment.sourceCommitSha.slice(0, 12)}</small></span><span className={`dashboard-deployment-status status-${deployment.status.toLowerCase()}`}>{deploymentStatusLabel(deployment.status)}</span><span className="row-arrow"><Icon name="arrow" size={16} /></span></Link>)}</div> : <div className="dashboard-empty"><strong>Aún no hay despliegues</strong><p>Los despliegues registrados en GitHub aparecerán aquí.</p><Link href="/projects" className="secondary-button">Abrir proyectos</Link></div>}</article>}

        {section === "Actividad" && <article className="panel activity-panel"><div className="panel-heading"><div><h2>Registro de actividad</h2><p>Hasta 50 cambios auditables en proyectos autorizados</p></div><div className="activity-panel-actions"><label className="filter-select" htmlFor="activity-category-filter">Tipo<select id="activity-category-filter" value={activityCategory} onChange={(event) => setActivityCategory(event.target.value as "ALL" | ActivityCategory)}><option value="ALL">Todos</option><option value="PROJECT">Proyecto</option><option value="ACCESS">Accesos</option><option value="PIPELINE">Pipelines</option><option value="DEPLOYMENT">Despliegues</option><option value="SECRET">Secretos</option></select></label><button className="secondary-button" onClick={() => void refreshDashboard()} disabled={refreshing}>{refreshing ? "Actualizando…" : "Actualizar"}</button></div></div><div className="activity-date">{todayLabel}</div>{loading ? <div className="projects-state"><span className="projects-spinner" /> Cargando actividad…</div> : filteredActivity.length ? filteredActivity.map((item) => <Link className="activity-item dashboard-activity-item" key={item.id} href={`/projects/${item.projectId}`}><span className={`activity-icon activity-${item.category.toLowerCase()}`} aria-hidden="true">{item.category === "DEPLOYMENT" ? "⇧" : item.category === "PIPELINE" ? "⌘" : item.category === "ACCESS" ? "♧" : item.category === "SECRET" ? "◇" : "•"}</span><span className="activity-copy"><strong>{item.summary}</strong><small>{item.projectName} · {item.category === "ACCESS" ? "Acceso" : item.category === "PIPELINE" ? "Pipeline" : item.category === "DEPLOYMENT" ? "Despliegue" : item.category === "SECRET" ? "Secreto" : "Proyecto"} · por {item.actorEmail}</small></span><span className="activity-time">{relativeTime(item.createdAt)}</span></Link>) : <div className="dashboard-empty"><strong>No hay actividad que mostrar</strong><p>{activityCategory !== "ALL" || query ? "No hay eventos que coincidan con estos filtros." : "El registro aparecerá cuando alguien realice cambios en los proyectos con acceso de auditoría."}</p></div>}</article>}

        {section === "Ajustes" && <><div className="settings-layout"><article className="panel settings-panel"><div className="panel-heading"><div><h2>Conexión con el backend</h2><p>Dirección de la API Spring Boot.</p></div><span className="connection-badge"><i /> Sesión protegida</span></div><label className="settings-label" htmlFor="api-url">URL base de la API</label><div className="api-url-input"><span>⌘</span><input id="api-url" type="url" value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} /></div><p className="settings-help">La URL se guarda en este navegador y también puedes configurarla en <code>.env.local</code> como <code>NEXT_PUBLIC_API_URL</code>. Valor actual por defecto: <code>{API_BASE_URL}</code>.</p><div className="settings-divider" /><div className="settings-info"><span className="info-icon">i</span><p><strong>Datos con acceso controlado</strong><br />El dashboard solo recibe proyectos autorizados por la sesión y muestra ejecuciones persistidas en CDCI.</p></div><div className="settings-footer"><span>Configuración local del frontend</span><button className="primary-button" onClick={() => { const value = apiUrl.trim().replace(/\/+$/, ""); setApiUrl(value); window.localStorage.setItem("cdci.apiBaseUrl", value); showNotice("URL de la API guardada en este navegador."); void refreshDashboard(); }}>Guardar cambios</button></div></article><article className="panel integration-panel"><div className="integration-mark">⌘</div><h2>GitHub</h2><p>GitHub es el proveedor de repositorios configurado para esta instalación.</p><Link className="secondary-button" href="/projects">Configurar integración <Icon name="arrow" size={14} /></Link></article></div><ChangePasswordForm /></>}

        {section === "Ajustes" && <article className="panel settings-panel operational-health-panel"><div className="panel-heading"><div><h2>Salud del servicio</h2><p>Verificación de disponibilidad de la API y PostgreSQL.</p></div><button className="secondary-button" onClick={() => void refreshOperationalHealth()} disabled={healthChecking}>{healthChecking ? "Consultando…" : "Consultar"}</button></div><div className="operational-health-result" role="status"><i className={operationalHealth?.status === "UP" ? "is-up" : "is-down"} /><strong>{operationalHealth?.status === "UP" ? "Operativo" : healthChecking ? "Consultando" : "No disponible"}</strong><span>API · base de datos</span></div>{healthError && <p className="operational-health-error" role="alert">{healthError}</p>}<small className="operational-health-time">{healthCheckedAt ? `Última consulta: ${new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(healthCheckedAt))}` : "Sin consultas en esta sesión"}</small></article>}
        <footer className="app-footer"><span>© 2026 CDCI</span><span><i className="footer-status" /> API {error ? "sin conexión" : "conectada"}</span><Link href="/projects">Ayuda y proyectos</Link></footer>
      </div>
    </section>
    {notice && <div className="toast" role="status"><span>i</span>{notice}<button aria-label="Cerrar notificación" onClick={() => setNotice("")}>×</button></div>}
  </main>;
}

