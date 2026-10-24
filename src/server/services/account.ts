// 保護者アカウント設定（F-AUTH-11 / P-08）

import type { MeResponse } from "@/lib/types";
import type { Role } from "@/lib/constants";
import { prisma } from "../db";
import { errors } from "../errors";
import { hashPassword, verifyPassword } from "../auth/password";
import { deleteUserSessions, type SessionContext } from "../auth/session";
import { isUniqueViolation } from "../http";

export async function getMe(session: SessionContext): Promise<MeResponse> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId }, include: { parentSettings: true } });
  return {
    userId: user.id,
    role: user.role as Role,
    displayName: user.displayName,
    loginId: user.loginId,
    email: user.role === "PARENT" ? user.email : null,
    reauthRequired: user.parentSettings ? user.parentSettings.reauthRequired : null,
  };
}

export async function updateMe(session: SessionContext, input: { displayName?: string; email?: string }) {
  if (input.email) {
    const other = await prisma.user.findFirst({ where: { role: "PARENT", email: input.email, id: { not: session.userId } } });
    if (other) throw errors.emailTaken();
  }
  try {
    await prisma.user.update({ where: { id: session.userId }, data: input });
  } catch (e) {
    if (isUniqueViolation(e)) throw errors.emailTaken();
    throw e;
  }
  return getMe(session);
}

/** パスワード変更。ほかの端末のセッションは無効にする */
export async function changePassword(session: SessionContext, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw errors.validation("現在のパスワードが違います", { currentPassword: "現在のパスワードが違います" });
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date() } });
    await deleteUserSessions(tx, user.id, session.sessionId);
  });
}

export async function updateSettings(session: SessionContext, reauthRequired: boolean) {
  await prisma.parentSettings.update({ where: { userId: session.userId }, data: { reauthRequired } });
  return getMe(session);
}

/**
 * 退会：家族全体を論理削除し、全員のセッションを無効にし、動画を削除予定にする。
 * 物理削除は F-BAT-04 が29日後に行う（NF-O-04）。
 */
export async function withdraw(session: SessionContext) {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.family.update({ where: { id: session.familyId }, data: { deletedAt: now } });
    await tx.user.updateMany({ where: { familyId: session.familyId, deletedAt: null }, data: { deletedAt: now } });
    await tx.session.deleteMany({ where: { user: { familyId: session.familyId } } });
    await tx.video.updateMany({
      where: { familyId: session.familyId, deletedAt: null },
      data: { deleteScheduledAt: now },
    });
  });
}
