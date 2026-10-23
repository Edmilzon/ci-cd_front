"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/src/auth/AuthProvider";
import { ApiError } from "@/src/lib/api";
import { beginGitHubConnection, createProject, getGitHubConnection, getProjects, type GitHubConnection, type Project } from "@/src/lib/project-api";
import { deferEffect } from "@/src/lib/defer-effect";
import { WorkspaceShell } from "@/src/ui/WorkspaceShell";

function messageOf(error: unknown) {
  return error instanceof ApiError ? error.message : "No pudimos completar la operación. Inténtalo nuevamente.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

const roleNames: Record<string, string> = { OWNER: "Propietario", MAINTAINER: "Mantenedor", DEVELOPER: "Desarrollador", VIEWER: "Lector", ADMIN: "Administrador" };

export default function ProjectsPage() {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [github, setGithub] = useState<GitHubConnection | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rows, connection] = await Promise.all([getProjects(), getGitHubConnection()]);
      setProjects(rows);
      setGithub(connection);
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => deferEffect(() => { void load(); }), [load]);
  useEffect(() => deferEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("github") === "connected") {
      setNotice("GitHub quedó conectado a tu cuenta.");
      window.history.replaceState({}, "", "/projects");
      void getGitHubConnection().then(setGithub).catch(() => undefined);
    } else if (query.get("github") === "cancelled") {
      setNotice("La conexión con GitHub se canceló.");
      window.history.replaceState({}, "", "/projects");
    } else if (query.get("github") === "error") {
      setError("GitHub no pudo completar la conexión. Revisa la configuración de la App y vuelve a intentarlo.");
      window.history.replaceState({}, "", "/projects");
    }
  }), []);

  const visibleProjects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return projects.filter((project) => `${project.name} ${project.slug} ${project.description}`.toLowerCase().includes(needle));
  }, [projects, search]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createProject({ name, description });
      setName("");
      setDescription("");
      setFormOpen(false);
      setNotice("Proyecto creado. Ya puedes agregar sus repositorios y miembros.");
      await load();
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function connectGitHub() {
    setBusy(true);
    setError("");
    try {
      const { authorizationUrl } = await beginGitHubConnection();
      window.location.assign(authorizationUrl);
    } catch (requestError) {
      setError(messageOf(requestError));
      setBusy(false);
    }
  }

  return <WorkspaceShell><main className="projects-shell">
    <header className="projects-topbar">
      <Link className="projects-brand" href="/" aria-label="CDCI, volver al resumen"><span className="brand-symbol"><i /><i /><i /></span><strong>cdci<span>.</span></strong></Link>
      <nav aria-label="Ruta"><Link href="/">Resumen</Link><span>/</span><strong>Proyectos</strong></nav>
      <div className="projects-account"><span>{user?.fullName}</span><button onClick={() => void signOut()}>Salir</button></div>
    </header>

    <div className="projects-content">
      <div className="projects-heading">
        <div><span className="projects-eyebrow">ESPACIO DE TRABAJO</span><h1>Proyectos</h1><p>Organiza repositorios y accesos por producto o equipo.</p></div>
        <button className="projects-primary" onClick={() => { setError(""); setFormOpen(true); }}>＋ Crear proyecto</button>
      </div>

      <section className="github-banner">
        <span className="github-mark" aria-hidden="true">⌘</span>
        <div className="github-banner-copy"><strong>{github?.connected ? `GitHub conectado · @${github.githubLogin}` : "Conecta tu cuenta de GitHub"}</strong><span>{github?.connected ? "Puedes ver y elegir únicamente repositorios autorizados para CDCI." : "Vincula repositorios privados o públicos con acceso limitado y tokens cifrados."}</span></div>
        <button className={github?.connected ? "projects-secondary" : "projects-dark"} onClick={() => void connectGitHub()} disabled={busy}>
          {busy ? "Conectando…" : github?.connected ? "Volver a conectar" : "Conectar GitHub"}
        </button>
      </section>

      {error && <div className="projects-alert" role="alert"><span>!</span>{error}<button onClick={() => setError("")} aria-label="Cerrar error">×</button></div>}
      {notice && <div className="projects-success" role="status">✓ {notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}

      <div className="projects-toolbar"><div><strong>{projects.length}</strong> {projects.length === 1 ? "proyecto" : "proyectos"}<span className="toolbar-dot">·</span><span>accesos por proyecto</span></div><label className="projects-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar proyecto" /></label></div>

      {loading ? <div className="projects-state"><span className="projects-spinner" /> Cargando proyectos…</div>
        : visibleProjects.length ? <div className="project-grid">{visibleProjects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
          : <div className="projects-empty"><span className="empty-project-mark">◇</span><h2>{search ? "No encontramos proyectos" : "Crea tu primer proyecto"}</h2><p>{search ? "Prueba con otro nombre o identificador." : "Agrupa un repositorio y comparte el acceso solo con las personas de este equipo."}</p>{!search && <button className="projects-primary" onClick={() => setFormOpen(true)}>Crear proyecto</button>}</div>}
    </div>

    {formOpen && <div className="project-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
      <form className="project-modal" onSubmit={(event) => void submit(event)} aria-labelledby="new-project-title">
        <div className="project-modal-heading"><div><span className="projects-eyebrow">NUEVO ESPACIO</span><h2 id="new-project-title">Crear proyecto</h2></div><button type="button" className="project-close" onClick={() => setFormOpen(false)} aria-label="Cerrar">×</button></div>
        <label>Nombre<input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Por ejemplo, Plataforma web" /></label>
        <label>Descripción <span>Opcional</span><textarea maxLength={1000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Qué construye este proyecto y quién lo mantiene" /></label>
        {error && <div className="project-form-error" role="alert">{error}</div>}
        <div className="project-modal-footer"><button type="button" className="projects-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button className="projects-primary" disabled={busy || !name.trim()}>{busy ? "Creando…" : "Crear proyecto"}</button></div>
      </form>
    </div>}
  </main></WorkspaceShell>;
}

function ProjectCard({ project }: { project: Project }) {
  return <Link className="project-card" href={`/projects/${project.id}`}>
    <div className="project-card-top"><span className="project-card-icon">{project.name.trim().slice(0, 1).toUpperCase()}</span><span className="project-access">{roleNames[project.accessLevel] ?? project.accessLevel}</span></div>
    <h2>{project.name}</h2><p className="project-slug">/{project.slug}</p>
    <p className="project-description">{project.description || "Sin descripción todavía."}</p>
    <div className="project-card-meta"><span>⌘ {project.repositoryCount} {project.repositoryCount === 1 ? "repositorio" : "repositorios"}</span><span>♧ {project.memberCount} {project.memberCount === 1 ? "miembro" : "miembros"}</span></div>
    <div className="project-card-footer"><span>Actualizado {formatDate(project.updatedAt)}</span><span className="project-card-arrow">↗</span></div>
  </Link>;
}
