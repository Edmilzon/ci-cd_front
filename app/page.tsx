"use client";

import { useMemo, useState } from "react";

type Section = "Resumen" | "Pipelines" | "Despliegues" | "Actividad" | "Ajustes";
type Status = "Exitoso" | "Fallido" | "En curso";
type Pipeline = {
  name: string;
  repository: string;
  branch: string;
  commit: string;
  status: Status;
  time: string;
  duration: string;
  color: string;
};

const pipelines: Pipeline[] = [
  { name: "API de usuarios", repository: "acme / users-api", branch: "main", commit: "feat: añade autenticación OAuth", status: "Exitoso", time: "hace 4 min", duration: "2m 18s", color: "violet" },
  { name: "Web principal", repository: "acme / web-app", branch: "feat/dashboard", commit: "fix: ajusta el menú responsive", status: "En curso", time: "hace 8 min", duration: "1m 42s", color: "blue" },
  { name: "Infraestructura", repository: "acme / platform-infra", branch: "main", commit: "chore: actualiza imagen de Node", status: "Fallido", time: "hace 23 min", duration: "48s", color: "orange" },
  { name: "Servicio de pagos", repository: "acme / payments", branch: "release/2.4", commit: "release: prepara versión 2.4.0", status: "Exitoso", time: "hace 39 min", duration: "3m 06s", color: "pink" },
];

const activity = [
  { icon: "✓", tone: "success", title: "API de usuarios desplegada", detail: "Producción · main · por María Rojas", time: "hace 4 min" },
  { icon: "↗", tone: "running", title: "Web principal en ejecución", detail: "Preview · feat/dashboard · por Luis Vega", time: "hace 8 min" },
  { icon: "!", tone: "failure", title: "Infraestructura falló", detail: "CI · main · por Diego Flores", time: "hace 23 min" },
];

const sections: { name: Section; icon: string }[] = [
  { name: "Resumen", icon: "grid" },
  { name: "Pipelines", icon: "flow" },
  { name: "Despliegues", icon: "cloud" },
  { name: "Actividad", icon: "clock" },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>,
    flow: <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v5a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v-1"/><path d="M6 12h.01"/></>,
    cloud: <><path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 8.5c0 .17.01.34.03.5A4.5 4.5 0 0 0 7 18Z"/><path d="m9 14 3 3 3-3M12 17v-6"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    branch: <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8M18 16a8 8 0 0 0-8-8H8"/></>,
    external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}

