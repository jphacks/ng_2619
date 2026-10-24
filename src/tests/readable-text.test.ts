import { describe, expect, it } from "vitest";
import { GRADE_KANJI, isLearnedKanji, targetUnitForGrade } from "@/lib/kanji-grades";
import { readableText, readableNullable } from "@/server/readable-text";

describe("学年に応じたミッションの表記", () => {
  it("現行の配当表1026字に重複や欠落がない", () => {
    expect(GRADE_KANJI.map(characters => Array.from(characters).length)).toEqual([80, 160, 200, 202, 193, 191]);
    expect(new Set(GRADE_KANJI.join("")).size).toBe(1026);
    expect(isLearnedKanji("回", 2)).toBe(false);
    expect(isLearnedKanji("回", 3)).toBe(true);
    expect(isLearnedKanji("縄", 4)).toBe(false);
    expect(isLearnedKanji("縄", 5)).toBe(true);
    expect(isLearnedKanji("胃", 6)).toBe(false);
    expect(isLearnedKanji("鷹", 6)).toBe(false);
  });

  it("同じ原文を小学1年生ではかな、小学6年生では既習漢字で表示する", async () => {
    const original = "なわとび 100回";
    expect(await readableText(original, 1)).toBe("なわとび 100かい");
    expect(await readableText(original, 6)).toBe(original);
    expect(await readableText(original, 1)).toBe("なわとび 100かい");
  }, 20000);

  it("説明の活用語・熟語も変換し、片仮名や数字は保つ", async () => {
    expect(await readableText("ボールを地面に落とさずに50回続けよう", 1))
      .toBe("ボールをじめんにおとさずに50かいつづけよう");
    expect(await readableText("学校で練習する", 3)).toBe("学校でれんしゅうする");
    expect(await readableText("学校で練習する", 4)).toBe("学校で練習する");
  });

  it("空白、改行、記号、ひらがな入力、空の説明を保つ", async () => {
    expect(await readableText("公園で遊ぼう\n  水を飲もう！　100回", 1))
      .toBe("こうえんであそぼう\n  みずをのもう！　100かい");
    expect(await readableText("なわとび100かい 🎉", 6)).toBe("なわとび100かい 🎉");
    expect(await readableText("", 1)).toBe("");
    expect(await readableNullable(null, 1)).toBeNull();
  });

  it("目標の単位も学年に合わせ、分を『ふん』で表示する", () => {
    expect(targetUnitForGrade("TIMES", 1)).toBe("かい");
    expect(targetUnitForGrade("TIMES", 6)).toBe("回");
    expect(targetUnitForGrade("SECONDS", 3)).toBe("びょう");
    expect(targetUnitForGrade("SECONDS", 4)).toBe("秒");
    expect(targetUnitForGrade("MINUTES", 1)).toBe("ふん");
    expect(targetUnitForGrade("METERS", 6)).toBe("メートル");
  });
});
