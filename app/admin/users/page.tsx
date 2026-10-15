"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/src/auth/AuthProvider";
import { ApiError } from "@/src/lib/api";
import { getRoles, getUsers, updateUserRoles, updateUserStatus, type AdminUser, type PageResponse, type Role } from "@/src/lib/admin-api";
import { deferEffect } from "@/src/lib/defer-effect";

const roleNames: Record<string, string> = { ADMIN: "Administrador", MAINTAINER: "Mantenedor", DEVELOPER: "Desarrollador", VIEWER: "Lector" };

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "No pudimos cargar la administración. Revisa la conexión e inténtalo otra vez.";
}

export default function AdminUsersPage() {
  const { user: actor } = useAuth();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PageResponse<AdminUser> | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [users, availableRoles] = await Promise.all([getUsers(search, page), getRoles()]);
      setResult(users);
      setRoles(availableRoles);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => deferEffect(() => { void load(); }), [load]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(0);
    setSearch(query.trim());
  }

  async function changeStatus(account: AdminUser) {
    setBusyId(account.id);
    setError("");
    setNotice("");
    try {
      await updateUserStatus(account.id, !account.enabled);
      setNotice(account.enabled ? "Cuenta suspendida y sesiones cerradas." : "Cuenta habilitada.");
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId("");
    }
  }

  async function saveRoles(account: AdminUser, roleCodes: string[]) {
    setBusyId(account.id);
    setError("");
    setNotice("");
    try {
      await updateUserRoles(account.id, roleCodes);
      setNotice("Roles actualizados. Las sesiones de la cuenta se renovarán al volver a iniciar sesión.");
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId("");
    }
  }

  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-back" href="/">← Volver al dashboard</Link><span>Administración de acceso</span><span className="admin-user-chip">{actor?.fullName}</span></header>
    <div className="admin-content">
      <div className="admin-heading"><div><p className="admin-eyebrow">CONTROL DE ACCESO</p><h1>Usuarios</h1><p>Consulta cuentas, cambia su estado y asigna roles. Cada cambio invalida las sesiones afectadas.</p></div><span className="admin-count"><strong>{result?.totalElements ?? "—"}</strong><small>cuentas</small></span></div>
      <section className="admin-panel">
        <div className="admin-toolbar"><form className="admin-search" onSubmit={submitSearch}><label className="sr-only" htmlFor="user-search">Buscar usuarios</label><input id="user-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o correo…"/><button type="submit">Buscar</button></form><Link className="admin-secondary-link" href="/admin/roles">Ver roles y permisos →</Link></div>
        {error && <p className="admin-alert" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {loading ? <div className="admin-empty">Cargando usuarios…</div> : result?.content.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Cuenta</th><th>Roles</th><th>Estado</th><th>Creada</th><th>Acciones</th></tr></thead><tbody>{result.content.map((account) => <tr key={account.id}>
          <td><div className="admin-person"><span className="admin-avatar">{account.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span><strong>{account.fullName}</strong><small>{account.email}</small></span></div></td>
          <td><div className="role-badges">{account.roles.map((code) => <span className="role-badge" key={code}>{roleNames[code] ?? code}</span>)}</div><details className="role-editor"><summary>Editar roles</summary><RolePicker key={`${account.id}:${account.roles.join(",")}`} account={account} availableRoles={roles} busy={busyId === account.id} onSave={(nextRoles) => void saveRoles(account, nextRoles)} /></details></td>
          <td><span className={`account-state ${account.enabled ? "is-enabled" : "is-disabled"}`}><i/>{account.enabled ? "Activa" : "Suspendida"}</span></td>
          <td className="admin-date">{new Intl.DateTimeFormat("es-BO", { dateStyle: "medium" }).format(new Date(account.createdAt))}</td>
          <td><button className={`account-action ${account.enabled ? "danger-action" : "enable-action"}`} disabled={busyId === account.id || actor?.id === account.id} onClick={() => void changeStatus(account)}>{busyId === account.id ? "Guardando…" : account.enabled ? "Suspender" : "Habilitar"}</button></td>
        </tr>)}</tbody></table></div> : <div className="admin-empty">No encontramos cuentas con esa búsqueda.</div>}
        <div className="admin-pagination"><span>{result ? `Página ${result.page + 1} de ${Math.max(result.totalPages, 1)}` : ""}</span><div><button disabled={!result || result.page <= 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))}>Anterior</button><button disabled={!result || result.page + 1 >= result.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div></div>
      </section>
      <p className="admin-footnote">El rol Administrador no se puede eliminar del último administrador activo. Los roles de sistema no se modifican desde esta pantalla.</p>
    </div>
  </main>;
}

function RolePicker({ account, availableRoles, busy, onSave }: { account: AdminUser; availableRoles: Role[]; busy: boolean; onSave: (roles: string[]) => void }) {
  const [selected, setSelected] = useState(account.roles);
  return <div className="role-picker"><div>{availableRoles.map((role) => <label key={role.code}><input type="checkbox" checked={selected.includes(role.code)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, role.code] : current.filter((code) => code !== role.code))}/><span><strong>{roleNames[role.code] ?? role.name}</strong><small>{role.code}</small></span></label>)}</div><button disabled={busy || selected.length === 0} onClick={() => onSave(selected)}>{busy ? "Guardando…" : "Guardar roles"}</button></div>;
}
