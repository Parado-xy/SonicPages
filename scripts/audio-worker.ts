import { processNextAudioJob } from "@/lib/audio/queue";
import { prisma } from "@/lib/prisma";

const pollingIntervalMs = Number(process.env.AUDIO_POLL_INTERVAL_MS ?? 2_000);
const runOnce = process.env.AUDIO_RUN_ONCE === "true";
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function run() {
  console.info("SonicPages audio worker started.");
  while (!stopping) {
    const processed = await processNextAudioJob().catch((error) => { console.error("Audio worker iteration failed", error); return null; });
    if (processed) console.info("Audio job processed", { jobId: processed });
    else if (!runOnce) await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
    if (runOnce) stopping = true;
  }
  await prisma.$disconnect();
  console.info("SonicPages audio worker stopped.");
}
void run();
