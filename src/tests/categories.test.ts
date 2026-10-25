import { expect, it } from "vitest";
import * as signup from "@/app/api/v1/auth/signup/route";
import * as reauth from "@/app/api/v1/auth/reauth/route";
import * as children from "@/app/api/v1/children/route";
import * as categories from "@/app/api/v1/categories/route";
import * as masters from "@/app/api/v1/masters/route";
import * as missions from "@/app/api/v1/missions/route";
import * as mission from "@/app/api/v1/missions/[id]/route";
import { TestClient, uniqueId } from "./helpers";

async function parent() {
  const client = new TestClient();
  const loginId = uniqueId("cat");
  expect((await client.call(signup.POST, "POST", "/", { body: { loginId, password: "pass1234", displayName: "おや", email: `${loginId}@example.com`, agreeTerms: true } })).status).toBe(201);
  return client;
}

it("カテゴリは空から始まり、自由追加・重複防止・家庭ごとの分離ができる", async () => {
  const a = await parent();
  const b = await parent();
  expect((await new TestClient().call(categories.GET, "GET", "/")).status).toBe(401);
  expect((await a.call(categories.GET, "GET", "/")).body.items).toEqual([]);
  expect((await a.call(masters.GET, "GET", "/")).body.categories).toEqual([]);
  expect((await a.call(categories.POST, "POST", "/", { body: { label: "  " } })).status).toBe(400);
  expect((await a.call(categories.POST, "POST", "/", { body: { label: "あ".repeat(21) } })).status).toBe(400);
  const [first, repeated] = await Promise.all([1, 2].map(() => a.call(categories.POST, "POST", "/", { body: { label: " お手伝い " } })));
  expect(first.status).toBe(201);
  expect(repeated.status).toBe(201);
  expect(first.body.code).toBe(repeated.body.code);
  const other = await b.call(categories.POST, "POST", "/", { body: { label: "お手伝い" } });
  expect(other.body.code).not.toBe(first.body.code);
  expect((await a.call(categories.GET, "GET", "/")).body.items.map((item: { code: string }) => item.code)).toEqual([first.body.code]);
  expect((await a.call(masters.GET, "GET", "/")).body.categories.map((item: { code: string }) => item.code)).toEqual([first.body.code]);

  await a.call(reauth.POST, "POST", "/", { body: { password: "pass1234" } });
  const child = await a.call(children.POST, "POST", "/", { body: { loginId: uniqueId("ck"), password: "123456", displayName: "こども", grade: 1 } });
  expect(child.status).toBe(201);
  const body = { title: "なわとび", categoryCode: first.body.code, childIds: [child.body.id], targetValue: 50, verifyMethod: "VIDEO" };
  const created = await a.call(missions.POST, "POST", "/", { body });
  expect(created.status).toBe(201);
  const detail = await a.call(mission.GET, "GET", "/", { params: { id: created.body.missionId } });
  expect(detail.body).toMatchObject({ title: "なわとび", categoryCode: first.body.code, targetValue: 50, targetUnit: "TIMES", verifyMethod: "EITHER", description: null });
  expect((await a.call(missions.POST, "POST", "/", { body: { ...body, categoryCode: other.body.code } })).status).toBe(400);
  expect((await a.call(missions.POST, "POST", "/", { body: { ...body, categoryCode: "BALL" } })).status).toBe(400);
});
