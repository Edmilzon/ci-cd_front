import { apiFetch } from "@/src/lib/api";

export type Project = {
  id: string;
  slug: string;
  name: string;
  description: string;
  accessLevel: string;
  canManage: boolean;
  canArchive: boolean;
  canReadActivity: boolean;
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

export type ProjectSecret = { name: string; updatedBy: string; updatedAt: string };
export type ProjectDeployment = {
  id: string;
  runId: string;
  projectId: string;
  pipelineId: string;
  projectName: string;
  pipelineName: string;
  repositoryName: string;
  branchName: string;
  environmentName: string;
  sourceCommitSha: string;
  status: "WAITING_APPROVAL" | "APPROVED" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "REJECTED";
  requestedBy: string;
  approvedBy: string | null;
  requestedAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  githubDeploymentId: number | null;
  githubHtmlUrl: string | null;
  rollbackOfDeploymentId: string | null;
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

export type Pipeline = {
  id: string;
  repositoryId: string;
  repositoryName: string;
  name: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type PipelineVersion = { versionNumber: number; sha256: string; createdBy: string; createdAt: string };
export type PipelineVersionDetail = PipelineVersion & { yaml: string };
export type PipelineValidation = { valid: boolean; name: string | null; jobs: number; steps: number; errors: string[] };
export type PipelineRun = {
  id: string;
  pipelineId: string;
  pipelineName: string;
  pipelineVersion: number;
  branchName: string;
  triggerType: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failureMessage: string | null;
};
export type PipelineRunLog = { id: number; stream: "SYSTEM" | "STDOUT" | "STDERR"; message: string; createdAt: string };
export type DashboardRun = {
  id: string;
  projectId: string;
  pipelineId: string;
  projectName: string;
  pipelineName: string;
  repositoryName: string;
  branchName: string;
  version: number;
  status: PipelineRun["status"];
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMillis: number | null;
};
export type DashboardDeployment = {
  id: string;
  projectId: string;
  runId: string;
  projectName: string;
  pipelineName: string;
  repositoryName: string;
  environmentName: string;
  sourceCommitSha: string;
  status: ProjectDeployment["status"];
  requestedAt: string;
  githubHtmlUrl: string | null;
};
export type ActivityCategory = "PROJECT" | "ACCESS" | "PIPELINE" | "DEPLOYMENT" | "SECRET";
export type ProjectActivity = {
  id: string;
  projectId: string;
  actorEmail: string;
  action: string;
  category: ActivityCategory;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
};
export type ProjectActivityPage = { content: ProjectActivity[]; page: number; size: number; totalElements: number; totalPages: number };
export type DashboardActivity = ProjectActivity & { projectName: string };
export type DashboardDailyRuns = { day: string; succeeded: number; failed: number; active: number };
export type DashboardSummary = {
  projectCount: number;
  pipelineCount: number;
  runsToday: number;
  activeRuns: number;
  successRate30Days: number;
  medianDurationMillis30Days: number | null;
  dailyRuns: DashboardDailyRuns[];
  recentRuns: DashboardRun[];
  recentDeployments: DashboardDeployment[];
  recentActivity: DashboardActivity[];
};

export function getDashboard() { return apiFetch<DashboardSummary>("/api/dashboard"); }

export function getProjects() { return apiFetch<Project[]>("/api/projects"); }
export function getProject(id: string) { return apiFetch<Project>(`/api/projects/${id}`); }
export function getProjectActivity(id: string, category: "ALL" | ActivityCategory = "ALL", page = 0, size = 25) {
  return apiFetch<ProjectActivityPage>(`/api/projects/${id}/activity?category=${category}&page=${page}&size=${size}`);
}
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
export function getProjectSecrets(id: string) { return apiFetch<ProjectSecret[]>(`/api/projects/${id}/secrets`); }
export function saveProjectSecret(id: string, name: string, value: string) {
  return apiFetch<ProjectSecret>(`/api/projects/${id}/secrets/${encodeURIComponent(name)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
}
export function deleteProjectSecret(id: string, name: string) {
  return apiFetch<void>(`/api/projects/${id}/secrets/${encodeURIComponent(name)}`, { method: "DELETE" });
}
export function getProjectDeployments(id: string) { return apiFetch<ProjectDeployment[]>(`/api/projects/${id}/deployments`); }
export function approveProjectDeployment(projectId: string, deploymentId: string) {
  return apiFetch<ProjectDeployment>(`/api/projects/${projectId}/deployments/${deploymentId}/approve`, { method: "POST" });
}
export function rejectProjectDeployment(projectId: string, deploymentId: string) {
  return apiFetch<ProjectDeployment>(`/api/projects/${projectId}/deployments/${deploymentId}/reject`, { method: "POST" });
}
export function rollbackProjectDeployment(projectId: string, deploymentId: string) {
  return apiFetch<PipelineRun>(`/api/projects/${projectId}/deployments/${deploymentId}/rollback`, { method: "POST" });
}
export function getGitHubConnection() { return apiFetch<GitHubConnection>("/api/integrations/github/status"); }
export function beginGitHubConnection() { return apiFetch<{ authorizationUrl: string }>("/api/integrations/github/connect", { method: "POST" }); }
export function disconnectGitHub() { return apiFetch<void>("/api/integrations/github/connection", { method: "DELETE" }); }
export function getGitHubRepositories(page = 1) { return apiFetch<GitHubRepositoryPage>(`/api/integrations/github/repositories?page=${page}`); }
export function getPipelines(projectId: string) { return apiFetch<Pipeline[]>(`/api/projects/${projectId}/pipelines`); }
export function validatePipeline(projectId: string, yaml: string) {
  return apiFetch<PipelineValidation>(`/api/projects/${projectId}/pipelines/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yaml }) });
}
export function createPipeline(projectId: string, repositoryId: string, yaml: string) {
  return apiFetch<Pipeline>(`/api/projects/${projectId}/pipelines`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repositoryId, yaml }) });
}
export function addPipelineVersion(projectId: string, pipelineId: string, yaml: string) {
  return apiFetch<PipelineVersion>(`/api/projects/${projectId}/pipelines/${pipelineId}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yaml }) });
}
export function getPipelineVersions(projectId: string, pipelineId: string) {
  return apiFetch<PipelineVersion[]>(`/api/projects/${projectId}/pipelines/${pipelineId}/versions`);
}
export function getPipelineVersion(projectId: string, pipelineId: string, version: number) {
  return apiFetch<PipelineVersionDetail>(`/api/projects/${projectId}/pipelines/${pipelineId}/versions/${version}`);
}
export function deletePipeline(projectId: string, pipelineId: string) {
  return apiFetch<void>(`/api/projects/${projectId}/pipelines/${pipelineId}`, { method: "DELETE" });
}
export function queuePipelineRun(projectId: string, pipelineId: string, branchName?: string) {
  return apiFetch<PipelineRun>(`/api/projects/${projectId}/pipelines/${pipelineId}/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchName }) });
}
export function getPipelineRuns(projectId: string, pipelineId: string) {
  return apiFetch<PipelineRun[]>(`/api/projects/${projectId}/pipelines/${pipelineId}/runs`);
}
export function getPipelineRunLogs(projectId: string, runId: string, afterId = 0) {
  return apiFetch<PipelineRunLog[]>(`/api/projects/${projectId}/runs/${runId}/logs?afterId=${afterId}`);
}
