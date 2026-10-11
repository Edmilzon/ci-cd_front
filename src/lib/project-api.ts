import { apiFetch } from "@/src/lib/api";

export type Project = {
  id: string;
  slug: string;
  name: string;
  description: string;
  accessLevel: string;
  canManage: boolean;
  canArchive: boolean;
  repositoryCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMember = {
  userId: string;
  fullName: string;
  email: string;
  accessLevel: "OWNER" | "MAINTAINER" | "DEVELOPER" | "VIEWER";
  addedAt: string;
};

export type ProjectRepository = {
  id: string;
  githubRepositoryId: number;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  privateRepository: boolean;
  description: string;
  githubLogin: string;
  createdAt: string;
};

export type GitHubRepository = {
  id: number;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  privateRepository: boolean;
  description: string;
  language: string;
  pushedAt: string | null;
};

export type GitHubRepositoryPage = { items: GitHubRepository[]; page: number; pageSize: number; hasMore: boolean };
export type GitHubConnection = { connected: boolean; githubLogin: string | null; accessTokenExpiresAt: string | null };
export type ProjectRole = ProjectMember["accessLevel"];

export function getProjects() { return apiFetch<Project[]>("/api/projects"); }
export function getProject(id: string) { return apiFetch<Project>(`/api/projects/${id}`); }
export function createProject(input: { name: string; slug?: string; description: string }) {
  return apiFetch<Project>("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export function updateProject(id: string, input: { name: string; description: string }) {
  return apiFetch<Project>(`/api/projects/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export function archiveProject(id: string) { return apiFetch<void>(`/api/projects/${id}`, { method: "DELETE" }); }
export function getProjectMembers(id: string) { return apiFetch<ProjectMember[]>(`/api/projects/${id}/members`); }
export function addProjectMember(id: string, email: string, accessLevel: ProjectRole) {
  return apiFetch<ProjectMember>(`/api/projects/${id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, accessLevel }) });
}
export function updateProjectMember(id: string, userId: string, accessLevel: ProjectRole) {
  return apiFetch<ProjectMember>(`/api/projects/${id}/members/${userId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessLevel }) });
}
export function removeProjectMember(id: string, userId: string) { return apiFetch<void>(`/api/projects/${id}/members/${userId}`, { method: "DELETE" }); }
export function getProjectRepositories(id: string) { return apiFetch<ProjectRepository[]>(`/api/projects/${id}/repositories`); }
export function addProjectRepository(id: string, githubRepositoryId: number) {
  return apiFetch<ProjectRepository>(`/api/projects/${id}/repositories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ githubRepositoryId }) });
}
export function removeProjectRepository(id: string, repositoryId: string) { return apiFetch<void>(`/api/projects/${id}/repositories/${repositoryId}`, { method: "DELETE" }); }
export function getGitHubConnection() { return apiFetch<GitHubConnection>("/api/integrations/github/status"); }
export function beginGitHubConnection() { return apiFetch<{ authorizationUrl: string }>("/api/integrations/github/connect", { method: "POST" }); }
export function disconnectGitHub() { return apiFetch<void>("/api/integrations/github/connection", { method: "DELETE" }); }
export function getGitHubRepositories(page = 1) { return apiFetch<GitHubRepositoryPage>(`/api/integrations/github/repositories?page=${page}`); }
