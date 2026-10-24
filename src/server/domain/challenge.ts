// チャレンジの状態遷移（基本設計書 4.4）。状態を変える処理はすべてここを通す。

import type { ChallengeStatus, SubmissionMethod, VerifyMethod } from "@/lib/constants";
import { isPastDue, todayJst } from "@/lib/date";
import type { Db } from "../db";

/** 子どもが申請できる／保護者が直接登録できる状態 */
export const SUBMITTABLE: ChallengeStatus[] = ["OPEN", "REJECTED"];

/** 表示用の状態。DBが OPEN/REJECTED でも期限を過ぎていれば EXPIRED として扱う（バッチの失敗に備える。2.2） */
export function effectiveStatus(status: string, dueDate: Date | null, today: string = todayJst()): ChallengeStatus {
  const s = status as ChallengeStatus;
  if (SUBMITTABLE.includes(s) && isPastDue(dueDate, today)) return "EXPIRED";
  return s;
}

/** 申請方法が、ミッションの確認方法で許されているか */
export function methodAllowed(verifyMethod: string, method: SubmissionMethod): boolean {
  const v = verifyMethod as VerifyMethod;
  return v === "EITHER" || v === method;
}

/**
 * 遷移前の状態を条件にして更新する（D-2）。
 * 同時に更新された場合、後から来た方は0件更新になるので false を返す。
 */
export async function transition(
  db: Db,
  challengeId: string,
  from: ChallengeStatus[],
  to: ChallengeStatus,
  extra: { approvedAt?: Date } = {},
): Promise<boolean> {
  const r = await db.challenge.updateMany({
    where: { id: challengeId, status: { in: from } },
    data: { status: to, ...extra },
  });
  return r.count === 1;
}
