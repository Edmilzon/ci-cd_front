import { apiFetch } from "@/src/lib/api";

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  enabled: boolean;
  roles: string[];
  createdAt: string;
};

export type Permission = { code: string; name: string; description: string };
export type Role = {
  code: string;
  name: string;
  description: string;
  systemManaged: boolean;
  permissions: Permission[];
  userCount: number;
};

export type AuditEvent = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
};

export function getUsers(search = "", page = 0) {
  const params = new URLSearchParams({ page: String(page), size: "25" });
  if (search.trim()) params.set("search", search.trim());
  return apiFetch<PageResponse<AdminUser>>(`/api/admin/users?${params}`);
}

export function updateUserStatus(id: string, enabled: boolean) {
  return apiFetch<AdminUser>(`/api/admin/users/${id}/status`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }),
  });
}

export function updateUserRoles(id: string, roleCodes: string[]) {
  return apiFetch<AdminUser>(`/api/admin/users/${id}/roles`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleCodes }),
  });
}

export function getRoles() { return apiFetch<Role[]>("/api/admin/roles"); }
export function getPermissions() { return apiFetch<Permission[]>("/api/admin/permissions"); }

export function createRole(input: { code: string; name: string; description: string }) {
  return apiFetch<Role>("/api/admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export function updateRole(code: string, input: { name: string; description: string }) {
  return apiFetch<Role>(`/api/admin/roles/${encodeURIComponent(code)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export function updateRolePermissions(code: string, permissionCodes: string[]) {
  return apiFetch<Role>(`/api/admin/roles/${encodeURIComponent(code)}/permissions`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissionCodes }),
  });
}

export function deleteRole(code: string) {
  return apiFetch<void>(`/api/admin/roles/${encodeURIComponent(code)}`, { method: "DELETE" });
}

export function getAuditEvents(page = 0) {
  return apiFetch<PageResponse<AuditEvent>>(`/api/admin/audit?page=${page}&size=25`);
}
