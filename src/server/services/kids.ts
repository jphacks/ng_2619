// 子ども画面のAPI（F-CHL-01〜07, F-LV-02/03。基本設計書 1.6.2）

import type { AvatarSlot, SubmissionMethod, TargetUnit, VerifyMethod } from "@/lib/constants";
import { VIDEO_MAX_BYTES } from "@/lib/constants";
import { toYmd, todayJst } from "@/lib/date";
import type {
  KidsChallengeCard,
  KidsChallengeDetail,
  KidsHome,
  KidsNotice,
  KidsRecords,
  SubmissionCreated,
  VideoUploadUrlResponse,
} from "@/lib/types";
import { prisma } from "../db";
import { errors } from "../errors";
import { newId } from "../ids";
import { logger } from "../logger";
import type { SessionContext } from "../auth/session";
import { effectiveStatus, methodAllowed, SUBMITTABLE, transition } from "../domain/challenge";
import { getLevels, remainingToNext, unlockedBetween } from "../domain/level";
import { findOwnChallenge } from "../repositories/scoped";
import { isUniqueViolation } from "../http";
import { rawKey, storage, UPLOAD_URL_TTL_SEC } from "../storage";
import { loadAvatarLayers } from "./avatar";
import { deleteVideoObjects } from "./videos";

type ChallengeWithMission = { id: string; status: string; createdAt: Date; mission: {
  title: string;
  description: string | null;
  dueDate: Date | null;
  targetValue: number | null;
  targetUnit: string | null;
  verifyMethod: string;
  categoryCode: string;
} };

function toCard(c: ChallengeWithMission, today: string): KidsChallengeCard {
  return {
    id: c.id,
    title: c.mission.title,
    status: effectiveStatus(c.status, c.mission.dueDate, today),
    dueDate: c.mission.dueDate ? toYmd(c.mission.dueDate) : null,
    targetValue: c.mission.targetValue,
    targetUnit: c.mission.targetUnit as TargetUnit | null,
    verifyMethod: c.mission.verifyMethod as VerifyMethod,
    categoryCode: c.mission.categoryCode,
  };
}

