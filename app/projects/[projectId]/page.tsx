"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/src/lib/api";
import { useAuth } from "@/src/auth/AuthProvider";
import { deferEffect } from "@/src/lib/defer-effect";
import ProjectSecretsPanel from "./secrets-panel";
import ProjectServersPanel from "./servers-panel";
import ProjectDeploymentsPanel from "./deployments-panel";
import ProjectActivityPanel from "./activity-panel";
import { addProjectMember, addProjectRepository, archiveProject, beginGitHubConnection, checkProjectRepositoryReadiness, disconnectGitHub, getGitHubConnection, getGitHubRepositories, getProject, getProjectMembers, getProjectRepositories, removeProjectMember, removeProjectRepository, updateProject, updateProjectMember, type GitHubConnection, type GitHubRepository, type GitHubRepositoryPage, type Project, type ProjectMember, type ProjectRepository, type RepositoryReadiness, type ProjectRole } from "@/src/lib/project-api";

const accessNames: Record<string, string> = { OWNER: "Propietario", MAINTAINER: "Mantenedor", DEVELOPER: "Desarrollador", VIEWER: "Lector", ADMIN: "Administrador" };
const allRoles: ProjectRole[] = ["OWNER", "MAINTAINER", "DEVELOPER", "VIEWER"];

