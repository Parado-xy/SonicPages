import { processNextIngestionJob } from "@/lib/ingestion/queue";
import { prisma } from "@/lib/prisma";

const pollingIntervalMs = Number(process.env.INGESTION_POLL_INTERVAL_MS ?? 2_000);
const runOnce = process.env.INGESTION_RUN_ONCE === "true";
let stopping = false;

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function run() {
  console.info("SonicPages ingestion worker started.");
  while (!stopping) {
    const processed = await processNextIngestionJob().catch((error) => {
      console.error("Ingestion worker iteration failed", error);
      return null;
    });
    if (processed) console.info("Ingestion job processed", { jobId: processed });
    else if (!runOnce) await wait(pollingIntervalMs);
    if (runOnce) stopping = true;
  }
  await prisma.$disconnect();
  console.info("SonicPages ingestion worker stopped.");
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

void run();
