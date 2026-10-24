// セッション管理（基本設計書 4.3 sessions / 6.3 NF-S-03）
// Cookie にはランダムなトークン、DBにはそのSHA-256ハッシュだけを保存する。

import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@/lib/constants";
import { todayJst, fromYmd } from "@/lib/date";
import { prisma, type Db } from "../db";

export const SESSION_TTL_SEC: Record<Role, number> = {
  PARENT: 30 * 24 * 60 * 60,
  CHILD: 7 * 24 * 60 * 60,
};

/** 再認証の有効時間【要確認 BQ-05】 */
export const REAUTH_WINDOW_MS = 10 * 60 * 1000;

/** last_active_at の更新は5分に1回まで */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type SessionContext = {
  sessionId: string;
  token: string;
  userId: string;
  familyId: string;
  role: Role;
  displayName: string;
  elevatedUntil: Date | null;
  /** 期限を延ばした（Cookieも出し直す必要がある） */
  refreshed: boolean;
  ttlSec: number;
};

export const newToken = (): string => randomBytes(32).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export async function createSession(db: Db, userId: string, role: Role, userAgent: string | null) {
  const token = newToken();
  const ttlSec = SESSION_TTL_SEC[role];
  await db.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + ttlSec * 1000),
      userAgent: userAgent?.slice(0, 300) ?? null,
    },
  });
  return { token, ttlSec };
}

export async function loadSession(token: string): Promise<SessionContext | null> {
  const id = hashToken(token);
  const s = await prisma.session.findUnique({
    where: { id },
    include: { user: { include: { family: true } } },
  });
  const now = new Date();
  if (!s || s.expiresAt <= now || s.user.deletedAt || s.user.family.deletedAt) return null;

  const role = s.user.role as Role;
  const ttlSec = SESSION_TTL_SEC[role];
  let refreshed = false;
  if (now.getTime() - s.lastActiveAt.getTime() > TOUCH_INTERVAL_MS) {
    refreshed = true;
    await prisma.session.update({
      where: { id },
      data: { lastActiveAt: now, expiresAt: new Date(now.getTime() + ttlSec * 1000) },
    });
    // KPI G-2 用のアクセス日の記録（T-209、BQ-07）
    await prisma.activityDay.upsert({
      where: { userId_date: { userId: s.userId, date: fromYmd(todayJst(now)) } },
      create: { userId: s.userId, date: fromYmd(todayJst(now)) },
      update: {},
    });
  }

  return {
    sessionId: id,
    token,
    userId: s.userId,
    familyId: s.user.familyId,
    role,
    displayName: s.user.displayName,
    elevatedUntil: s.elevatedUntil,
    refreshed,
    ttlSec,
  };
}

export async function deleteSessionByToken(token: string) {
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}

/** そのユーザのセッションをすべて無効にする（パスワード変更・アカウント削除時） */
export async function deleteUserSessions(db: Db, userId: string, exceptSessionId?: string) {
  await db.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}
