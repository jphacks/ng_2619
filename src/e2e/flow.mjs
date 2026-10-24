// UI の通しテスト（T-1003）。使い方: npm run dev で起動しておき、npm run e2e
// 初回のみ: npx playwright install chromium
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SHOTS = path.resolve(process.argv[2] ?? "shots");
mkdirSync(SHOTS, { recursive: true });
const rnd = Math.random().toString(16).slice(2, 8);
const parentId = `ui_p_${rnd}`;
const childId = `ui_k_${rnd}`;
const PW = "pass1234";
const CPW = "123456";

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ja-JP" });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
page.on("response", (r) => r.status() >= 400 && errors.push(`response: ${r.status()} ${r.request().method()} ${r.url()}`));

let n = 0;
const shot = async (name) => page.screenshot({ path: path.join(SHOTS, `${String(++n).padStart(2, "0")}-${name}.png`), fullPage: true });
const step = (s) => console.log(`- ${s}`);
const settle = () => page.waitForLoadState("networkidle");

// fill() では検出できない、入力中に先頭欄へフォーカスが戻る不具合を確認する。
async function typeAndKeepFocus(input, value) {
  await input.click();
  for (const character of value) {
    await page.keyboard.type(character);
    await input.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (!(await input.evaluate(element => document.activeElement === element))) {
      throw new Error("入力中にフォーカスが別の欄へ移動しました");
    }
  }
  if (await input.inputValue() !== value) throw new Error("入力値が一致しません");
}

async function login(id, pw) {
  await page.goto(`${BASE}/login`);
  await settle();
  await page.getByLabel("ユーザID").fill(id);
  await page.getByLabel("パスワード", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "ログイン" }).click();
}
async function reauthIfAsked() {
  const dlg = page.getByRole("dialog", { name: "保護者のパスワードを入力してください" });
  try {
    await dlg.waitFor({ timeout: 3000 });
  } catch {
    return false;
  }
  await dlg.getByLabel("パスワード").fill(PW);
  await dlg.getByRole("button", { name: "確認する" }).click();
  return true;
}

