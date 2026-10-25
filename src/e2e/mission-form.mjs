// 起動済みアプリに対して実行。APIはモックし、利用者のデータを変更しない。
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.BASE ?? "http://localhost:3000";
const id = "0192f3c4-0000-7000-8000-000000000000";
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
try {
  const context = await browser.newContext();
  await context.addCookies([{ name: "sid_parent", value: "form-test", url: base }]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let categories = [];
  let saved;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body;
    if (path.endsWith("/categories")) {
      if (route.request().method() === "POST") {
        const { label } = route.request().postDataJSON();
        const category = categories.find(item => item.label === label) ?? { code: id, label, iconPath: "/icons/category-other.svg" };
        categories = [category];
        body = category;
      } else body = { items: categories };
    } else if (path.endsWith("/children")) body = { items: [{ id, displayName: "テスト子", grade: 1 }], max: 5 };
    else if (path.endsWith("/missions") && route.request().method() === "POST") { saved = route.request().postDataJSON(); body = { missionId: id }; }
    else if (path.endsWith("/missions")) body = { items: [], nextCursor: null };
    else body = {};
    await route.fulfill({ json: body });
  });
  await page.goto(`${base}/parent/missions/new`);
  await page.getByPlaceholder("なわとび", { exact: true }).waitFor();
  for (const label of ["説明", "単位", "プレビューする学年"]) assert.equal(await page.getByLabel(label, { exact: true }).count(), 0);
  for (const text of ["確認方法（必須）", "子どもの画面での見え方", "ボール", "鉄棒", "なわとび", "かけっこ", "遊具", "その他"]) assert.equal(await page.getByText(text, { exact: true }).count(), 0);
  await page.getByLabel("タイトル（必須）").fill("なわとび");
  await page.getByLabel("新しいカテゴリ").fill("運動");
  await page.getByRole("button", { name: "カテゴリを追加", exact: true }).click();
  const category = page.getByRole("button", { name: "運動", exact: true });
  await category.waitFor();
  assert.equal(await category.getAttribute("aria-pressed"), "true");
  await page.reload();
  await page.getByRole("button", { name: "運動", exact: true }).click();
  await page.getByLabel("タイトル（必須）").fill("なわとび");
  await page.getByLabel("目標値", { exact: true }).fill("50");
  await page.getByRole("button", { name: "ミッションを作る", exact: true }).click();
  await page.waitForURL("**/parent/missions");
  assert.deepEqual(saved, { title: "なわとび", description: null, categoryCode: id, targetValue: 50, targetUnit: "TIMES", verifyMethod: "EITHER", dueDate: null, childIds: [id] });
  assert.deepEqual(errors, []);
  console.log("PASS: simplified form, custom category creation/persistence, numeric target, and EITHER submission.");
} finally { await browser.close(); }
