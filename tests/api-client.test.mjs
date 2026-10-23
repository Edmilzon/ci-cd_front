import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("typescript");

async function loadTypeScriptModule(relativePath, { fetchImpl, modules = {}, onWindowEvent = () => {} } = {}) {
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
    window: { localStorage: { getItem: () => null }, dispatchEvent: onWindowEvent },
    fetch: fetchImpl,
    Headers,
    Event,
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
    if (url.endsWith("/api/auth/register")) return jsonResponse(201, { verificationRequired: false, emailVerified: true });
    if (url.endsWith("/api/auth/registration/status")) return jsonResponse(200, { enabled: false });
    throw new Error(`Unexpected request: ${url}`);
  };
  const api = await loadTypeScriptModule("../src/lib/api.ts", { fetchImpl });

  await api.login("dev@cdci.test", "correct horse battery staple");
  await api.getCurrentUser();
  await api.registerAccount({ email: "new@cdci.test", fullName: "New User", password: "long-passphrase" });
  assert.deepEqual(await api.getRegistrationStatus(), { enabled: false });

  assert.deepEqual(calls.map(({ url }) => url), [
    "https://api.cdci.test/api/auth/csrf",
    "https://api.cdci.test/api/auth/login",
    "https://api.cdci.test/api/auth/me",
    "https://api.cdci.test/api/auth/csrf",
    "https://api.cdci.test/api/auth/register",
    "https://api.cdci.test/api/auth/registration/status",
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
  assert.equal(calls[5].init.method, "GET");
  assert.equal(calls[5].init.credentials, "include");
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

test("expired sessions notify the authentication provider after an API 401", async () => {
  const events = [];
  const fetchImpl = async (url) => url.endsWith("/api/auth/csrf")
    ? jsonResponse(200, { token: "csrf-expired" })
    : jsonResponse(401, { code: "UNAUTHENTICATED", message: "Inicia sesión nuevamente." });
  const api = await loadTypeScriptModule("../src/lib/api.ts", { fetchImpl, onWindowEvent: (event) => events.push(event.type) });

  await assert.rejects(api.getCurrentUser(), { status: 401 });
  assert.deepEqual(events, ["cdci:unauthorized"]);
});

test("password recovery uses the public status and CSRF-protected reset routes", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/api/auth/csrf")) return jsonResponse(200, { token: "csrf-recovery" });
    if (url.endsWith("/api/auth/password-reset/status")) return jsonResponse(200, { enabled: true });
    if (url.endsWith("/api/auth/password-reset/request")) return jsonResponse(202, { message: "If the account exists, check your email." });
    if (url.endsWith("/api/auth/password-reset/confirm")) return { ok: true, status: 204 };
    throw new Error(`Unexpected request: ${url}`);
  };
  const api = await loadTypeScriptModule("../src/lib/api.ts", { fetchImpl });

  assert.deepEqual(await api.getPasswordResetStatus(), { enabled: true });
  await api.requestPasswordReset("dev@cdci.test");
  await api.resetPassword("opaque-one-time-token", "a-unique-long-password");

  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[1].url, "https://api.cdci.test/api/auth/csrf");
  assert.equal(calls[2].init.headers.get("X-XSRF-TOKEN"), "csrf-recovery");
  assert.equal(JSON.parse(calls[2].init.body).email, "dev@cdci.test");
  assert.equal(calls[4].url, "https://api.cdci.test/api/auth/password-reset/confirm");
  assert.equal(JSON.parse(calls[4].init.body).token, "opaque-one-time-token");
});

test("email verification uses CSRF-protected resend and confirm routes", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/api/auth/csrf")) return jsonResponse(200, { token: "csrf-verify" });
    if (url.endsWith("/api/auth/email-verification/resend")) return jsonResponse(202, { message: "If pending, check your email." });
    if (url.endsWith("/api/auth/email-verification/confirm")) return { ok: true, status: 204 };
    throw new Error(`Unexpected request: ${url}`);
  };
  const api = await loadTypeScriptModule("../src/lib/api.ts", { fetchImpl });

  await api.requestEmailVerification("dev@cdci.test");
  await api.confirmEmailVerification("opaque-verification-token");

  assert.equal(calls[0].url, "https://api.cdci.test/api/auth/csrf");
  assert.equal(calls[1].url, "https://api.cdci.test/api/auth/email-verification/resend");
  assert.equal(calls[1].init.headers.get("X-XSRF-TOKEN"), "csrf-verify");
  assert.equal(JSON.parse(calls[1].init.body).email, "dev@cdci.test");
  assert.equal(calls[3].url, "https://api.cdci.test/api/auth/email-verification/confirm");
  assert.equal(JSON.parse(calls[3].init.body).token, "opaque-verification-token");
});

