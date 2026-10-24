// 承認・差し戻し・直接登録（F-APV-02〜05, 08。基本設計書 1.6.3 / 1.6.4）

import type { SubmissionMethod, TargetUnit, VerifyMethod } from "@/lib/constants";
import { isPastDue, toYmd } from "@/lib/date";
import type { PendingListResponse, ReviewResult, SubmissionDetail, VideoStatus } from "@/lib/types";
import { prisma, type Db } from "../db";
import { errors } from "../errors";
import { newId } from "../ids";
import type { SessionContext } from "../auth/session";
import { SUBMITTABLE, transition } from "../domain/challenge";
import { addApproval } from "../domain/level";
import { assertUuid, findChallenge, findSubmission } from "../repositories/scoped";
import { DOWNLOAD_URL_TTL_SEC, storage } from "../storage";

/** 判断から30日後に動画を削除する（要件定義書 4.1.3） */
const VIDEO_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const pendingWhere = (familyId: string) => ({
  reviewResult: null,
  challenge: { familyId, status: "PENDING", child: { deletedAt: null } },
});

export async function countPending(db: Db, familyId: string): Promise<number> {
  return db.submission.count({ where: pendingWhere(familyId) });
}

/** 承認待ち一覧（申請日時の古い順） */
export async function listPending(familyId: string, q: { cursor?: string; limit: number }): Promise<PendingListResponse> {
  const rows = await prisma.submission.findMany({
    where: pendingWhere(familyId),
    include: {
      stamp: { select: { label: true } },
      challenge: { include: { mission: { select: { title: true } }, child: { select: { displayName: true } } } },
    },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: assertUuid(q.cursor) }, skip: 1 } : {}),
  });
  const page = rows.slice(0, q.limit);
  return {
    items: page.map((s) => ({
      id: s.id,
      challengeId: s.challengeId,
      childId: s.challenge.childUserId,
      childName: s.challenge.child.displayName,
      missionTitle: s.challenge.mission.title,
      method: s.method as SubmissionMethod,
      submittedAt: s.submittedAt.toISOString(),
      stampLabel: s.stamp?.label ?? null,
    })),
    nextCursor: rows.length > q.limit ? page[page.length - 1]!.id : null,
  };
}

export async function getSubmissionDetail(familyId: string, submissionId: string): Promise<SubmissionDetail> {
  const s = await findSubmission(prisma, familyId, submissionId, {
    stamp: true,
    video: true,
    challenge: { include: { mission: true, child: { select: { id: true, displayName: true } } } },
  });
  const m = s.challenge.mission;
  return {
    id: s.id,
    challengeId: s.challengeId,
    challengeStatus: s.challenge.status as SubmissionDetail["challengeStatus"],
    source: s.source as "CHILD" | "PARENT",
    method: s.method as SubmissionMethod,
    submittedAt: s.submittedAt.toISOString(),
    stampLabel: s.stamp?.label ?? null,
    reviewResult: s.reviewResult as SubmissionDetail["reviewResult"],
    reviewComment: s.reviewComment,
    child: { id: s.challenge.child.id, displayName: s.challenge.child.displayName },
    mission: {
      id: m.id,
      title: m.title,
      description: m.description,
      targetValue: m.targetValue,
      targetUnit: m.targetUnit as TargetUnit | null,
      verifyMethod: m.verifyMethod as VerifyMethod,
      dueDate: m.dueDate ? toYmd(m.dueDate) : null,
    },
    video: s.video ? { status: s.video.status as VideoStatus, failureReason: s.video.failureReason } : null,
  };
}

/** 再生用の署名付きURL（有効10分） */
export async function getVideoUrl(familyId: string, submissionId: string) {
  const s = await findSubmission(prisma, familyId, submissionId, { video: true });
  if (!s.video) throw errors.notFound("動画がありません");
  if (s.video.status !== "READY" || !s.video.convertedObject) {
    throw errors.conflict(s.video.status, "動画はまだ再生できません");
  }
  const url = await storage.createDownloadUrl("videos", s.video.convertedObject, DOWNLOAD_URL_TTL_SEC);
  return { url, expiresAt: new Date(Date.now() + DOWNLOAD_URL_TTL_SEC * 1000).toISOString() };
}

async function scheduleVideoDeletion(db: Db, submissionId: string, now: Date) {
  await db.video.updateMany({
    where: { submissionId, deletedAt: null },
    data: { deleteScheduledAt: new Date(now.getTime() + VIDEO_RETENTION_MS) },
  });
}

