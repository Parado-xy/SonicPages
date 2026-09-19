import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const audit = spawnSync("npm", ["audit", "--omit=dev", "--audit-level=high"], { encoding: "utf8" });
process.stdout.write(audit.stdout ?? "");
process.stderr.write(audit.stderr ?? "");
if (audit.status === 0) process.exit(0);

const output = `${audit.stdout ?? ""}\n${audit.stderr ?? ""}`;
const vulnerabilityResult = /(?:high|critical) severity vulnerabilit|fix available via|run `npm audit fix`/i.test(output);
if (vulnerabilityResult) process.exit(audit.status ?? 1);

const infrastructureFailure = /503 Service Unavailable|performing maintenance|endpoint is being retired|audit endpoint returned an error/i.test(output);
if (!infrastructureFailure) process.exit(audit.status ?? 1);

const baseline = JSON.parse(await readFile("security/audited-lock.json", "utf8"));
const lock = await readFile("package-lock.json");
const digest = createHash("sha256").update(lock).digest("hex");
if (digest !== baseline.sha256 || baseline.result !== "zero-production-vulnerabilities") {
  console.error("The audit service is unavailable and the dependency lock differs from the last successful audit.");
  process.exit(1);
}

console.warn(`npm audit is unavailable; accepting the unchanged lockfile audited at ${baseline.auditedAt} (${baseline.sourceCommit}).`);
