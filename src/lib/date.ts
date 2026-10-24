// 日付の扱い（基本設計書 4.1 D-4）
// 日時はUTCで保存し、期限日は「日本時間の日付」として扱う。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 日本時間での今日の日付（YYYY-MM-DD） */
export function todayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** DBの date 型（UTC 0時の Date）を YYYY-MM-DD にする */
export function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** YYYY-MM-DD を DB の date 型に入れる Date にする */
export function fromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** 期限切れか（期限日 < 今日）。期限なしは期限切れにならない */
export function isPastDue(dueDate: Date | string | null | undefined, today: string = todayJst()): boolean {
  if (!dueDate) return false;
  const ymd = typeof dueDate === "string" ? dueDate : toYmd(dueDate);
  return ymd < today;
}

/** 日本時間で今週の月曜 0:00 を表す Date（BQ-18） */
export function startOfWeekJst(now: Date = new Date()): Date {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const day = jst.getUTCDay(); // 0=日曜
  const diffToMonday = (day + 6) % 7;
  const mondayJst = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() - diffToMonday);
  return new Date(mondayJst - JST_OFFSET_MS);
}

/** 「11月30日」のような表示 */
export function formatMonthDay(value: string | Date): string {
  const ymd = typeof value === "string" ? value.slice(0, 10) : todayJst(value);
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}月${d}日`;
}

/** 子ども画面向け「11がつ30にち」 */
export function formatMonthDayKids(value: string | Date): string {
  const ymd = typeof value === "string" ? value.slice(0, 10) : todayJst(value);
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}がつ${d}にち`;
}

/** 日時（ISO文字列）を日本時間の「11月30日 14:05」で表示 */
export function formatDateTimeJst(iso: string): string {
  const jst = new Date(new Date(iso).getTime() + JST_OFFSET_MS);
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${m}月${d}日 ${hh}:${mm}`;
}

/** 日時（ISO文字列）の日本時間での年月（YYYY-MM） */
export function yearMonthJst(iso: string): string {
  return todayJst(new Date(iso)).slice(0, 7);
}
