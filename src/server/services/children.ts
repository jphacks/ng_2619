// 子どもアカウントの管理（F-AUTH-04〜06）と達成状況（F-APV-06）

import { MAX_CHILDREN_PER_FAMILY, type ChallengeStatus, type VerifyMethod } from "@/lib/constants";
import { startOfWeekJst, todayJst, toYmd } from "@/lib/date";
import type { ChildCard, ChildSummary } from "@/lib/types";
import { prisma, type Db } from "../db";
import { errors } from "../errors";
import { newId } from "../ids";
import { hashPassword } from "../auth/password";
import { deleteUserSessions, type SessionContext } from "../auth/session";
import { effectiveStatus, SUBMITTABLE } from "../domain/challenge";
import { getLevels, remainingToNext } from "../domain/level";
import { findChild } from "../repositories/scoped";
import { createDefaultEquips, loadAvatarLayers } from "./avatar";
import { isUniqueViolation } from "../http";

const ACTIVE: ChallengeStatus[] = ["OPEN", "PENDING", "REJECTED"];

/** P-01 / P-07 の子どもカード */
export async function listChildCards(db: Db, familyId: string): Promise<ChildCard[]> {
  const children = await db.user.findMany({
    where: { familyId, role: "CHILD", deletedAt: null },
    include: { childProfile: true },
    orderBy: { createdAt: "asc" },
  });
  if (children.length === 0) return [];
  const ids = children.map((c) => c.id);
  const today = todayJst();
  const [active, weekApproved, layers] = await Promise.all([
    db.challenge.findMany({
      where: { childUserId: { in: ids }, status: { in: ACTIVE } },
      select: { childUserId: true, status: true, mission: { select: { dueDate: true } } },
    }),
    db.challenge.groupBy({
      by: ["childUserId"],
      where: { childUserId: { in: ids }, status: "APPROVED", approvedAt: { gte: startOfWeekJst() } },
      _count: { _all: true },
    }),
    loadAvatarLayers(db, ids),
  ]);
  const activeCount = new Map<string, number>();
  for (const c of active) {
    if (effectiveStatus(c.status, c.mission.dueDate, today) === "EXPIRED") continue;
    activeCount.set(c.childUserId, (activeCount.get(c.childUserId) ?? 0) + 1);
  }
  const weekCount = new Map(weekApproved.map((w) => [w.childUserId, w._count._all]));
  return children.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    grade: c.childProfile?.grade ?? 1,
    loginId: c.loginId,
    level: c.childProfile?.level ?? 1,
    approvedCount: c.childProfile?.approvedCount ?? 0,
    activeCount: activeCount.get(c.id) ?? 0,
    weekApprovedCount: weekCount.get(c.id) ?? 0,
    avatar: layers.get(c.id) ?? [],
  }));
}

export async function createChild(
  session: SessionContext,
  input: { displayName: string; grade: number; loginId: string; password: string },
) {
  const passwordHash = await hashPassword(input.password);
  try {
    const id = await prisma.$transaction(async (tx) => {
      // 上限は家族単位で数える（DC-04）
      const count = await tx.user.count({ where: { familyId: session.familyId, role: "CHILD", deletedAt: null } });
      if (count >= MAX_CHILDREN_PER_FAMILY) throw errors.childLimit(MAX_CHILDREN_PER_FAMILY);
      if (await tx.user.findUnique({ where: { loginId: input.loginId } })) throw errors.loginIdTaken();
      const id = newId();
      await tx.user.create({
        data: {
          id,
          familyId: session.familyId,
          role: "CHILD",
          loginId: input.loginId,
          passwordHash,
          displayName: input.displayName,
        },
      });
      await tx.childProfile.create({ data: { userId: id, grade: input.grade } });
      await createDefaultEquips(tx, id);
      return id;
    });
    const cards = await listChildCards(prisma, session.familyId);
    return cards.find((c) => c.id === id)!;
  } catch (e) {
    if (isUniqueViolation(e)) throw errors.loginIdTaken();
    throw e;
  }
}

export async function updateChild(session: SessionContext, childId: string, input: { displayName?: string; grade?: number }) {
  const child = await findChild(prisma, session.familyId, childId);
  await prisma.$transaction(async (tx) => {
    if (input.displayName !== undefined) {
      await tx.user.update({ where: { id: child.id }, data: { displayName: input.displayName } });
    }
    if (input.grade !== undefined) {
      await tx.childProfile.update({ where: { userId: child.id }, data: { grade: input.grade } });
    }
  });
  const cards = await listChildCards(prisma, session.familyId);
  return cards.find((c) => c.id === child.id)!;
}

/** 子どもの削除：論理削除し、セッションを無効にし、動画を削除予定にする（F-AUTH-05） */
export async function deleteChild(session: SessionContext, childId: string) {
  const child = await findChild(prisma, session.familyId, childId);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: child.id }, data: { deletedAt: now } });
    await deleteUserSessions(tx, child.id);
    await tx.video.updateMany({ where: { challenge: { childUserId: child.id }, deletedAt: null }, data: { deleteScheduledAt: now } });
  });
}

export async function resetChildPassword(session: SessionContext, childId: string, password: string) {
  const child = await findChild(prisma, session.familyId, childId);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: child.id },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
    await deleteUserSessions(tx, child.id);
  });
}

/** P-06 子ども詳細 */
export async function childSummary(familyId: string, childId: string): Promise<ChildSummary> {
  const child = await findChild(prisma, familyId, childId);
  const today = todayJst();
  const [levels, layers, active, approved] = await Promise.all([
    getLevels(prisma),
    loadAvatarLayers(prisma, [child.id]),
    prisma.challenge.findMany({
      where: { childUserId: child.id, status: { in: ACTIVE } },
      include: { mission: true, submissions: { where: { reviewResult: null }, select: { id: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.challenge.findMany({
      where: { childUserId: child.id, status: "APPROVED" },
      include: {
        mission: { select: { title: true } },
        submissions: { where: { reviewResult: "APPROVED" }, select: { source: true }, take: 1 },
      },
      orderBy: { approvedAt: "desc" },
      take: 200,
    }),
  ]);
  const profile = child.childProfile;
  return {
    id: child.id,
    displayName: child.displayName,
    grade: profile.grade,
    level: profile.level,
    approvedCount: profile.approvedCount,
    remainingToNext: remainingToNext(levels, profile.level, profile.approvedCount),
    avatar: layers.get(child.id) ?? [],
    activeChallenges: active
      .map((c) => {
        const status = effectiveStatus(c.status, c.mission.dueDate, today);
        return {
          challengeId: c.id,
          missionId: c.missionId,
          title: c.mission.title,
          status,
          dueDate: c.mission.dueDate ? toYmd(c.mission.dueDate) : null,
          verifyMethod: c.mission.verifyMethod as VerifyMethod,
          canComplete: SUBMITTABLE.includes(status),
          pendingSubmissionId: status === "PENDING" ? (c.submissions[0]?.id ?? null) : null,
        };
      })
      .filter((c) => c.status !== "EXPIRED"),
    history: approved.map((c) => ({
      challengeId: c.id,
      title: c.mission.title,
      approvedAt: (c.approvedAt ?? c.updatedAt).toISOString(),
      source: (c.submissions[0]?.source ?? "CHILD") as "CHILD" | "PARENT",
    })),
  };
}
