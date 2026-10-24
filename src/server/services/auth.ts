// 認証（F-AUTH-01〜03, 07, 08, 10。基本設計書 1.6.1）

import type { Role } from "@/lib/constants";
import { TERMS_VERSION } from "@/lib/constants";
import type { SignupInput } from "@/lib/schemas";
import { prisma } from "../db";
import { errors } from "../errors";
import { newId } from "../ids";
import { env } from "../env";
import { sendMail } from "../mail";
import { hashPassword, verifyDummy, verifyPassword } from "../auth/password";
import { hashIp, isIpRateLimited } from "../auth/rateLimit";
import {
  createSession,
  deleteSessionByToken,
  deleteUserSessions,
  hashToken,
  newToken,
  REAUTH_WINDOW_MS,
  type SessionContext,
} from "../auth/session";
import { isUniqueViolation } from "../http";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

type Meta = { ip: string; userAgent: string | null };

export const homePath = (role: Role) => (role === "PARENT" ? "/parent" : "/kids");

async function recordLogin(loginIdInput: string, userId: string | null, ipHash: string, success: boolean) {
  await prisma.loginEvent.create({ data: { loginIdInput: loginIdInput.slice(0, 64), userId, ipHash, success } });
}

export async function login(input: { loginId: string; password: string }, meta: Meta) {
  const ipHash = hashIp(meta.ip);
  if (await isIpRateLimited(prisma, ipHash)) {
    await recordLogin(input.loginId, null, ipHash, false);
    throw errors.rateLimited();
  }

  const user = await prisma.user.findUnique({ where: { loginId: input.loginId }, include: { family: true } });
  if (!user || user.deletedAt || user.family.deletedAt) {
    await verifyDummy(input.password);
    await recordLogin(input.loginId, null, ipHash, false);
    throw errors.invalidCredentials();
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordLogin(input.loginId, user.id, ipHash, false);
    throw errors.locked();
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
      // 連続5回失敗で15分ロック（F-AUTH-08）。ロックが明けたら数え直す
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) },
      });
    }
    await recordLogin(input.loginId, user.id, ipHash, false);
    throw errors.invalidCredentials();
  }

  const role = user.role as Role;
  const session = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    return createSession(tx, user.id, role, meta.userAgent);
  });
  await recordLogin(input.loginId, user.id, ipHash, true);
  return { role, redirectTo: homePath(role), ...session };
}

export async function signup(input: SignupInput, meta: Meta) {
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      if (await tx.user.findUnique({ where: { loginId: input.loginId } })) throw errors.loginIdTaken();
      if (await tx.user.findFirst({ where: { role: "PARENT", email: input.email } })) throw errors.emailTaken();

      const familyId = newId();
      const userId = newId();
      await tx.family.create({ data: { id: familyId } });
      await tx.user.create({
        data: {
          id: userId,
          familyId,
          role: "PARENT",
          loginId: input.loginId,
          passwordHash,
          displayName: input.displayName,
          email: input.email,
        },
      });
      // 規約に同意した日時と版を記録する（NF-S-09）
      await tx.parentSettings.create({ data: { userId, termsAgreedAt: new Date(), termsVersion: TERMS_VERSION } });
      const session = await createSession(tx, userId, "PARENT", meta.userAgent);
      return { role: "PARENT" as const, redirectTo: "/parent", ...session };
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const target = String((e as { meta?: { target?: unknown } }).meta?.target ?? "");
      throw target.includes("email") ? errors.emailTaken() : errors.loginIdTaken();
    }
    throw e;
  }
}

export async function logout(token: string | null) {
  if (token) await deleteSessionByToken(token);
}

/** 再認証（F-AUTH-10）。共用端末で子どもに試されないよう、ログインと同じIP制限をかける */
export async function reauth(session: SessionContext, password: string, meta: Meta) {
  const ipHash = hashIp(meta.ip);
  if (await isIpRateLimited(prisma, ipHash)) throw errors.rateLimited();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const ok = await verifyPassword(user.passwordHash, password);
  await recordLogin(user.loginId, user.id, ipHash, ok);
  if (!ok) throw errors.invalidCredentials();
  const elevatedUntil = new Date(Date.now() + REAUTH_WINDOW_MS);
  await prisma.session.update({ where: { id: session.sessionId }, data: { elevatedUntil } });
  return { elevatedUntil: elevatedUntil.toISOString() };
}

/** パスワード再設定メール（F-AUTH-07）。登録の有無にかかわらず同じ応答を返す */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findFirst({
    where: { role: "PARENT", email, deletedAt: null, family: { deletedAt: null } },
  });
  if (!user) return;
  const token = newToken();
  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });
  await sendMail({
    to: email,
    subject: "パスワード再設定のご案内",
    text: [
      `${user.displayName} 様`,
      "",
      "以下のURLから30分以内に新しいパスワードを設定してください。",
      `${env.appBaseUrl}/password-reset/${token}`,
      "",
      "このメールに心当たりがない場合は、破棄してください。",
    ].join("\n"),
  });
}

export async function confirmPasswordReset(token: string, password: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt <= new Date() || record.user.deletedAt) {
    throw errors.validation("URLの有効期限が切れています。もう一度やり直してください");
  }
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const used = await tx.passwordResetToken.updateMany({
      where: { tokenHash: record.tokenHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count !== 1) throw errors.validation("URLの有効期限が切れています。もう一度やり直してください");
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
    await deleteUserSessions(tx, record.userId);
  });
}
