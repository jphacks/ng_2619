// ミッション管理（F-MIS-01〜05、基本設計書 4.6）

import type { Prisma } from "@prisma/client";
import type { ChallengeStatus, TargetUnit, VerifyMethod } from "@/lib/constants";
import { fromYmd, todayJst, toYmd } from "@/lib/date";
import type { MissionCreateInput, MissionUpdateInput } from "@/lib/schemas";
import type { Mission, MissionChallenge, MissionDetail, MissionListResponse } from "@/lib/types";
import { prisma } from "../db";
import { errors } from "../errors";
import { newId } from "../ids";
import type { SessionContext } from "../auth/session";
import { effectiveStatus, SUBMITTABLE, transition } from "../domain/challenge";
import { assertUuid, findChallenge, findMission } from "../repositories/scoped";

const missionInclude = (childId?: string) =>
  ({
    challenges: {
      where: { child: { deletedAt: null }, ...(childId ? { childUserId: childId } : {}) },
      include: {
        child: { select: { displayName: true } },
        submissions: { where: { reviewResult: null }, select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    },
  }) satisfies Prisma.MissionInclude;

type MissionWithChallenges = Prisma.MissionGetPayload<{ include: ReturnType<typeof missionInclude> }>;

function toMission(m: MissionWithChallenges, today = todayJst()): Mission {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    categoryCode: m.categoryCode,
    targetValue: m.targetValue,
    targetUnit: m.targetUnit as TargetUnit | null,
    verifyMethod: m.verifyMethod as VerifyMethod,
    dueDate: m.dueDate ? toYmd(m.dueDate) : null,
    createdAt: m.createdAt.toISOString(),
    challenges: m.challenges.map((c): MissionChallenge => {
      const status = effectiveStatus(c.status, m.dueDate, today);
      return {
        id: c.id,
        childId: c.childUserId,
        childName: c.child.displayName,
        status,
        approvedAt: c.approvedAt?.toISOString() ?? null,
        canComplete: SUBMITTABLE.includes(status),
        pendingSubmissionId: status === "PENDING" ? (c.submissions[0]?.id ?? null) : null,
      };
    }),
  };
}

/** 状態での絞り込み。期限切れは DB の状態と期限日の両方で判定する */
function statusFilter(status: ChallengeStatus, today: Date): Prisma.ChallengeWhereInput {
  const notPastDue: Prisma.MissionWhereInput = { OR: [{ dueDate: null }, { dueDate: { gte: today } }] };
  switch (status) {
    case "OPEN":
    case "REJECTED":
      return { status, mission: notPastDue };
    case "EXPIRED":
      return {
        OR: [{ status: "EXPIRED" }, { status: { in: SUBMITTABLE }, mission: { dueDate: { lt: today } } }],
      };
    default:
      return { status };
  }
}

export async function listMissions(
  familyId: string,
  q: { childId?: string; status?: ChallengeStatus; cursor?: string; limit: number },
): Promise<MissionListResponse> {
  const today = fromYmd(todayJst());
  const challengeWhere: Prisma.ChallengeWhereInput = {
    child: { deletedAt: null },
    ...(q.childId ? { childUserId: assertUuid(q.childId) } : {}),
    ...(q.status ? statusFilter(q.status, today) : {}),
  };
  const rows = await prisma.mission.findMany({
    where: { familyId, challenges: { some: challengeWhere } },
    include: missionInclude(q.childId),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: assertUuid(q.cursor) }, skip: 1 } : {}),
  });
  const page = rows.slice(0, q.limit);
  return { items: page.map((m) => toMission(m)), nextCursor: rows.length > q.limit ? page[page.length - 1]!.id : null };
}

