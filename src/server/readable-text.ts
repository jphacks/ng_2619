import path from "node:path";
import kuromoji, { type IpadicFeatures, type Tokenizer } from "kuromoji";
import { isLearnedKanji } from "@/lib/kanji-grades";

const hasKanji = /[\p{Script=Han}々〆]/u;
let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | undefined;

function getTokenizer() {
  tokenizerPromise ??= new Promise<Tokenizer<IpadicFeatures>>((resolve, reject) => {
    kuromoji.builder({ dicPath: path.join(process.cwd(), "node_modules/kuromoji/dict") }).build((error, tokenizer) => {
      if (error) reject(error);
      else resolve(tokenizer);
    });
  }).catch(error => {
    tokenizerPromise = undefined;
    throw error;
  });
  return tokenizerPromise;
}

const hiragana = (value: string) => value.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** 外部通信なし。未習漢字を含む語は語全体をかなにし、熟語の読みを分断しない。 */
export async function readableText(text: string, grade: number): Promise<string> {
  if (!hasKanji.test(text)) return text;
  const tokenizer = await getTokenizer();
  // 行や空白は辞書解析に渡さず、改行・全角空白を含めてそのまま残す。
  return text.split(/(\s+)/u).map(part => {
    if (!hasKanji.test(part)) return part;
    return tokenizer.tokenize(part).map(token => {
      const kanji = Array.from(token.surface_form).filter(c => hasKanji.test(c));
      if (kanji.length === 0 || kanji.every(c => isLearnedKanji(c, grade))) return token.surface_form;
      // 辞書にない固有名詞等は、推測で内容を壊さず原文を残す（プレビューで確認）。
      return token.reading && token.reading !== "*" ? hiragana(token.reading) : token.surface_form;
    }).join("");
  }).join("");
}

export const readableNullable = (text: string | null, grade: number) => text === null ? Promise.resolve(null) : readableText(text, grade);
