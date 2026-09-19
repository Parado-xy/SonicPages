import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("public/manifest.webmanifest", "utf8"));
if (manifest.display !== "standalone" || !manifest.start_url || !manifest.icons?.length) throw new Error("PWA manifest is incomplete.");
const worker = await readFile("public/sw.js", "utf8");
if (!worker.includes('"/offline.html"') || !worker.includes("sonicpages-sync")) throw new Error("Offline shell or mutation sync is missing.");
if (/cache\.put\([^\n]*\/api\//.test(worker)) throw new Error("Authenticated API responses must not be cached.");
console.info("PWA assets and privacy policy validated.");