/** 申請を判断済みにする。判断待ちでなければ 409（D-2） */
async function markReviewed(
  db: Db,
  submissionId: string,
  result: "APPROVED" | "REJECTED",
  reviewerId: string,
  comment: string | null,
  now: Date,
) {
  const r = await db.submission.updateMany({
    where: { id: submissionId, reviewResult: null },
    data: { reviewResult: result, reviewerId, reviewComment: comment, reviewedAt: now },
  });
  if (r.count !== 1) throw errors.conflict("ALREADY_REVIEWED", "すでに処理済みです");
}

export async function approve(session: SessionContext, submissionId: string, comment: string | null): Promise<ReviewResult> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const s = await findSubmission(tx, session.familyId, submissionId, { challenge: true });
    if (s.reviewResult !== null) throw errors.conflict("ALREADY_REVIEWED", "すでに処理済みです");
    // 状態を条件にした更新で、二重承認・承認と差し戻しの同時実行を防ぐ（後から来た方は0件更新）
    if (!(await transition(tx, s.challengeId, ["PENDING"], "APPROVED", { approvedAt: now }))) {
      throw errors.conflict("NOT_PENDING", "すでに処理済みです");
    }
    await markReviewed(tx, s.id, "APPROVED", session.userId, comment, now);
    const level = await addApproval(tx, s.challenge.childUserId);
    await scheduleVideoDeletion(tx, s.id, now);
    return {
      challengeStatus: "APPROVED",
      submissionId: s.id,
      child: { approvedCount: level.approvedCount, level: level.level, leveledUp: level.leveledUp },
    };
  });
}

export async function reject(session: SessionContext, submissionId: string, comment: string): Promise<ReviewResult> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const s = await findSubmission(tx, session.familyId, submissionId, { challenge: { include: { child: { include: { childProfile: true } } } } });
    if (s.reviewResult !== null) throw errors.conflict("ALREADY_REVIEWED", "すでに処理済みです");
    if (!(await transition(tx, s.challengeId, ["PENDING"], "REJECTED"))) {
      throw errors.conflict("NOT_PENDING", "すでに処理済みです");
    }
    await markReviewed(tx, s.id, "REJECTED", session.userId, comment, now);
    await scheduleVideoDeletion(tx, s.id, now);
    const profile = s.challenge.child.childProfile;
    return {
      challengeStatus: "REJECTED",
      submissionId: s.id,
      child: { approvedCount: profile?.approvedCount ?? 0, level: profile?.level ?? 1, leveledUp: false },
    };
  });
}

/** 保護者による達成の直接登録（F-APV-08, R-7, R-8） */
export async function completeDirectly(session: SessionContext, challengeId: string, comment: string | null): Promise<ReviewResult> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const c = await findChallenge(tx, session.familyId, challengeId, { mission: true });
    if (c.status === "PENDING") {
      throw errors.conflict("PENDING_EXISTS", "承認待ちの申請があります。承認待ち一覧から承認してください");
    }
    if (!SUBMITTABLE.includes(c.status as never)) throw errors.conflict(c.status, "このミッションは達成を登録できません");
    if (isPastDue(c.mission.dueDate)) throw errors.challengeExpired();

    if (!(await transition(tx, c.id, SUBMITTABLE, "APPROVED", { approvedAt: now }))) {
      // 子どもの申請と同時になった場合など
      const latest = await tx.challenge.findUniqueOrThrow({ where: { id: c.id } });
      throw latest.status === "PENDING"
        ? errors.conflict("PENDING_EXISTS", "承認待ちの申請があります。承認待ち一覧から承認してください")
        : errors.conflict(latest.status, "状態が変わりました。画面を読み込み直してください");
    }
    const submissionId = newId();
    await tx.submission.create({
      data: {
        id: submissionId,
        challengeId: c.id,
        source: "PARENT",
        method: "VISUAL",
        submittedAt: now,
        reviewResult: "APPROVED",
        reviewerId: session.userId,
        reviewComment: comment,
        reviewedAt: now,
      },
    });
    const level = await addApproval(tx, c.childUserId);
    return {
      challengeStatus: "APPROVED",
      submissionId,
      child: { approvedCount: level.approvedCount, level: level.level, leveledUp: level.leveledUp },
    };
  });
}
