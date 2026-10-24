// IPごとのログイン試行の制限（基本設計書 6.3 NF-S-05：1分20回まで）
import { createHmac } from "node:crypto";
import { env } from "../env";
import type { Db } from "../db";

export const LOGIN_ATTEMPTS_PER_MINUTE = 20;

/** IPアドレスを生のまま保存せず、HMACにする */
export function hashIp(ip: string): string {
  return createHmac("sha256", env.ipHashSecret).update(ip).digest("hex");
}

export async function isIpRateLimited(db: Db, ipHash: string): Promise<boolean> {
  const count = await db.loginEvent.count({
    where: { ipHash, createdAt: { gt: new Date(Date.now() - 60_000) } },
  });
  return count >= LOGIN_ATTEMPTS_PER_MINUTE;
}
