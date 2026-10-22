import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = resolve(projectRoot, ".next/standalone");
const standaloneNextRoot = resolve(standaloneRoot, ".next");

await mkdir(standaloneNextRoot, { recursive: true });
await cp(resolve(projectRoot, ".next/static"), resolve(standaloneNextRoot, "static"), {
  recursive: true,
  force: true,
});

const publicRoot = resolve(projectRoot, "public");
if (existsSync(publicRoot)) {
  await cp(publicRoot, resolve(standaloneRoot, "public"), {
    recursive: true,
    force: true,
  });
}
