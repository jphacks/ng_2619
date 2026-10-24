// 家族単位で絞り込んだ取得（基本設計書 1.4 / NF-S-04）。
// 家族のデータを取るときは、必ずここの関数を使い familyId を渡す。他の家族のIDなら 404 にする。

import type { Prisma } from "@prisma/client";
import type { Db } from "../db";
import { errors } from "../errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(id: string | undefined): string {
  if (!id || !UUID_RE.test(id)) throw errors.notFound();
  return id;
}

export async function findChild(db: Db, familyId: string, childId: string) {
  const child = await db.user.findFirst({
    where: { id: assertUuid(childId), familyId, role: "CHILD", deletedAt: null },
    include: { childProfile: true },
  });
  if (!child || !child.childProfile) throw errors.notFound();
  return { ...child, childProfile: child.childProfile };
}

export async function findMission<I extends Prisma.MissionInclude>(db: Db, familyId: string, missionId: string, include?: I) {
  const mission = await db.mission.findFirst({ where: { id: assertUuid(missionId), familyId }, include });
  if (!mission) throw errors.notFound();
  return mission as Prisma.MissionGetPayload<{ include: I }>;
}

export async function findChallenge<I extends Prisma.ChallengeInclude>(
  db: Db,
  familyId: string,
  challengeId: string,
  include?: I,
) {
  const challenge = await db.challenge.findFirst({
    where: { id: assertUuid(challengeId), familyId, child: { deletedAt: null } },
    include,
  });
  if (!challenge) throw errors.notFound();
  return challenge as Prisma.ChallengeGetPayload<{ include: I }>;
}

/** 子ども本人のチャレンジ */
export async function findOwnChallenge<I extends Prisma.ChallengeInclude>(
  db: Db,
  childUserId: string,
  challengeId: string,
  include?: I,
) {
  const challenge = await db.challenge.findFirst({ where: { id: assertUuid(challengeId), childUserId }, include });
  if (!challenge) throw errors.notFound();
  return challenge as Prisma.ChallengeGetPayload<{ include: I }>;
}

export async function findSubmission<I extends Prisma.SubmissionInclude>(
  db: Db,
  familyId: string,
  submissionId: string,
  include?: I,
) {
  const submission = await db.submission.findFirst({
    where: { id: assertUuid(submissionId), challenge: { familyId, child: { deletedAt: null } } },
    include,
  });
  if (!submission) throw errors.notFound();
  return submission as Prisma.SubmissionGetPayload<{ include: I }>;
}