function errorMessage(error: unknown) { return error instanceof ApiError ? error.message : "No pudimos completar la operación. Inténtalo nuevamente."; }
function dateLabel(value: string) { return new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)); }

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [repositories, setRepositories] = useState<ProjectRepository[]>([]);
  const [readinessByRepository, setReadinessByRepository] = useState<Record<string, RepositoryReadiness>>({});
  const [readinessErrors, setReadinessErrors] = useState<Record<string, string>>({});
  const [checkingRepositoryId, setCheckingRepositoryId] = useState<string | null>(null);
  const [github, setGithub] = useState<GitHubConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [repoDialogOpen, setRepoDialogOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<ProjectRole>("VIEWER");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError("");
    try {
      const [currentProject, currentMembers, currentRepositories, currentGitHub] = await Promise.all([
        getProject(projectId), getProjectMembers(projectId), getProjectRepositories(projectId), getGitHubConnection(),
      ]);
      setProject(currentProject);
      setEditName(currentProject.name);
      setEditDescription(currentProject.description);
      setMembers(currentMembers);
      setRepositories(currentRepositories);
      setGithub(currentGitHub);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => deferEffect(() => { void load(); }), [load]);

  const owner = project?.accessLevel === "OWNER" || project?.accessLevel === "ADMIN";
  const owners = useMemo(() => members.filter((member) => member.accessLevel === "OWNER").length, [members]);

  async function connectGitHub() {
    setBusy(true); setError("");
    try { const result = await beginGitHubConnection(); window.location.href = result.authorizationUrl; }
    catch (requestError) { setError(errorMessage(requestError)); setBusy(false); }
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!project) return;
    setBusy(true); setError("");
    try { await updateProject(project.id, { name: editName, description: editDescription }); setEditOpen(false); setNotice("Cambios guardados."); await load(); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  async function archive() {
    if (!project || !window.confirm(`¿Archivar “${project.name}”? Dejará de aparecer en la lista activa.`)) return;
    setBusy(true); setError("");
    try { await archiveProject(project.id); router.replace("/projects"); }
    catch (requestError) { setError(errorMessage(requestError)); setBusy(false); }
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!project) return;
    setBusy(true); setError("");
    try { await addProjectMember(project.id, memberEmail, memberRole); setMemberEmail(""); setMemberRole("VIEWER"); setNotice("Miembro agregado al proyecto."); await load(); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  async function changeMember(member: ProjectMember, accessLevel: ProjectRole) {
    if (!project) return;
    setBusy(true); setError("");
    try { await updateProjectMember(project.id, member.userId, accessLevel); setNotice(`Acceso de ${member.fullName} actualizado.`); await load(); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  async function kickMember(member: ProjectMember) {
    if (!project || !window.confirm(`¿Quitar a ${member.fullName} de este proyecto?`)) return;
    setBusy(true); setError("");
    try { await removeProjectMember(project.id, member.userId); setNotice("Miembro quitado del proyecto."); await load(); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  async function detachRepository(repository: ProjectRepository) {
    if (!project || !window.confirm(`¿Desconectar ${repository.fullName} del proyecto?`)) return;
    setBusy(true); setError("");
    try { await removeProjectRepository(project.id, repository.id); setNotice("Repositorio desconectado."); await load(); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  async function inspectRepository(repository: ProjectRepository) {
    if (!project) return;
    setCheckingRepositoryId(repository.id);
    setReadinessErrors((current) => ({ ...current, [repository.id]: "" }));
    try {
      const readiness = await checkProjectRepositoryReadiness(project.id, repository.id);
      setReadinessByRepository((current) => ({ ...current, [repository.id]: readiness }));
    } catch (requestError) {
      setReadinessErrors((current) => ({ ...current, [repository.id]: errorMessage(requestError) }));
    } finally {
      setCheckingRepositoryId(null);
    }
  }

  async function removeGitHubConnection() {
    setBusy(true); setError("");
    try { await disconnectGitHub(); setGithub({ connected: false, githubLogin: null, accessTokenExpiresAt: null }); setNotice("Cuenta de GitHub desconectada."); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }

  if (loading && !project) return <main className="projects-shell"><div className="projects-state"><span className="projects-spinner" /> Cargando proyecto…</div></main>;

  return <main className="projects-shell">
    <header className="projects-topbar"><Link className="projects-brand" href="/" aria-label="CDCI, volver al resumen"><span className="brand-symbol"><i /><i /><i /></span><strong>cdci<span>.</span></strong></Link><nav aria-label="Ruta"><Link href="/projects">Proyectos</Link><span>/</span><strong>{project?.name ?? "Proyecto"}</strong></nav><div className="projects-account"><span>{user?.fullName}</span><button onClick={() => void signOut()}>Salir</button></div></header>

    <div className="projects-content project-detail-content">
      <div className="project-back"><Link href="/projects">← Todos los proyectos</Link><span>{project && dateLabel(project.createdAt)}</span></div>
      <div className="project-detail-heading"><div className="project-title-mark">{project?.name.trim().slice(0, 1).toUpperCase() ?? "◇"}</div><div className="project-title-copy"><span className="projects-eyebrow">PROYECTO · {project?.slug}</span><h1>{project?.name ?? "Proyecto no disponible"}</h1><p>{project?.description || "Agrega una descripción para que el equipo conozca el propósito."}</p></div><div className="project-heading-actions"><span className="project-role-badge">{accessNames[project?.accessLevel ?? ""] ?? project?.accessLevel}</span>{project?.canManage && <button className="projects-secondary" onClick={() => document.getElementById("project-servers")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Servidores</button>}{project?.canManage && <button className="projects-secondary" onClick={() => setEditOpen(true)}>Editar proyecto</button>}{project?.canArchive && <button className="project-danger-outline" onClick={() => void archive()} disabled={busy}>Archivar</button>}</div></div>

      {error && <div className="projects-alert" role="alert"><span>!</span>{error}<button onClick={() => setError("")} aria-label="Cerrar error">×</button></div>}
      {notice && <div className="projects-success" role="status">✓ {notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}

      <div className="project-stats"><article><span>Repositorios</span><strong>{repositories.length}</strong></article><article><span>Miembros</span><strong>{members.length}</strong></article><article><span>Tu acceso</span><strong>{accessNames[project?.accessLevel ?? ""] ?? "—"}</strong></article></div>

      {project && <Link className="project-pipelines-link" href={`/projects/${project.id}/pipelines`}><span className="section-icon">⌘</span><span><strong>Configurar pipelines</strong><small>Define YAML, valida cambios y consulta el historial de versiones.</small></span><span className="project-card-arrow">↗</span></Link>}

      {project && <ProjectDeploymentsPanel projectId={project.id} canManage={project.canManage} />}

      {project?.canManage && <ProjectServersPanel projectId={project.id} />}

      {project?.canReadActivity && <ProjectActivityPanel projectId={project.id} />}

      {project?.canManage && <ProjectSecretsPanel projectId={project.id} />}

      <section className="project-section-card">
        <div className="project-section-heading"><div><span className="section-icon">⌘</span><div><h2>Repositorios</h2><p>Fuentes de código conectadas a este proyecto.</p></div></div>{project?.canManage && github?.connected && <button className="projects-primary" onClick={() => setRepoDialogOpen(true)}>＋ Agregar repositorio</button>}</div>
        {!github?.connected && <div className="project-github-callout"><div><strong>Conecta GitHub para seleccionar repositorios</strong><span>CDCI usará las credenciales autorizadas y las guardará cifradas.</span></div><button className="projects-dark" onClick={() => void connectGitHub()} disabled={busy}>{busy ? "Conectando…" : "Conectar GitHub"}</button></div>}
        {github?.connected && !repositories.length && <div className="project-section-empty"><span>⌘</span><strong>No hay repositorios conectados</strong><p>Agrega uno desde la lista de repositorios disponibles en @{github.githubLogin}.</p>{project?.canManage && <button className="projects-secondary" onClick={() => setRepoDialogOpen(true)}>Elegir repositorio</button>}</div>}
        {repositories.length > 0 && <div className="linked-repositories">{repositories.map((repository) => {
          const readiness = readinessByRepository[repository.id];
          const readinessError = readinessErrors[repository.id];
          return <div className="linked-repository-group" key={repository.id}>
            <article className="linked-repository"><span className="repo-avatar">⌘</span><div className="linked-repo-copy"><a href={repository.htmlUrl} target="_blank" rel="noreferrer">{repository.fullName} ↗</a><span>{repository.description || "Sin descripción"}</span></div><span className="repo-branch">⑂ {repository.defaultBranch}</span><span className={`repo-visibility ${repository.privateRepository ? "is-private" : ""}`}>{repository.privateRepository ? "Privado" : "Público"}</span>{project?.canManage && <div className="repository-actions"><button className="projects-secondary repository-readiness-trigger" onClick={() => void inspectRepository(repository)} disabled={checkingRepositoryId !== null || busy}>{checkingRepositoryId === repository.id ? "Revisando…" : readiness ? "Revisar otra vez" : "Revisar GitHub"}</button><button className="project-icon-button" aria-label={`Desconectar ${repository.fullName}`} title="Desconectar" onClick={() => void detachRepository(repository)} disabled={busy || checkingRepositoryId !== null}>×</button></div>}</article>
            {readinessError && <div className="repository-readiness-error" role="alert">{readinessError}</div>}
            {readiness && <section className="repository-readiness" aria-label={`Diagnóstico de ${readiness.repositoryName}`} aria-live="polite"><div className="repository-readiness-heading"><div><strong>Preparación de integración</strong><span>{readiness.repositoryName} · revisado {new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(readiness.checkedAt))}</span></div><span>{readiness.checks.filter((item) => item.status === "PASS").length}/{readiness.checks.length} verificaciones confirmadas</span></div><ul>{readiness.checks.map((item) => <li className={`readiness-check readiness-${item.status.toLowerCase()}`} key={item.code}><span className="readiness-check-icon" aria-hidden="true">{item.status === "PASS" ? "✓" : item.status === "WARNING" ? "!" : "·"}</span><div><strong>{item.title}</strong><span>{item.detail}</span></div><span className="readiness-check-state">{item.status === "PASS" ? "Correcto" : item.status === "WARNING" ? "Atención" : "Sin verificar"}</span></li>)}</ul><p>Las revisiones quedan en la actividad del proyecto. El acceso para desplegar se confirma al registrar el primer deployment en GitHub.</p></section>}
          </div>;
        })}</div>}
      </section>

      <section className="project-section-card">
        <div className="project-section-heading"><div><span className="section-icon members-icon">♧</span><div><h2>Equipo</h2><p>Los accesos se limitan a este proyecto.</p></div></div><span className="member-count">{members.length} {members.length === 1 ? "miembro" : "miembros"}</span></div>
        {project?.canManage && <form className="invite-member-form" onSubmit={(event) => void invite(event)}><label><span>Correo electrónico de una cuenta CDCI</span><input type="email" required maxLength={254} value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="persona@equipo.com" /></label><label><span>Acceso</span><select value={memberRole} onChange={(event) => setMemberRole(event.target.value as ProjectRole)}>{allRoles.filter((role) => owner || role !== "OWNER").map((role) => <option value={role} key={role}>{accessNames[role]}</option>)}</select></label><button className="projects-primary" disabled={busy || !memberEmail.trim()}>Agregar miembro</button></form>}
        <div className="project-members-list">{members.map((member) => {
          const protectedAccess = !owner && (member.accessLevel === "OWNER" || member.accessLevel === "MAINTAINER");
          const lastOwner = member.accessLevel === "OWNER" && owners <= 1;
          return <article className="project-member-row" key={member.userId}><span className="member-avatar">{member.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div className="member-identity"><strong>{member.fullName}</strong><span>{member.email}</span></div>{project?.canManage ? <div className="member-controls"><select aria-label={`Acceso para ${member.fullName}`} value={member.accessLevel} disabled={busy || protectedAccess || lastOwner} onChange={(event) => void changeMember(member, event.target.value as ProjectRole)}>{allRoles.filter((role) => owner || role !== "OWNER").map((role) => <option value={role} key={role}>{accessNames[role]}</option>)}</select><button className="project-icon-button" aria-label={`Quitar a ${member.fullName}`} title="Quitar del proyecto" disabled={busy || protectedAccess || lastOwner} onClick={() => void kickMember(member)}>×</button></div> : <span className="member-role-label">{accessNames[member.accessLevel]}</span>}</article>;
        })}</div>
      </section>

      <section className="project-provider-card"><span className="github-mark" aria-hidden="true">⌘</span><div><strong>{github?.connected ? `Conectado como @${github.githubLogin}` : "GitHub no conectado"}</strong><span>{github?.connected ? "La conexión pertenece a tu cuenta. Desconectarla requiere quitar antes los repositorios que agregaste." : "Conecta GitHub para consultar repositorios con acceso autorizado."}</span></div>{github?.connected ? <button className="project-danger-outline" onClick={() => void removeGitHubConnection()} disabled={busy}>Desconectar</button> : <button className="projects-secondary" onClick={() => void connectGitHub()} disabled={busy}>Conectar</button>}</section>
      <footer className="projects-footer">CDCI · Administración de proyectos y repositorios</footer>
    </div>

    {editOpen && project && <div className="project-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false); }}><form className="project-modal" onSubmit={(event) => void saveProject(event)}><div className="project-modal-heading"><div><span className="projects-eyebrow">CONFIGURACIÓN</span><h2>Editar proyecto</h2></div><button type="button" className="project-close" onClick={() => setEditOpen(false)} aria-label="Cerrar">×</button></div><label>Nombre<input required maxLength={100} value={editName} onChange={(event) => setEditName(event.target.value)} /></label><label>Descripción <span>Opcional</span><textarea rows={4} maxLength={1000} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} /></label>{error && <div className="project-form-error" role="alert">{error}</div>}<div className="project-modal-footer"><button type="button" className="projects-secondary" onClick={() => setEditOpen(false)}>Cancelar</button><button className="projects-primary" disabled={busy || !editName.trim()}>{busy ? "Guardando…" : "Guardar cambios"}</button></div></form></div>}

    {repoDialogOpen && project && <RepositoryPicker projectId={project.id} onClose={() => setRepoDialogOpen(false)} onAdded={async (repo) => { setNotice(`${repo.fullName} se agregó al proyecto.`); await load(); setRepoDialogOpen(false); }} />}
  </main>;
}

function RepositoryPicker({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: (repository: ProjectRepository) => Promise<void> }) {
  const [page, setPage] = useState<GitHubRepositoryPage | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const loadPage = useCallback(async (currentPage: number) => {
    setLoading(true); setError("");
    try { setPage(await getGitHubRepositories(currentPage)); setPageNumber(currentPage); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => deferEffect(() => { void loadPage(1); }), [loadPage]);
  const filtered = useMemo(() => (page?.items ?? []).filter((repo) => `${repo.fullName} ${repo.description} ${repo.language}`.toLowerCase().includes(query.trim().toLowerCase())), [page, query]);

  async function add(repository: GitHubRepository) {
    setBusyId(repository.id); setError("");
    try { const linked = await addProjectRepository(projectId, repository.id); await onAdded(linked); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusyId(null); }
  }

  return <div className="project-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="repo-picker-modal" role="dialog" aria-modal="true" aria-labelledby="repo-picker-title"><div className="project-modal-heading"><div><span className="projects-eyebrow">GITHUB · CONEXIÓN AUTORIZADA</span><h2 id="repo-picker-title">Agregar repositorio</h2></div><button className="project-close" onClick={onClose} aria-label="Cerrar">×</button></div><label className="repo-picker-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en los repositorios de GitHub" /></label>{error && <div className="project-form-error" role="alert">{error}</div>}{loading ? <div className="projects-state"><span className="projects-spinner" /> Cargando repositorios…</div> : <div className="repo-picker-list">{filtered.length ? filtered.map((repository) => <article className="repo-picker-row" key={repository.id}><span className="repo-avatar">⌘</span><div className="linked-repo-copy"><strong>{repository.fullName}</strong><span>{repository.description || repository.language || "Sin descripción"}</span></div><span className={`repo-visibility ${repository.privateRepository ? "is-private" : ""}`}>{repository.privateRepository ? "Privado" : "Público"}</span><button className="projects-secondary" onClick={() => void add(repository)} disabled={busyId !== null}>{busyId === repository.id ? "Agregando…" : "Agregar"}</button></article>) : <div className="project-section-empty"><strong>{query ? "No hay coincidencias en esta página" : "GitHub no devolvió repositorios"}</strong><p>{query ? "Prueba con otra búsqueda o cambia de página." : "Comprueba que la App de GitHub tenga permiso de lectura de metadatos y contenidos."}</p></div>}</div>}<div className="repo-picker-footer"><span>Página {pageNumber} · {page?.items.length ?? 0} repositorios</span><div><button className="projects-secondary" onClick={() => void loadPage(pageNumber - 1)} disabled={loading || pageNumber <= 1}>Anterior</button><button className="projects-secondary" onClick={() => void loadPage(pageNumber + 1)} disabled={loading || !page?.hasMore}>Siguiente</button></div></div></section></div>;
}
