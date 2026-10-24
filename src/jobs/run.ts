// バッチのエントリポイント（基本設計書 5.5）。Cloud Run Jobs から `npm run jobs -- <job名>` で起動する。
// 例: npm run jobs -- expire-challenges

import { prisma } from "../server/db";
import { logger } from "../server/logger";
import {
  cleanupAbandonedUploads,
  cleanupMisc,
  deleteScheduledVideos,
  expireChallenges,
  purgeDeletedData,
} from "../server/services/jobs";

const JOBS: Record<string, () => Promise<unknown>> = {
  "expire-challenges": expireChallenges, // F-BAT-01 毎日 0:05
  "delete-videos": deleteScheduledVideos, // F-BAT-02 毎日 3:00
  "cleanup-uploads": cleanupAbandonedUploads, // F-BAT-03 毎日 3:10
  "purge-deleted": purgeDeletedData, // F-BAT-04 毎日 3:20
  "cleanup-misc": cleanupMisc, // F-BAT-05 毎日 3:30
};

async function main() {
  const name = process.argv[2];
  const job = name ? JOBS[name] : undefined;
  if (!job) {
    console.error(`usage: npm run jobs -- <${Object.keys(JOBS).join("|")}>`);
    process.exitCode = 2;
    return;
  }
  const started = Date.now();
  const result = await job();
  logger.info("job finished", { job: name, result, ms: Date.now() - started });
}

main()
  .catch((e) => {
    // 失敗は Cloud Monitoring で通知する（NF-O-02）
    logger.error("job failed", { job: process.argv[2], error: e });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