export async function home(session: SessionContext): Promise<KidsHome> {
  const today = todayJst();
  const profile = await prisma.childProfile.findUniqueOrThrow({ where: { userId: session.userId } });
  const [levels, layers, challenges, reviewed, safety] = await Promise.all([
    getLevels(prisma),
    loadAvatarLayers(prisma, [session.userId]),
    prisma.challenge.findMany({
      where: { childUserId: session.userId, status: { in: ["OPEN", "PENDING", "REJECTED"] } },
      include: { mission: true },
    }),
    prisma.submission.findMany({
      where: { challenge: { childUserId: session.userId }, reviewResult: { not: null }, childSeenAt: null },
      include: { challenge: { include: { mission: { select: { title: true } } } } },
      orderBy: { reviewedAt: "desc" },
      take: 10,
    }),
    prisma.safetyMessage.findMany({ select: { text: true } }),
  ]);

  // 期限が近い順、期限なしは新しい順（F-CHL-01）。期限切れは出さない
  const cards = challenges
    .map((c) => ({ card: toCard(c, today), createdAt: c.createdAt }))
    .filter((x) => x.card.status !== "EXPIRED")
    .sort((a, b) => {
      if (a.card.dueDate && b.card.dueDate) return a.card.dueDate.localeCompare(b.card.dueDate);
      if (a.card.dueDate) return -1;
      if (b.card.dueDate) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .map((x) => x.card);

  const notices: KidsNotice[] = reviewed.map((s) => ({
    submissionId: s.id,
    kind: s.source === "PARENT" ? "PARENT_COMPLETED" : (s.reviewResult as "APPROVED" | "REJECTED"),
    missionTitle: s.challenge.mission.title,
    comment: s.reviewComment,
    reviewedAt: (s.reviewedAt ?? s.submittedAt).toISOString(),
  }));

  let levelUp: KidsHome["levelUp"] = null;
  if (profile.level > profile.lastSeenLevel) {
    const items = await prisma.avatarItem.findMany({ where: { isNone: false }, orderBy: { sortOrder: "asc" } });
    levelUp = {
      from: profile.lastSeenLevel,
      to: profile.level,
      unlockedItems: unlockedBetween(items, profile.lastSeenLevel, profile.level).map((i) => ({
        id: i.id,
        slot: i.slot as AvatarSlot,
        name: i.name,
        imagePath: i.imagePath,
      })),
    };
  }

  return {
    child: {
      displayName: session.displayName,
      level: profile.level,
      approvedCount: profile.approvedCount,
      remainingToNext: remainingToNext(levels, profile.level, profile.approvedCount),
      levelStart: levels.find((l) => l.level === profile.level)?.requiredCount ?? 0,
      levelEnd: levels.find((l) => l.level === profile.level + 1)?.requiredCount ?? null,
      avatarInitialized: profile.avatarInitialized,
    },
    avatar: layers.get(session.userId) ?? [],
    notices,
    levelUp,
    challenges: cards,
    safetyMessage: safety.length > 0 ? safety[Math.floor(Math.random() * safety.length)]!.text : null,
  };
}

export async function challengeDetail(session: SessionContext, challengeId: string): Promise<KidsChallengeDetail> {
  const c = await findOwnChallenge(prisma, session.userId, challengeId, {
    mission: true,
    submissions: { where: { reviewResult: "REJECTED" }, orderBy: { reviewedAt: "desc" }, take: 1 },
  });
  const card = toCard(c, todayJst());
  return {
    ...card,
    description: c.mission.description,
    rejectionComment: card.status === "REJECTED" ? (c.submissions[0]?.reviewComment ?? null) : null,
  };
}

/** 申請できる状態かを確認する（申請・アップロードURL発行の共通チェック） */
function assertSubmittable(status: string, dueDate: Date | null, verifyMethod: string, method: SubmissionMethod) {
  if (status === "APPROVED") throw errors.conflict("ALREADY_APPROVED", "もう たっせいに なっているよ！");
  if (status === "PENDING") throw errors.conflict("ALREADY_PENDING", "おうちのひとが かくにんちゅうだよ");
  if (!SUBMITTABLE.includes(status as never)) throw errors.conflict(status, "この ミッションは おわったよ");
  if (effectiveStatus(status, dueDate) === "EXPIRED") throw errors.challengeExpired();
  if (!methodAllowed(verifyMethod, method)) throw errors.validation("この ミッションでは その ほうほうは つかえないよ");
}

/** 動画アップロード用URLの発行（基本設計書 5.4） */
export async function createVideoUpload(
  session: SessionContext,
  challengeId: string,
  input: { contentType: string; sizeBytes: number },
): Promise<VideoUploadUrlResponse> {
  const c = await findOwnChallenge(prisma, session.userId, challengeId, { mission: true });
  assertSubmittable(c.status, c.mission.dueDate, c.mission.verifyMethod, "VIDEO");

  const videoId = newId();
  const key = rawKey(session.familyId, videoId);
  // 再撮影に備えて、申請に紐づいていない古い動画は消す
  const old = await prisma.video.findMany({ where: { challengeId: c.id, submissionId: null } });
  await prisma.$transaction(async (tx) => {
    if (old.length > 0) await tx.video.deleteMany({ where: { id: { in: old.map((v) => v.id) } } });
    await tx.video.create({
      data: {
        id: videoId,
        familyId: session.familyId,
        challengeId: c.id,
        status: "UPLOADING",
        rawObject: key,
        contentType: input.contentType,
        sizeBytes: BigInt(input.sizeBytes),
      },
    });
  });
  for (const v of old) await deleteVideoObjects(v).catch((e) => logger.warn("old video cleanup failed", { error: e }));

  const signed = await storage.createUploadUrl("raw", key, input.contentType, VIDEO_MAX_BYTES, UPLOAD_URL_TTL_SEC);
  return {
    videoId,
    uploadUrl: signed.url,
    method: "PUT",
    headers: signed.headers,
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SEC * 1000).toISOString(),
  };
}

/** 達成申請（F-CHL-03, 04, 05） */
export async function submit(
  session: SessionContext,
  challengeId: string,
  input: { method: SubmissionMethod; videoId?: string; stampCode: string | null },
): Promise<SubmissionCreated> {
  const c = await findOwnChallenge(prisma, session.userId, challengeId, { mission: true });
  assertSubmittable(c.status, c.mission.dueDate, c.mission.verifyMethod, input.method);

  if (input.stampCode && !(await prisma.stamp.findUnique({ where: { code: input.stampCode } }))) {
    throw errors.validation("スタンプが ただしくないよ");
  }

  let videoId: string | null = null;
  if (input.method === "VIDEO") {
    const video = await prisma.video.findFirst({ where: { id: input.videoId, challengeId: c.id, submissionId: null } });
    if (!video) throw errors.videoNotUploaded();
    // 変換が先に終わっている場合は元動画が消えているので、確認しない
    if (video.status === "UPLOADING") {
      const stat = await storage.stat("raw", video.rawObject);
      if (!stat || stat.size === 0 || stat.size > VIDEO_MAX_BYTES) throw errors.videoNotUploaded();
    } else if (video.status !== "READY" && video.status !== "PROCESSING") {
      throw errors.videoNotUploaded();
    }
    videoId = video.id;
  }

  const submissionId = newId();
  try {
    await prisma.$transaction(async (tx) => {
      // 先に状態を変える。保護者の直接登録と同時になった場合、ここで0件になり申請は作られない
      if (!(await transition(tx, c.id, SUBMITTABLE, "PENDING"))) {
        const latest = await tx.challenge.findUniqueOrThrow({ where: { id: c.id } });
        assertSubmittable(latest.status, c.mission.dueDate, c.mission.verifyMethod, input.method);
        throw errors.conflict(latest.status);
      }
      await tx.submission.create({
        data: {
          id: submissionId,
          challengeId: c.id,
          source: "CHILD",
          method: input.method,
          stampCode: input.stampCode,
          submittedAt: new Date(),
        },
      });
      if (videoId) {
        await tx.video.update({ where: { id: videoId }, data: { submissionId } });
        // 変換がまだなら PROCESSING にする（変換が先に終わっていれば READY のまま）
        await tx.video.updateMany({ where: { id: videoId, status: "UPLOADING" }, data: { status: "PROCESSING" } });
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw errors.conflict("ALREADY_PENDING", "おうちのひとが かくにんちゅうだよ");
    throw e;
  }
  return { submissionId, challengeStatus: "PENDING" };
}

export async function ackNotices(session: SessionContext, submissionIds: string[]) {
  await prisma.submission.updateMany({
    where: { id: { in: submissionIds }, challenge: { childUserId: session.userId }, childSeenAt: null },
    data: { childSeenAt: new Date() },
  });
}

export async function ackLevelUp(session: SessionContext) {
  await prisma.$executeRaw`UPDATE child_profiles SET last_seen_level = level WHERE user_id = ${session.userId}::uuid`;
}

export async function records(session: SessionContext): Promise<KidsRecords> {
  const [profile, rows] = await Promise.all([
    prisma.childProfile.findUniqueOrThrow({ where: { userId: session.userId } }),
    prisma.challenge.findMany({
      where: { childUserId: session.userId, status: "APPROVED" },
      include: {
        mission: { select: { title: true } },
        submissions: { where: { reviewResult: "APPROVED" }, select: { reviewComment: true }, take: 1 },
      },
      orderBy: { approvedAt: "desc" },
      take: 200,
    }),
  ]);
  return {
    approvedCount: profile.approvedCount,
    items: rows.map((c) => ({
      challengeId: c.id,
      title: c.mission.title,
      approvedAt: (c.approvedAt ?? c.updatedAt).toISOString(),
      comment: c.submissions[0]?.reviewComment ?? null,
    })),
  };
}
