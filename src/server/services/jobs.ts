// 定期バッチ（基本設計書 5.5 F-BAT-01〜05）
// どの処理も、何度実行しても結果が変わらないように書く（失敗しても次の実行で取り戻せる）。

import { fromYmd, todayJst } from "@/lib/date";
import { prisma } from "../db";
import { logger } from "../logger";
import { storage } from "../storage";
import { deleteVideoObjects } from "./videos";

const DAY_MS = 24 * 60 * 60 * 1000;

/** F-BAT-01 期限切れ判定（毎日 0:05 JST） */
export async function expireChallenges(): Promise<number> {
  const today = fromYmd(todayJst());
  const r = await prisma.challenge.updateMany({
    where: { status: { in: ["OPEN", "REJECTED"] }, mission: { dueDate: { lt: today } } },
    data: { status: "EXPIRED" },
  });
  return r.count;
}

/** F-BAT-02 動画の自動削除（毎日 3:00 JST）。1,000件ずつ繰り返す */
export async function deleteScheduledVideos(): Promise<number> {
  let total = 0;
  for (;;) {
    const videos = await prisma.video.findMany({
      where: { deleteScheduledAt: { lte: new Date() }, deletedAt: null },
      take: 1000,
    });
    if (videos.length === 0) break;
    for (const v of videos) {
      try {
        await deleteVideoObjects(v);
        await prisma.video.update({ where: { id: v.id }, data: { status: "DELETED", deletedAt: new Date() } });
        total++;
      } catch (e) {
        logger.error("video delete failed", { videoId: v.id, error: e });
        // 失敗した動画は次回に回す（無限ループを避けるため今回は抜ける）
        return total;
      }
    }
  }
  return total;
}

/**
 * F-BAT-03 放置アップロードの掃除（毎日 3:10 JST）
 * 申請に紐づかないまま24時間たった動画を消す【要確認 BQ-10】。
 * 変換が申請より先に終わると READY のまま申請なしになるため、状態ではなく submission_id で判定する。
 */
export async function cleanupAbandonedUploads(): Promise<number> {
  const videos = await prisma.video.findMany({
    where: { submissionId: null, createdAt: { lt: new Date(Date.now() - DAY_MS) } },
  });
  for (const v of videos) {
    await deleteVideoObjects(v).catch((e) => logger.warn("abandoned upload object delete failed", { videoId: v.id, error: e }));
    await prisma.video.delete({ where: { id: v.id } }).catch(() => undefined);
  }
  return videos.length;
}

/** F-BAT-04 退会データの物理削除（毎日 3:20 JST）。論理削除から29日後（NF-O-04「30日以内」） */
export async function purgeDeletedData(): Promise<{ families: number; users: number }> {
  const threshold = new Date(Date.now() - 29 * DAY_MS);
  let families = 0;
  for (;;) {
    const batch = await prisma.family.findMany({ where: { deletedAt: { lt: threshold } }, take: 100 });
    if (batch.length === 0) break;
    for (const f of batch) {
      await storage.deletePrefix("raw", `raw/${f.id}`);
      await storage.deletePrefix("videos", `v/${f.id}`);
      await prisma.family.delete({ where: { id: f.id } }); // ユーザ・ミッション・申請などは CASCADE で消える
      families++;
    }
  }
  // 家族はそのままで、削除された子どもだけを物理削除する
  const users = await prisma.user.findMany({ where: { deletedAt: { lt: threshold }, role: "CHILD" }, include: { challenges: { include: { videos: true } } } });
  for (const u of users) {
    for (const v of u.challenges.flatMap((c) => c.videos)) {
      await deleteVideoObjects(v).catch(() => undefined);
    }
    await prisma.user.delete({ where: { id: u.id } });
  }
  return { families, users: users.length };
}

/** F-BAT-05 期限切れデータの掃除（毎日 3:30 JST） */
export async function cleanupMisc(): Promise<{ sessions: number; resetTokens: number; loginEvents: number }> {
  const now = new Date();
  const [sessions, resetTokens, loginEvents] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.loginEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * DAY_MS) } } }),
  ]);
  return { sessions: sessions.count, resetTokens: resetTokens.count, loginEvents: loginEvents.count };
}
