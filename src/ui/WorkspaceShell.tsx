"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/src/auth/AuthProvider";

function WorkspaceIcon({ name }: { name: "home" | "projects" | "pipelines" | "users" | "roles" | "audit" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const paths = {
    home: <><path d="m3.5 10 8.5-7 8.5 7" /><path d="M5.5 9v11h13V9M9.5 20v-6h5v6" /></>,
    projects: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    pipelines: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><path d="M6 7v5a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3" /><path d="M6 12h.01" /></>,
    users: <><path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20" /><circle cx="9.5" cy="7" r="3.5" /><path d="M17 11a3.5 3.5 0 1 0-1-6.8M17 15h.6a3.4 3.4 0 0 1 3.4 3.4V20" /></>,
    roles: <><path d="m12 3 8 3v5c0 5.1-3.4 8.5-8 10-4.6-1.5-8-4.9-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    audit: <><path d="M4 5h16M4 12h16M4 19h10" /><circle cx="18" cy="19" r="2.5" /><path d="M18 17.5v1.7l1 .6" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function initials(name: string | undefined) {
  return name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    ADMIN: "Administrador",
    OWNER: "Propietario",
    MAINTAINER: "Mantenedor",
    DEVELOPER: "Desarrollador",
    VIEWER: "Lector",
  };
  return labels[role] ?? role;
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const projectHref = projectId ? `/projects/${projectId}` : "";
  const canSeeAdmin = user?.permissions?.some((permission) => ["USER_READ", "ROLE_READ", "AUDIT_READ"].includes(permission)) ?? false;
  const avatar = initials(user?.fullName);

  return <div className="app-shell workspace-shell">
    <aside className="sidebar workspace-sidebar">
      <Link className="brand" href="/" aria-label="CDCI, ir al resumen">
        <span className="brand-symbol"><i /><i /><i /></span>
        <span className="brand-name">cdci<span>.</span></span>
        <span className="brand-tag">CI/CD</span>
      </Link>

      <div className="workspace-switcher">
        <span className="workspace-avatar">{avatar.slice(0, 1)}</span>
        <span className="workspace-copy"><strong>{user?.fullName ?? "Cuenta CDCI"}</strong><small>Espacio de trabajo</small></span>
      </div>

      <div className="nav-label">ESPACIO DE TRABAJO</div>
      <nav className="main-nav" aria-label="Navegación principal">
        <Link className={`nav-item ${pathname === "/" ? "active" : ""}`} href="/"><WorkspaceIcon name="home" /><span>Resumen</span></Link>
        <Link className={`nav-item ${pathname.startsWith("/projects") ? "active" : ""}`} href="/projects"><WorkspaceIcon name="projects" /><span>Proyectos</span></Link>
      </nav>

      {projectId && <>
        <div className="nav-label projects-label"><span>PROYECTO ACTUAL</span></div>
        <nav className="project-nav" aria-label="Navegación del proyecto">
          <Link className={`project-nav-link ${pathname === projectHref ? "is-current" : ""}`} href={projectHref}><span className="project-dot dot-violet" /> Resumen del proyecto <span className="project-chevron">↗</span></Link>
          <Link className={`project-nav-link ${pathname.endsWith("/pipelines") ? "is-current" : ""}`} href={`${projectHref}/pipelines`}><span className="project-dot dot-teal" /> Pipelines <span className="project-chevron">↗</span></Link>
        </nav>
      </>}

      {canSeeAdmin && <>
        <div className="nav-label admin-nav-label">ADMINISTRACIÓN</div>
        <nav className="main-nav" aria-label="Administración">
          {user?.permissions.includes("USER_READ") && <Link className={`nav-item ${pathname === "/admin/users" ? "active" : ""}`} href="/admin/users"><WorkspaceIcon name="users" /><span>Usuarios</span></Link>}
          {user?.permissions.includes("ROLE_READ") && <Link className={`nav-item ${pathname === "/admin/roles" ? "active" : ""}`} href="/admin/roles"><WorkspaceIcon name="roles" /><span>Roles y permisos</span></Link>}
          {user?.permissions.includes("AUDIT_READ") && <Link className={`nav-item ${pathname === "/admin/audit" ? "active" : ""}`} href="/admin/audit"><WorkspaceIcon name="audit" /><span>Auditoría</span></Link>}
        </nav>
      </>}

      <div className="sidebar-bottom">
        <div className="upgrade-card"><span className="upgrade-spark">⌘</span><strong>Tu espacio CDCI</strong><p>Gestiona proyectos, pipelines y servidores en un solo lugar.</p><Link href="/projects">Abrir proyectos <span aria-hidden="true">↗</span></Link></div>
        <div className="user-profile"><span className="user-avatar">{avatar}</span><span className="user-copy"><strong>{user?.fullName ?? "Usuario"}</strong><small>{user?.roles.map(roleLabel).join(", ") || "CDCI"}</small></span><button aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => void signOut()}>↗</button></div>
      </div>
    </aside>

    <section className="main-panel workspace-main-panel">{children}</section>
  </div>;
}