test("MFA login, enrollment, recovery rotation, and disable use protected API routes", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/api/auth/csrf")) return jsonResponse(200, { token: "csrf-mfa" });
    if (url.endsWith("/api/auth/login")) return jsonResponse(200, { authenticated: false, mfaRequired: true, mfaSetupRequired: true });
    if (url.endsWith("/api/auth/mfa/login")) return jsonResponse(200, { authenticated: true });
    if (url.endsWith("/api/auth/mfa/status")) return jsonResponse(200, { available: true, enabled: true, recoveryCodesRemaining: 10 });
    if (url.endsWith("/api/auth/mfa/setup")) return jsonResponse(200, { secret: "BASE32SECRET", otpauthUri: "otpauth://totp/CDCI", expiresAt: "2026-10-22T12:00:00Z" });
    if (url.endsWith("/api/auth/mfa/confirm") || url.endsWith("/api/auth/mfa/recovery-codes")) return jsonResponse(200, { enabled: true, recoveryCodes: ["A1B2-C3D4"] });
    if (url.endsWith("/api/auth/mfa/disable")) return { ok: true, status: 204 };
    throw new Error(`Unexpected request: ${url}`);
  };
  const api = await loadTypeScriptModule("../src/lib/api.ts", { fetchImpl });

  assert.deepEqual(await api.login("dev@cdci.test", "long-password"), { authenticated: false, mfaRequired: true, mfaSetupRequired: true });
  assert.deepEqual(await api.completeMfaLogin("123456"), { authenticated: true });
  assert.deepEqual(await api.getMfaStatus(), { available: true, enabled: true, recoveryCodesRemaining: 10 });
  assert.equal((await api.startMfaSetup("long-password")).secret, "BASE32SECRET");
  assert.deepEqual(await api.confirmMfaSetup("123456"), { enabled: true, recoveryCodes: ["A1B2-C3D4"] });
  assert.deepEqual(await api.regenerateMfaRecoveryCodes("long-password", "123456"), { enabled: true, recoveryCodes: ["A1B2-C3D4"] });
  assert.equal(await api.disableMfa("long-password", "123456"), undefined);

  const mfaMutations = calls.filter(({ url }) => url.includes("/api/auth/mfa/") && !url.endsWith("/status"));
  assert.equal(mfaMutations.length, 5);
  for (const { init } of mfaMutations) assert.equal(init.headers.get("X-XSRF-TOKEN"), "csrf-mfa");
  assert.deepEqual(mfaMutations.map(({ url }) => new URL(url).pathname), [
    "/api/auth/mfa/login", "/api/auth/mfa/setup", "/api/auth/mfa/confirm",
    "/api/auth/mfa/recovery-codes", "/api/auth/mfa/disable",
  ]);
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

test("project server calls match the backend SSH routes", async () => {
  const calls = [];
  const apiFetch = async (path, options = {}) => {
    calls.push({ path, options });
    return {};
  };
  const projectApi = await loadTypeScriptModule("../src/lib/project-api.ts", {
    modules: { "@/src/lib/api": { apiFetch } },
  });

  await projectApi.getProjectServers("project-7");
  await projectApi.createProjectServer("project-7", { name: "Producción", host: "10.0.0.5", port: 22, username: "deploy", hostKeyFingerprint: "SHA256:ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0", password: "ssh-secret" });
  await projectApi.updateProjectServer("project-7", "server-1", { name: "Producción", host: "10.0.0.6", port: 2222, username: "deploy", hostKeyFingerprint: "SHA256:ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0" });
  await projectApi.testProjectServer("project-7", "server-1");
  await projectApi.executeProjectServerCommand("project-7", "server-1", "uname -a");
  await projectApi.deleteProjectServer("project-7", "server-1");

  assert.deepEqual(calls.map(({ path }) => path), [
    "/api/projects/project-7/servers",
    "/api/projects/project-7/servers",
    "/api/projects/project-7/servers/server-1",
    "/api/projects/project-7/servers/server-1/test",
    "/api/projects/project-7/servers/server-1/commands",
    "/api/projects/project-7/servers/server-1",
  ]);
  assert.equal(calls[0].options.method, undefined);
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), { name: "Producción", host: "10.0.0.5", port: 22, username: "deploy", hostKeyFingerprint: "SHA256:ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0", password: "ssh-secret" });
  assert.equal(calls[2].options.method, "PUT");
  assert.deepEqual(JSON.parse(calls[2].options.body), { name: "Producción", host: "10.0.0.6", port: 2222, username: "deploy", hostKeyFingerprint: "SHA256:ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0" });
  assert.equal(calls[3].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[4].options.body), { command: "uname -a" });
  assert.equal(calls[5].options.method, "DELETE");
});
