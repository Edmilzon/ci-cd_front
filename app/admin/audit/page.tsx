"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/src/auth/AuthProvider";
import { ApiError } from "@/src/lib/api";
import { getAuditEvents, type AuditEvent, type PageResponse } from "@/src/lib/admin-api";
import { deferEffect } from "@/src/lib/defer-effect";

const actionNames: Record<string, string> = {
  USER_ENABLED: "Cuenta habilitada",
  USER_DISABLED: "Cuenta suspendida",
  USER_ROLES_CHANGED: "Roles actualizados",
  ROLE_CREATED: "Rol creado",
  ROLE_UPDATED: "Rol actualizado",
  ROLE_DELETED: "Rol eliminado",
  ROLE_PERMISSIONS_CHANGED: "Permisos actualizados",
};

export default function AdminAuditPage() {
  const { user } = useAuth();
  const [result, setResult] = useState<PageResponse<AuditEvent> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setResult(await getAuditEvents(page)); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "No pudimos cargar el registro de acceso."); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => deferEffect(() => { void load(); }), [load]);

  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-back" href="/">← Volver al dashboard</Link><span>Administración de acceso</span><span className="admin-user-chip">{user?.fullName}</span></header>
    <div className="admin-content">
      <div className="admin-heading"><div><p className="admin-eyebrow">TRAZABILIDAD</p><h1>Auditoría de acceso</h1><p>Historial de cambios de usuarios, roles y permisos.</p></div><span className="admin-count"><strong>{result?.totalElements ?? "—"}</strong><small>eventos</small></span></div>
      <section className="admin-panel">
        {error && <p className="admin-alert" role="alert">{error}</p>}
        {loading ? <div className="admin-empty">Cargando eventos…</div> : result?.content.length ? <div className="audit-list">{result.content.map((event) => <article className="audit-event" key={event.id}><span className="audit-event-mark">↗</span><div className="audit-event-copy"><div><strong>{actionNames[event.action] ?? event.action}</strong><span>{event.targetType} · {event.targetId}</span></div><p>{event.summary}</p><small>Por {event.actorEmail}</small></div><time dateTime={event.createdAt}>{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}</time></article>)}</div> : <div className="admin-empty">Todavía no hay cambios de acceso registrados.</div>}
        <div className="admin-pagination"><span>{result ? `Página ${result.page + 1} de ${Math.max(result.totalPages, 1)}` : ""}</span><div><button disabled={!result || result.page <= 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))}>Anterior</button><button disabled={!result || result.page + 1 >= result.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div></div>
      </section>
      <p className="admin-footnote"><Link href="/admin/users">Usuarios</Link> <span>·</span> <Link href="/admin/roles">Roles y permisos</Link></p>
    </div>
  </main>;
}