export async function createMission(session: SessionContext, input: MissionCreateInput) {
  if (input.dueDate && input.dueDate < todayJst()) {
    throw errors.validation("期限日は今日以降にしてください", { dueDate: "期限日は今日以降にしてください" });
  }
  const category = await prisma.missionCategory.findFirst({ where: { code: input.categoryCode, familyId: session.familyId } });
  if (!category) throw errors.validation("カテゴリを選んでください", { categoryCode: "カテゴリを選んでください" });

  const childIds = [...new Set(input.childIds)];
  const children = await prisma.user.findMany({
    where: { id: { in: childIds }, familyId: session.familyId, role: "CHILD", deletedAt: null },
    select: { id: true },
  });
  if (children.length !== childIds.length) throw errors.notFound("割り当て先の子どもが見つかりません");

  const missionId = newId();
  const challengeIds = childIds.map(() => newId());
  await prisma.$transaction(async (tx) => {
    await tx.mission.create({
      data: {
        id: missionId,
        familyId: session.familyId,
        createdBy: session.userId,
        title: input.title,
        description: input.description,
        categoryCode: input.categoryCode,
        targetValue: input.targetValue,
        targetUnit: input.targetUnit,
        verifyMethod: "EITHER",
        dueDate: input.dueDate ? fromYmd(input.dueDate) : null,
      },
    });
    await tx.challenge.createMany({
      data: childIds.map((childUserId, i) => ({
        id: challengeIds[i]!,
        missionId,
        familyId: session.familyId,
        childUserId,
        status: "OPEN",
      })),
    });
  });
  return { missionId, challengeIds };
}

/** 編集できる項目（基本設計書 4.6） */
function editability(statuses: string[]): MissionDetail["editable"] {
  if (statuses.includes("APPROVED")) {
    return { allowed: false, verifyMethod: false, reason: "達成済みの子どもがいるため編集できません。複製して作り直してください" };
  }
  if (statuses.some((s) => s === "PENDING" || s === "REJECTED")) {
    return { allowed: true, verifyMethod: false, reason: "申請中・差し戻し中の子どもがいるため、確認方法は変更できません" };
  }
  return { allowed: true, verifyMethod: true, reason: null };
}

export async function getMission(familyId: string, missionId: string): Promise<MissionDetail> {
  const m = await findMission(prisma, familyId, missionId, missionInclude());
  return { ...toMission(m), editable: editability(m.challenges.map((c) => c.status)) };
}

export async function updateMission(familyId: string, missionId: string, input: MissionUpdateInput): Promise<MissionDetail> {
  await prisma.$transaction(async (tx) => {
    const m = await findMission(tx, familyId, missionId, { challenges: { select: { status: true } } });
    const editable = editability(m.challenges.map((c) => c.status));
    if (!editable.allowed) throw errors.conflict("HAS_APPROVED", editable.reason!);
    if (input.verifyMethod !== undefined && input.verifyMethod !== m.verifyMethod && !editable.verifyMethod) {
      throw errors.conflict("VERIFY_METHOD_LOCKED", editable.reason!);
    }
    if (input.dueDate && input.dueDate < todayJst()) {
      throw errors.validation("期限日は今日以降にしてください", { dueDate: "期限日は今日以降にしてください" });
    }
    await tx.mission.update({
      where: { id: m.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.verifyMethod !== undefined ? { verifyMethod: input.verifyMethod } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? fromYmd(input.dueDate) : null } : {}),
      },
    });
    // 期限を延ばした場合、まだ申請できる子のチャレンジは期限切れから戻す
    if (input.dueDate !== undefined) {
      await tx.challenge.updateMany({ where: { missionId: m.id, status: "EXPIRED" }, data: { status: "OPEN" } });
    }
  });
  return getMission(familyId, missionId);
}

/** 取り下げ（F-MIS-04）。挑戦中・差し戻しのチャレンジのみ */
export async function archiveChallenge(familyId: string, challengeId: string) {
  const c = await findChallenge(prisma, familyId, challengeId);
  const ok = await transition(prisma, c.id, [...SUBMITTABLE, "EXPIRED"], "ARCHIVED");
  if (!ok) throw errors.conflict("NOT_ARCHIVABLE", "承認待ち・達成済みのミッションは取り下げられません");
  return { challengeStatus: "ARCHIVED" as const };
}
