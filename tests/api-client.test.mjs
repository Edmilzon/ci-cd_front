import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("typescript");

async function loadTypeScriptModule(relativePath, { fetchImpl, modules = {} } = {}) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  const context = {
    module: commonJsModule,
    exports: commonJsModule.exports,
    require: (name) => {
      if (Object.hasOwn(modules, name)) return modules[name];
      return require(name);
    },
    process: { env: { NEXT_PUBLIC_API_URL: "https://api.cdci.test" } },
    window: { localStorage: { getItem: () => null } },
    fetch: fetchImpl,
    Headers,
    URLSearchParams,
  };
  runInNewContext(compiled, context, { filename: relativePath });
  return commonJsModule.exports;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test("register and login client preserve the session and CSRF contract", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/api/auth/csrf")) return jsonResponse(200, { token: "csrf-test-token" });
    if (url.endsWith("/api/auth/login")) return jsonResponse(200, { authenticated: true });
    if (url.endsWith("/api/auth/me")) return jsonResponse(200, { id: "user-1", email: "dev@cdci.test" });
    if (url.endsWith("/api/auth/register")) return jsonResponse(201, { id: "user-2", email: "new@cdci.test" });
    throw new Error(`Unexpected request: ${url}`);
  };
  const api = await loadTypeScriptModule("../src/lib/api.ts", { fetchImpl });

  await api.login("dev@cdci.test", "correct horse battery staple");
  await api.getCurrentUser();
  await api.registerAccount({ email: "new@cdci.test", fullName: "New User", password: "long-passphrase" });

  assert.deepEqual(calls.map(({ url }) => url), [
    "https://api.cdci.test/api/auth/csrf",
    "https://api.cdci.test/api/auth/login",
    "https://api.cdci.test/api/auth/me",
    "https://api.cdci.test/api/auth/csrf",
    "https://api.cdci.test/api/auth/register",
  ]);
  const login = calls[1].init;
  assert.equal(login.method, "POST");
  assert.equal(login.credentials, "include");
  assert.equal(login.headers.get("X-XSRF-TOKEN"), "csrf-test-token");
  assert.equal(new URLSearchParams(login.body).get("email"), "dev@cdci.test");
  assert.equal(calls[2].init.method, "GET");
  assert.equal(calls[2].init.credentials, "include");
  assert.equal(calls[4].init.headers.get("X-XSRF-TOKEN"), "csrf-test-token");
  assert.equal(JSON.parse(calls[4].init.body).fullName, "New User");
});

test("API client maps structured authorization errors and 204 responses", async () => {
  let requestNumber = 0;
  const fetchImpl = async (url) => {
    requestNumber += 1;
    if (url.endsWith("/api/auth/csrf")) return jsonResponse(200, { token: "csrf" });
    if (requestNumber === 2) return jsonResponse(403, { code: "FORBIDDEN", message: "No tienes permiso.", fields: { accessLevel: "No permitido." } });
    return { ok: true, status: 204, json: async () => { throw new Error("204 has no body"); } };
  };
  const api = await loadTypeScriptModule("../src/lib/api.ts", { fetchImpl });

  await assert.rejects(api.apiFetch("/api/admin/roles", { method: "POST", body: "{}" }), (error) => {
    assert.equal(error.name, "ApiError");
    assert.equal(error.status, 403);
    assert.equal(error.code, "FORBIDDEN");
    assert.equal(error.fields.accessLevel, "No permitido.");
    return true;
  });
  assert.equal(await api.apiFetch("/api/auth/logout", { method: "POST" }), undefined);
});

test("pipeline and production deployment calls match the backend routes", async () => {
  const calls = [];
  const apiFetch = async (path, options = {}) => {
    calls.push({ path, options });
    return { accepted: true };
  };
  const projectApi = await loadTypeScriptModule("../src/lib/project-api.ts", {
    modules: { "@/src/lib/api": { apiFetch } },
  });

  await projectApi.validatePipeline("project-7", "name: Build");
  await projectApi.queuePipelineRun("project-7", "pipeline-2", "main");
  await projectApi.approveProjectDeployment("project-7", "deployment-4");

  assert.deepEqual(calls.map(({ path }) => path), [
    "/api/projects/project-7/pipelines/validate",
    "/api/projects/project-7/pipelines/pipeline-2/runs",
    "/api/projects/project-7/deployments/deployment-4/approve",
  ]);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(JSON.parse(calls[0].options.body).yaml, "name: Build");
  assert.equal(JSON.parse(calls[1].options.body).branchName, "main");
  assert.equal(calls[2].options.method, "POST");
});