function StatusPill({ status }: { status: Status }) {
  const icon = status === "Exitoso" ? "✓" : status === "Fallido" ? "×" : "";
  return <span className={`status-pill status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status === "En curso" ? <i className="status-spinner" /> : <b>{icon}</b>}{status}</span>;
}

function PipelineTable({ items, onOpen }: { items: Pipeline[]; onOpen: () => void }) {
  return <div className="pipeline-list">
    {items.length ? items.map((pipeline) => <button className="pipeline-row" key={pipeline.name} onClick={onOpen}>
      <span className={`repo-mark ${pipeline.color}`}>{pipeline.name.slice(0, 1)}</span>
      <span className="pipeline-info"><strong>{pipeline.name}</strong><small>{pipeline.repository} <span>·</span> <span className="branch"><Icon name="branch" size={12} /> {pipeline.branch}</span></small></span>
      <span className="pipeline-commit">{pipeline.commit}</span>
      <StatusPill status={pipeline.status} />
      <span className="pipeline-time">{pipeline.time}<small>{pipeline.duration}</small></span>
      <span className="row-arrow"><Icon name="arrow" size={16} /></span>
    </button>) : <div className="empty-state">No encontramos pipelines con esos filtros.</div>}
  </div>;
}

export default function Home() {
  const [section, setSection] = useState<Section>("Resumen");
  const [statusFilter, setStatusFilter] = useState<"Todos" | Status>("Todos");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  const filteredPipelines = useMemo(() => pipelines.filter((pipeline) => {
    const matchesStatus = statusFilter === "Todos" || pipeline.status === statusFilter;
    const haystack = `${pipeline.name} ${pipeline.repository} ${pipeline.branch} ${pipeline.commit}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  }), [statusFilter, query]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  }

  const pageTitles: Record<Section, { title: string; subtitle: string }> = {
    Resumen: { title: "Resumen", subtitle: "Aquí está el estado de tus entregas." },
    Pipelines: { title: "Pipelines", subtitle: "Busca y revisa las ejecuciones recientes de tu equipo." },
    Despliegues: { title: "Despliegues", subtitle: "Entornos y versiones publicadas recientemente." },
    Actividad: { title: "Actividad", subtitle: "Los últimos cambios en tus repositorios." },
    Ajustes: { title: "Ajustes", subtitle: "Configura la conexión con tu backend Spring Boot." },
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#inicio" onClick={(event) => { event.preventDefault(); setSection("Resumen"); }}>
        <span className="brand-symbol"><i /><i /><i /></span>
        <span className="brand-name">nexo<span>.</span></span>
        <span className="brand-tag">CI/CD</span>
      </a>
      <div className="workspace-switcher">
        <span className="workspace-avatar">A</span>
        <span className="workspace-copy"><strong>Acme Studio</strong><small>Espacio de trabajo</small></span>
        <span className="chevron">⌄</span>
      </div>
      <div className="nav-label">ESPACIO DE TRABAJO</div>
      <nav className="main-nav" aria-label="Navegación principal">
        {sections.map(({ name, icon }) => <button key={name} className={`nav-item ${section === name ? "active" : ""}`} onClick={() => setSection(name)}><Icon name={icon} /><span>{name}</span>{name === "Pipelines" && <span className="nav-count">4</span>}</button>)}
      </nav>
      <div className="nav-label projects-label">PROYECTOS <button aria-label="Añadir proyecto" onClick={() => showNotice("La conexión de repositorios estará disponible al definir los endpoints del backend.")}>+</button></div>
      <div className="project-nav">
        <button onClick={() => setSection("Pipelines")}><span className="project-dot dot-violet" /> Plataforma web <span className="project-chevron">···</span></button>
        <button onClick={() => setSection("Pipelines")}><span className="project-dot dot-teal" /> API de usuarios</button>
        <button onClick={() => setSection("Pipelines")}><span className="project-dot dot-amber" /> Infraestructura</button>
      </div>
      <div className="sidebar-bottom">
        <div className="upgrade-card"><span className="upgrade-spark">✳</span><strong>Todo listo para crecer</strong><p>Conecta tu repositorio y automatiza tu próximo despliegue.</p><button onClick={() => showNotice("Pronto podrás conectar GitHub y GitLab desde aquí.")}>Ver integraciones <Icon name="arrow" size={14} /></button></div>
        <button className={`nav-item settings-link ${section === "Ajustes" ? "active" : ""}`} onClick={() => setSection("Ajustes")}><Icon name="settings" /><span>Ajustes</span></button>
        <div className="user-profile"><span className="user-avatar">MR</span><span className="user-copy"><strong>María Rojas</strong><small>Administradora</small></span><button aria-label="Opciones de perfil" onClick={() => showNotice("Sesión de demostración")}>···</button></div>
      </div>
    </aside>

    <section className="main-panel">
      <header className="topbar">
        <div className="breadcrumbs"><span>Acme Studio</span><b>/</b><strong>{section}</strong></div>
        <div className="topbar-actions">
          <label className="search-box"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pipelines..." /><kbd>⌘ K</kbd></label>
          <button className="icon-button notification-button" aria-label="Notificaciones" onClick={() => showNotice("No tienes notificaciones nuevas.")}><Icon name="bell" size={18} /><i /></button>
          <span className="top-avatar">MR</span>
        </div>
      </header>

      <div className="content-wrap">
        <div className="page-heading">
          <div><div className="eyebrow">JUEVES, 9 DE OCTUBRE DE 2026 <span className="live-dot" /></div><h1>{section === "Resumen" ? "Hola, equipo" : pageTitles[section].title}<span className="wave">{section === "Resumen" ? "✳" : ""}</span></h1><p>{pageTitles[section].subtitle}</p></div>
          <div className="heading-actions"><span className="demo-badge"><i /> MODO DEMO</span><button className="primary-button" onClick={() => showNotice("El backend aún no expone un endpoint para iniciar pipelines.")}><Icon name="plus" size={17} /> Nuevo pipeline</button></div>
        </div>

        <div className="demo-note"><span className="demo-note-icon">i</span><span>Estás viendo datos de muestra. El backend Spring Boot aún no define endpoints de pipelines.</span><button onClick={() => setSection("Ajustes")}>Configurar conexión <Icon name="arrow" size={13} /></button></div>

        {section === "Resumen" && <>
          <div className="stats-grid">
            <article className="stat-card"><div className="stat-head"><span>Ejecuciones de hoy</span><span className="stat-icon purple"><Icon name="flow" size={17} /></span></div><div className="stat-value">24 <span className="trend positive">↗ 18.6%</span></div><div className="stat-foot">vs. 20 ayer <span>·</span> <span className="mini-bars"><i /><i /><i /><i /><i /><i /><i /></span></div></article>
            <article className="stat-card"><div className="stat-head"><span>Despliegues</span><span className="stat-icon green"><Icon name="cloud" size={17} /></span></div><div className="stat-value">7 <span className="trend positive">↗ 2</span></div><div className="stat-foot">en los últimos 7 días <span>·</span> <span className="stat-caption">3 a producción</span></div></article>
            <article className="stat-card"><div className="stat-head"><span>Tasa de éxito</span><span className="stat-icon blue"><span className="check-stat">✓</span></span></div><div className="stat-value">94.2<span className="percent">%</span> <span className="trend positive">↗ 2.4%</span></div><div className="stat-foot">últimos 30 días <span>·</span> <span className="stat-caption">sobre el objetivo</span></div></article>
            <article className="stat-card"><div className="stat-head"><span>Tiempo de despliegue</span><span className="stat-icon orange"><Icon name="clock" size={17} /></span></div><div className="stat-value">4<span className="unit">m</span> 32<span className="unit">s</span> <span className="trend positive">↘ 12%</span></div><div className="stat-foot">mediana <span>·</span> <span className="stat-caption">últimos 30 días</span></div></article>
          </div>

          <div className="dashboard-grid">
            <article className="panel chart-panel"><div className="panel-heading"><div><h2>Actividad de pipelines</h2><p>Ejecuciones durante la última semana</p></div><select aria-label="Rango del gráfico" defaultValue="7 días"><option>7 días</option><option>30 días</option></select></div>
              <div className="chart-legend"><span><i className="legend-success" /> Exitosos</span><span><i className="legend-failed" /> Fallidos</span></div>
              <div className="chart-area"><div className="chart-y-labels"><span>40</span><span>30</span><span>20</span><span>10</span><span>0</span></div><div className="chart-plot"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><svg className="chart-svg" viewBox="0 0 720 190" preserveAspectRatio="none" role="img" aria-label="Gráfico de actividad de pipelines"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#755cf6" stopOpacity=".18"/><stop offset="100%" stopColor="#755cf6" stopOpacity="0"/></linearGradient></defs><path className="chart-area-fill" d="M0,124 C38,116 57,129 90,105 S143,87 180,106 S232,78 270,73 S323,105 360,75 S415,62 450,82 S500,95 540,54 S595,63 630,43 S681,52 720,24 L720,190 L0,190Z"/><path className="chart-line" d="M0,124 C38,116 57,129 90,105 S143,87 180,106 S232,78 270,73 S323,105 360,75 S415,62 450,82 S500,95 540,54 S595,63 630,43 S681,52 720,24"/><path className="chart-failed" d="M0,171 C38,173 57,158 90,169 S143,156 180,166 S232,154 270,162 S323,151 360,160 S415,154 450,164 S500,147 540,159 S595,150 630,163 S681,145 720,154"/><circle cx="540" cy="54" r="4" className="chart-point" /></svg><div className="chart-x-labels"><span>Vie 3</span><span>Sáb 4</span><span>Dom 5</span><span>Lun 6</span><span>Mar 7</span><span>Mié 8</span><span>Jue 9</span></div></div></div>
            </article>
            <article className="panel health-panel"><div className="panel-heading"><div><h2>Salud de despliegues</h2><p>Entornos activos</p></div><button className="more-button" aria-label="Más opciones" onClick={() => setSection("Despliegues")}>···</button></div>
              <div className="health-summary"><div className="health-ring"><div><strong>3</strong><span>activos</span></div></div><div className="health-copy"><strong>Todo en orden</strong><span><i className="health-dot prod" /> 2 producción</span><span><i className="health-dot stage" /> 1 staging</span></div></div>
              <div className="environment-list"><div><span className="env-icon prod-icon">⌂</span><span><strong>Producción</strong><small>api.acme.io</small></span><span className="env-state"><i /> Activo</span></div><div><span className="env-icon stage-icon">◇</span><span><strong>Staging</strong><small>staging.acme.io</small></span><span className="env-state"><i /> Activo</span></div></div>
              <button className="text-link" onClick={() => setSection("Despliegues")}>Ver despliegues <Icon name="arrow" size={14} /></button>
            </article>
          </div>

          <article className="panel recent-panel"><div className="panel-heading"><div><h2>Ejecuciones recientes</h2><p>La actividad más reciente de tus pipelines</p></div><button className="secondary-button" onClick={() => setSection("Pipelines")}>Ver todos <Icon name="arrow" size={14} /></button></div><PipelineTable items={pipelines.slice(0, 4)} onOpen={() => showNotice("El detalle estará disponible al conectar el backend.")} /></article>
        </>}

        {section === "Pipelines" && <article className="panel full-list-panel"><div className="panel-heading"><div><h2>Todos los pipelines</h2><p>4 ejecuciones recientes <span className="sample-dot">· datos de muestra</span></p></div><div className="filter-select"><label htmlFor="status-filter">Estado</label><select id="status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "Todos" | Status)}><option>Todos</option><option>Exitoso</option><option>Fallido</option><option>En curso</option></select></div></div><PipelineTable items={filteredPipelines} onOpen={() => showNotice("El detalle estará disponible al conectar el backend.")} /></article>}

        {section === "Despliegues" && <div className="deployments-layout"><article className="panel environments-panel"><div className="panel-heading"><div><h2>Entornos</h2><p>3 entornos configurados en modo demostración</p></div><button className="secondary-button" onClick={() => showNotice("Los entornos se cargarán desde el backend.")}><Icon name="plus" size={15} /> Añadir entorno</button></div><div className="environment-cards"><div className="environment-card"><div className="environment-card-head"><span className="env-icon prod-icon">⌂</span><span className="env-state"><i /> Activo</span></div><h3>Producción</h3><p>Entorno principal de clientes</p><div className="env-url">https://api.acme.io <Icon name="external" size={14} /></div><div className="env-deployed"><span>Último despliegue</span><strong>v2.4.0 <small>hace 4 horas</small></strong></div></div><div className="environment-card"><div className="environment-card-head"><span className="env-icon stage-icon">◇</span><span className="env-state"><i /> Activo</span></div><h3>Staging</h3><p>Pruebas antes de producción</p><div className="env-url">https://staging.acme.io <Icon name="external" size={14} /></div><div className="env-deployed"><span>Último despliegue</span><strong>build #184 <small>hace 36 min</small></strong></div></div><div className="environment-card preview-card"><div className="environment-card-head"><span className="env-icon preview-icon">◈</span><span className="env-state"><i /> Activo</span></div><h3>Preview</h3><p>Entornos efímeros por pull request</p><div className="env-url">preview.acme.io <Icon name="external" size={14} /></div><div className="env-deployed"><span>Entornos activos</span><strong>4 previews <small>automáticos</small></strong></div></div></div></article><article className="panel timeline-panel"><div className="panel-heading"><div><h2>Historial de despliegues</h2><p>Publicaciones recientes</p></div></div>{activity.slice(0, 2).map((item) => <div className="activity-item" key={item.title}><span className={`activity-icon ${item.tone}`}>{item.icon}</span><span className="activity-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><span className="activity-time">{item.time}</span></div>)}</article></div>}

        {section === "Actividad" && <article className="panel activity-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Eventos en tu espacio de trabajo <span className="sample-dot">· datos de muestra</span></p></div><button className="secondary-button" onClick={() => showNotice("Mostrando todos los eventos disponibles.")}>Últimos 7 días <span className="chevron">⌄</span></button></div><div className="activity-date">HOY, 9 DE OCTUBRE</div>{activity.map((item) => <div className="activity-item" key={item.title}><span className={`activity-icon ${item.tone}`}>{item.icon}</span><span className="activity-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><span className="activity-time">{item.time}</span></div>)}</article>}

        {section === "Ajustes" && <div className="settings-layout"><article className="panel settings-panel"><div className="panel-heading"><div><h2>Conexión con el backend</h2><p>Define la dirección de tu API Spring Boot.</p></div><span className="connection-badge"><i /> Sin conectar</span></div><label className="settings-label" htmlFor="api-url">URL base de la API</label><div className="api-url-input"><span>⌘</span><input id="api-url" readOnly value={process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"} /></div><p className="settings-help">Configúrala en <code>.env.local</code> como <code>NEXT_PUBLIC_API_URL</code>. Por defecto se usa <code>http://localhost:8080</code>.</p><div className="settings-divider" /><div className="settings-info"><span className="info-icon">i</span><p><strong>La API aún no está disponible</strong><br />El backend actual solo incluye la aplicación inicial de Spring Boot. Cuando se añadan endpoints, esta interfaz podrá consumirlos desde el servicio <code>src/lib/api.ts</code>.</p></div><div className="settings-footer"><span>Configuración local del frontend</span><button className="primary-button" onClick={() => showNotice("Guarda NEXT_PUBLIC_API_URL en cdci_front/.env.local para aplicar el cambio.")}>Guardar cambios</button></div></article><article className="panel integration-panel"><div className="integration-mark">↗</div><h2>Conecta tus repositorios</h2><p>Automatiza los builds al recibir cambios en GitHub o GitLab.</p><button className="secondary-button" onClick={() => showNotice("La integración estará disponible al crear su endpoint en el backend.")}>Configurar integración <Icon name="arrow" size={14} /></button><span className="integration-coming">PRÓXIMAMENTE</span></article></div>}

        <footer className="app-footer"><span>© 2026 Nexo CI/CD</span><span><i className="footer-status" /> Todos los sistemas operativos</span><button onClick={() => showNotice("Nexo CI/CD · Proyecto de demostración")}>Ayuda y documentación</button></footer>
      </div>
    </section>
    {notice && <div className="toast" role="status"><span>i</span>{notice}<button aria-label="Cerrar notificación" onClick={() => setNotice("")}>×</button></div>}
  </main>;
}