try {
  step("ログイン画面");
  await page.goto(`${BASE}/`);
  await settle();
  await page.waitForURL("**/login");
  await settle();
  await shot("login");

  step("保護者の新規登録");
  await page.getByRole("link", { name: "新規登録（保護者の方）" }).click();
  await page.waitForURL("**/signup");
  await settle();
  await page.getByLabel("ユーザID").fill(parentId);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByLabel("パスワード（確認）").fill(PW);
  await page.getByLabel("表示名").fill("おかあさん");
  await page.getByLabel("メールアドレス").fill(`${parentId}@example.com`);
  await page.getByRole("checkbox").check();
  await shot("signup");
  await page.getByRole("button", { name: "登録する" }).click();
  await page.waitForURL("**/parent");
  await settle();
  await page.getByText("まずはお子さまを登録しましょう").waitFor();
  await shot("parent-home-empty");

  step("子どもアカウントの追加（再認証つき）");
  await page.goto(`${BASE}/parent/children`);
  await settle();
  await page.getByRole("button", { name: "＋ 追加" }).click();
  const add = page.getByRole("dialog", { name: "子どもアカウントを追加" });
  await add.getByLabel("表示名").fill("けんた");
  await add.getByLabel("学年").selectOption("2");
  await typeAndKeepFocus(add.getByLabel("ユーザID"), childId);
  await typeAndKeepFocus(add.getByLabel("パスワード"), CPW);
  await add.getByRole("button", { name: "作成する" }).click();
  if (!(await reauthIfAsked())) throw new Error("再認証モーダルが出ませんでした");
  await page.getByText("子どもアカウントを作成しました").waitFor();
  await shot("children");

  step("ミッション作成（目視）");
  await page.goto(`${BASE}/parent/missions/new`);
  await settle();
  await page.getByLabel("タイトル（必須）").fill("さかあがり");
  await page.getByLabel("説明").fill("てつぼうで さかあがりを しよう");
  await page.getByRole("button", { name: "鉄棒" }).click();
  await page.getByRole("button", { name: "目視で確認" }).click();
  await shot("mission-new");
  await page.getByRole("button", { name: "ミッションを作る" }).click();
  await page.waitForURL("**/parent/missions");
  await settle();
  await page.getByText("さかあがり").first().waitFor();
  await shot("missions");

  step("2つめのミッション（直接登録用）");
  await page.goto(`${BASE}/parent/missions/new`);
  await settle();
  await page.getByLabel("タイトル（必須）").fill("なわとび 30かい");
  await page.getByRole("button", { name: "なわとび" }).click();
  await page.getByLabel("目標値").fill("30");
  await page.getByLabel("単位").selectOption("TIMES");
  await page.getByRole("button", { name: "ミッションを作る" }).click();
  await page.waitForURL("**/parent/missions");
  await settle();

  step("保護者ログアウト → 子どもログイン");
  await page.goto(`${BASE}/parent/settings`);
  await settle();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForURL("**/login");
  await settle();
  await login(childId, CPW);
  await page.waitForURL("**/kids/avatar?initial=1");
  await settle();
  await page.getByText("じぶんの アバターを つくろう！").waitFor();
  await page.getByRole("tab", { name: "かみがた" }).click();
  await page.getByRole("button", { name: /ながい くろかみ/ }).click();
  await shot("kids-avatar-initial");
  await page.getByRole("button", { name: "けってい" }).click();
  await page.waitForURL(/\/kids$/);
  await settle();
  await page.getByText("さかあがり").waitFor();
  await shot("kids-home");

  step("目視で申請");
  await page.getByRole("link", { name: /さかあがり/ }).click();
  await page.getByRole("link", { name: "できた！" }).waitFor();
  await shot("kids-challenge");
  await page.getByRole("link", { name: "できた！" }).click();
  await page.getByRole("button", { name: /みてもらった/ }).click();
  await page.getByRole("button", { name: /がんばった/ }).click();
  await shot("kids-report");
  await page.getByRole("button", { name: "おくる" }).click();
  await page.waitForURL("**/done");
  await settle();
  await shot("kids-done");

  step("子どもログアウト → 保護者が承認");
  await page.goto(`${BASE}/kids`);
  await settle();
  await page.getByRole("button", { name: "おわる" }).click();
  await page.waitForURL("**/login");
  await settle();
  await login(parentId, PW);
  await page.waitForURL("**/parent");
  await settle();
  await page.getByText("1件").waitFor();
  await shot("parent-home-pending");
  await page.getByRole("link", { name: /承認待ちの申請/ }).click();
  await page.getByRole("link", { name: /さかあがり/ }).click();
  await page.getByRole("button", { name: "すごいね！" }).click();
  await shot("approval-detail");
  await page.getByRole("button", { name: "承認する" }).click();
  await reauthIfAsked();
  await page.getByText("承認しました").waitFor();
  await shot("approved");

  step("保護者が直接登録（P-M2）");
  await page.goto(`${BASE}/parent/missions`);
  await settle();
  await page.getByRole("button", { name: "達成を登録" }).first().click();
  const dlg = page.getByRole("dialog", { name: "達成を登録" });
  await dlg.getByRole("button", { name: "見てたよ！" }).click();
  await shot("complete-modal");
  await dlg.getByRole("button", { name: "達成にする" }).click();
  await reauthIfAsked();
  await page.getByText("達成を登録しました").waitFor();
  await shot("completed");

  step("子どもホームでレベルアップとお知らせを確認");
  await page.goto(`${BASE}/parent/settings`);
  await settle();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForURL("**/login");
  await settle();
  await login(childId, CPW);
  await page.waitForURL(/\/kids$/);
  await settle();
  await page.getByText("レベルアップ！").waitFor();
  await shot("kids-levelup");
  await page.getByRole("button", { name: "とじる" }).click();
  await page.getByText(/たっせいに したよ/).waitFor();
  await shot("kids-notices");
  await page.goto(`${BASE}/kids/records`);
  await settle();
  await page.getByText("たっせいした ミッション").waitFor();
  await shot("kids-records");

  step("子どもが保護者画面を開くとリダイレクト");
  await page.goto(`${BASE}/parent`);
  await settle();
  await page.waitForURL(/\/kids$/);
  await settle();

  step("同じブラウザで保護者のタブと子どものタブを並べて使える");
  const parentTab = await ctx.newPage();
  await parentTab.goto(`${BASE}/login`);
  await parentTab.getByLabel("ユーザID").fill(parentId);
  await parentTab.getByLabel("パスワード", { exact: true }).fill(PW);
  await parentTab.getByRole("button", { name: "ログイン" }).click();
  await parentTab.waitForURL("**/parent");
  // 保護者のあとに、もう一方のタブで子どもがログインし直す
  await page.getByRole("button", { name: "おわる" }).click();
  await page.waitForURL("**/login");
  await login(childId, CPW);
  await page.waitForURL(/\/kids$/);
  // 保護者のタブで操作しても、子どもの画面に移らない
  await parentTab.locator('a[href="/parent/missions"]').first().click();
  await parentTab.waitForURL("**/parent/missions");
  await parentTab.getByText("さかあがり").first().waitFor();
  await page.goto(`${BASE}/kids/records`);
  await page.getByText("たっせいした ミッション").waitFor();
  // 子どもがログアウトしても、保護者はログインしたまま
  await page.goto(`${BASE}/kids`);
  await page.getByRole("button", { name: "おわる" }).click();
  await page.waitForURL("**/login");
  await parentTab.reload();
  await parentTab.getByText("さかあがり").first().waitFor();
  if (!parentTab.url().endsWith("/parent/missions")) throw new Error(`保護者のタブが移動した: ${parentTab.url()}`);
  console.log("OK: all steps passed");
} catch (e) {
  console.log(`FAILED at step: ${e.message}`);
  await shot("failure");
  process.exitCode = 1;
} finally {
  if (errors.length) console.log("browser errors:\n" + errors.join("\n"));
  await browser.close();
}
