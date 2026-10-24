// 保護者の再認証（F-AUTH-10 / NF-S-10）
import { prisma } from "../db";
import { errors } from "../errors";
import type { SessionContext } from "./session";

/** 再認証が必要な操作の前に呼ぶ。設定でOFFの家庭は確認しない */
export async function assertReauth(session: SessionContext): Promise<void> {
  if (session.role !== "PARENT") throw errors.forbidden();
  const settings = await prisma.parentSettings.findUnique({ where: { userId: session.userId } });
  if (settings && !settings.reauthRequired) return;
  if (!session.elevatedUntil || session.elevatedUntil.getTime() <= Date.now()) throw errors.reauthRequired();
}
