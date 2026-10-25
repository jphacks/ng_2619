// 起動済みアプリに対して、データ取得だけをモックしてグラフ操作を確認する。
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{ name: "sid_parent", value: "growth-test", url: base }]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const children = [{ id: "taro", displayName: "たろう" }, { id: "hana", displayName: "はな" }];
  const categories = [{ code: "lift", label: "リフティング" }, { code: "rope", label: "なわとび" }, { code: "swim", label: "水泳" }];
  const series = (childId, categoryCode, unit, values) => ({ childId, categoryCode, unit, recordCount: values.length, points: values.map((value, index) => ({ id: `${childId}-${categoryCode}-${index}`, date: `2026-09-${String(index + 1).padStart(2, "0")}`, value, title: `${categories.find(item => item.code === categoryCode).label} ${value}` })) });
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith("/parent/growth") ? { children, categories, series: [series("taro", "lift", "TIMES", [2, 10, 45]), series("taro", "swim", "METERS", [10, 50]), series("hana", "swim", "METERS", [3, 18]), series("hana", "rope", "TIMES", [1, 80])] } : { pendingCount: 0, children: children.map(child => ({ ...child, grade: 1, level: 8, approvedCount: 20, activeCount: 0, weekApprovedCount: 1, avatar: [] })) };
    await route.fulfill({ json: body });
  });
  await page.goto(`${base}/parent`);
  await page.getByText("承認待ちの申請", { exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "お子さまの成長", exact: true }).count(), 0);
  const menu = page.getByRole("navigation", { name: "メニュー", exact: true });
  assert.deepEqual(await menu.getByRole("link").allTextContents(), ["🏠ホーム", "🚩ミッション", "📈成長", "✅承認", "⚙️設定"]);
  await menu.getByRole("link", { name: "成長", exact: true }).click();
  await page.waitForURL("**/parent/growth");
  assert.equal(await menu.getByRole("link", { name: "成長", exact: true }).getAttribute("aria-current"), "page");
  const original = page.url();
  await page.getByRole("group", { name: "たろうのリフティングの折れ線グラフ（回）", exact: true }).waitFor();
  await page.getByRole("button", { name: "2026-09-02 10回", exact: true }).click();
  await page.getByText("2026/09/02：10回", { exact: true }).waitFor();
  await page.getByLabel("成長を見るカテゴリ").selectOption("swim");
  await page.getByRole("group", { name: "たろうの水泳の折れ線グラフ（m）", exact: true }).waitFor();
  await page.getByText("50m", { exact: true }).first().waitFor();
  await page.getByLabel("成長を見る子ども").selectOption("hana");
  await page.getByRole("group", { name: "はなの水泳の折れ線グラフ（m）", exact: true }).waitFor();
  await page.getByText("18m", { exact: true }).first().waitFor();
  await page.getByLabel("成長を見るカテゴリ").selectOption("lift");
  await page.getByRole("status").filter({ hasText: "達成記録がまだありません" }).waitFor();
  await page.getByLabel("成長を見るカテゴリ").selectOption("rope");
  await page.getByRole("group", { name: "はなのなわとびの折れ線グラフ（回）", exact: true }).waitFor();
  await page.getByText("記録を一覧で見る（2日分）", { exact: true }).click();
  await page.getByRole("table").waitFor();
  assert.equal(page.url(), original);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(errors, []);
  mkdirSync("e2e/screenshots", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "e2e/screenshots/growth-mobile.png", fullPage: true });
  console.log("PASS: child/category switching without navigation, chart point selection, units, empty state and mobile layout.");
} finally { await browser.close(); }
