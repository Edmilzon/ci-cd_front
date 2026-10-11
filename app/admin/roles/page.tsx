"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/src/auth/AuthProvider";
import { ApiError } from "@/src/lib/api";
import { createRole, deleteRole, getPermissions, getRoles, updateRole, updateRolePermissions, type Permission, type Role } from "@/src/lib/admin-api";

function displayError(error: unknown) {
  return error instanceof ApiError ? error.message : "No pudimos completar la solicitud. Revisa la conexión e inténtalo otra vez.";
}

export default function AdminRolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const selectedRole = roles.find((role) => role.code === selectedCode) ?? null;
  const load = useCallback(async (preferredCode?: string) => {
    setLoading(true);
    setError("");
    try {
      const [availableRoles, catalog] = await Promise.all([getRoles(), getPermissions()]);
      setRoles(availableRoles);
      setPermissions(catalog);
      const nextCode = preferredCode && availableRoles.some((role) => role.code === preferredCode)
        ? preferredCode : availableRoles[0]?.code ?? "";
      setSelectedCode(nextCode);
      const nextRole = availableRoles.find((role) => role.code === nextCode);
      setSelectedPermissions(nextRole?.permissions.map((permission) => permission.code) ?? []);
      setName(nextRole?.name ?? "");
      setDescription(nextRole?.description ?? "");
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function chooseRole(role: Role) {
    setSelectedCode(role.code);
    setSelectedPermissions(role.permissions.map((permission) => permission.code));
    setName(role.name);
    setDescription(role.description);
    setError("");
    setNotice("");
  }

  async function saveRole() {
    if (!selectedRole || selectedRole.systemManaged) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await updateRole(selectedRole.code, { name: name.trim(), description: description.trim() });
      await updateRolePermissions(selectedRole.code, selectedPermissions);
      await load(selectedRole.code);
      setNotice("Rol y permisos actualizados. Las sesiones con este rol deberán volver a iniciar sesión.");
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await createRole({ code: newCode.trim().toUpperCase(), name: newName.trim(), description: newDescription.trim() });
      setNewCode(""); setNewName(""); setNewDescription("");
      await load(created.code);
      setNotice("Rol creado sin permisos asignados. Define el acceso antes de asignarlo a usuarios.");
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeRole(role: Role) {
    if (role.systemManaged || !window.confirm(`¿Eliminar el rol ${role.name}?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await deleteRole(role.code);
      await load(roles.find((item) => item.code !== role.code)?.code);
      setNotice("Rol eliminado.");
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  const groupedPermissions = useMemo(() => {
    const labels: Record<string, string> = { USER: "Usuarios", ROLE: "Roles", PIPELINE: "Pipelines", DEPLOYMENT: "Despliegues", AUDIT: "Auditoría", SETTINGS: "Configuración" };
    return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
      const group = labels[permission.code.split("_")[0]] ?? "Otros";
      (groups[group] ??= []).push(permission);
      return groups;
    }, {});
  }, [permissions]);

  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-back" href="/">← Volver al dashboard</Link><span>Administración de acceso</span><span className="admin-user-chip">{user?.fullName}</span></header>
    <div className="admin-content">
      <div className="admin-heading"><div><p className="admin-eyebrow">CONTROL DE ACCESO</p><h1>Roles y permisos</h1><p>Define lo que cada rol puede hacer. El servidor vuelve a validar cada acción.</p></div><span className="admin-count"><strong>{roles.length}</strong><small>roles</small></span></div>
      {error && <p className="admin-alert" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
      {loading ? <section className="admin-panel admin-empty">Cargando catálogo de acceso…</section> : <div className="role-management-grid">
        <section className="admin-panel role-list-panel"><div className="admin-panel-heading"><div><h2>Roles disponibles</h2><p>Los roles de sistema son de solo lectura.</p></div></div><div className="role-list">{roles.map((role) => <button key={role.code} className={`role-list-item ${role.code === selectedCode ? "selected" : ""}`} onClick={() => chooseRole(role)}><span className="role-list-icon">{role.code.slice(0, 1)}</span><span><strong>{role.name}</strong><small>{role.code} · {role.userCount} usuarios</small></span><span className="role-list-arrow">›</span></button>)}</div></section>
        <section className="admin-panel role-detail-panel">{selectedRole ? <>
          <div className="admin-panel-heading"><div><span className={`role-type ${selectedRole.systemManaged ? "system-role" : "custom-role"}`}>{selectedRole.systemManaged ? "ROL DE SISTEMA" : "ROL PERSONALIZADO"}</span><h2>{selectedRole.name}</h2><p>{selectedRole.userCount} cuentas asignadas</p></div>{!selectedRole.systemManaged && <button className="account-action danger-action" disabled={busy} onClick={() => void removeRole(selectedRole)}>Eliminar rol</button>}</div>
          <label className="admin-field-label" htmlFor="role-name">Nombre del rol</label><input className="admin-text-input" id="role-name" value={name} disabled={selectedRole.systemManaged || busy} onChange={(event) => setName(event.target.value)} maxLength={80}/>
          <label className="admin-field-label" htmlFor="role-description">Descripción</label><textarea className="admin-text-input admin-textarea" id="role-description" value={description} disabled={selectedRole.systemManaged || busy} onChange={(event) => setDescription(event.target.value)} maxLength={240}/>
          <div className="permission-heading"><div><h3>Permisos</h3><p>Selecciona las capacidades que este rol podrá ejercer.</p></div><span>{selectedPermissions.length} seleccionados</span></div>
          <div className="permission-groups">{Object.entries(groupedPermissions).map(([group, groupPermissions]) => <fieldset className="permission-group" key={group} disabled={selectedRole.systemManaged || busy}><legend>{group}</legend>{groupPermissions.map((permission) => <label className="permission-option" key={permission.code}><input type="checkbox" checked={selectedPermissions.includes(permission.code)} onChange={(event) => setSelectedPermissions((current) => event.target.checked ? [...current, permission.code] : current.filter((code) => code !== permission.code))}/><span><strong>{permission.name}</strong><small>{permission.description}</small></span><code>{permission.code}</code></label>)}</fieldset>)}</div>
          {selectedRole.systemManaged ? <p className="admin-footnote">Los permisos integrados se mantienen con valores predeterminados para evitar dejar el sistema sin administración.</p> : <div className="admin-form-footer"><span>Los cambios cierran las sesiones activas de quienes usan este rol.</span><button className="admin-primary-button" disabled={busy} onClick={() => void saveRole()}>{busy ? "Guardando…" : "Guardar cambios"}</button></div>}
        </> : <div className="admin-empty">No hay roles disponibles.</div>}</section>
      </div>}
      <section className="admin-panel create-role-panel"><div><h2>Crear un rol personalizado</h2><p>Los roles nuevos comienzan sin permisos. Asigna solo el acceso necesario.</p></div><form className="create-role-form" onSubmit={addRole}><label><span>Código</span><input value={newCode} onChange={(event) => setNewCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))} placeholder="RELEASE_MANAGER" minLength={2} maxLength={48} pattern="[A-Z][A-Z0-9_]{1,47}" required disabled={busy}/></label><label><span>Nombre</span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Gestor de releases" minLength={2} maxLength={80} required disabled={busy}/></label><label><span>Descripción</span><input value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Responsabilidades de este rol" maxLength={240} required disabled={busy}/></label><button className="admin-primary-button" disabled={busy}>{busy ? "Guardando…" : "Crear rol"}</button></form></section>
      <p className="admin-footnote"><Link href="/admin/users">Administrar asignaciones de usuarios →</Link> <span>·</span> <Link href="/admin/audit">Ver registro de auditoría →</Link></p>
    </div>
  </main>;
}
