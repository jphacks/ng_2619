import { isLearnedKanji } from "./kanji-grades";
import { formatMonthDay, formatMonthDayKids } from "./date";

const LABELS = {
  target: { kanji: "目標", kana: "もくひょう" },
  deadline: { kanji: "期限", kana: "きげん" },
  report: { kanji: "報告", kana: "ほうこく" },
} as const;

/** 熟語を構成する漢字を全て習ってから、漢字のラベルに切り替える。 */
export function kidsLabel(label: keyof typeof LABELS, grade: number): string {
  const { kanji, kana } = LABELS[label];
  return Array.from(kanji).every(c => isLearnedKanji(c, grade)) ? kanji : kana;
}

export function formatMonthDayForGrade(value: string | Date, grade: number): string {
  return isLearnedKanji("月", grade) && isLearnedKanji("日", grade)
    ? formatMonthDay(value) : formatMonthDayKids(value);
}
