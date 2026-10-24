// APIの結合テスト（実際のDBを使う）。DATABASE_URL のDBにマスタが入っている前提（npm run db:setup）。
// 主要な流れ・認可（他の家族は404）・同時実行（T-1001, T-1002 の土台）を確認する。

import { beforeAll, describe, expect, it } from "vitest";
import * as login from "@/app/api/v1/auth/login/route";
import * as signup from "@/app/api/v1/auth/signup/route";
import * as reauth from "@/app/api/v1/auth/reauth/route";
import * as me from "@/app/api/v1/me/route";
import * as children from "@/app/api/v1/children/route";
import * as childSummary from "@/app/api/v1/children/[id]/summary/route";
import * as missions from "@/app/api/v1/missions/route";
import * as mission from "@/app/api/v1/missions/[id]/route";
import * as complete from "@/app/api/v1/challenges/[id]/complete/route";
import * as archive from "@/app/api/v1/challenges/[id]/archive/route";
import * as submissions from "@/app/api/v1/submissions/route";
import * as submission from "@/app/api/v1/submissions/[id]/route";
import * as approve from "@/app/api/v1/submissions/[id]/approve/route";
import * as reject from "@/app/api/v1/submissions/[id]/reject/route";
import * as videoUrl from "@/app/api/v1/submissions/[id]/video-url/route";
import * as dashboard from "@/app/api/v1/parent/dashboard/route";
import * as kidsHome from "@/app/api/v1/kids/home/route";
import * as kidsChallenge from "@/app/api/v1/kids/challenges/[id]/route";
import * as kidsSubmit from "@/app/api/v1/kids/challenges/[id]/submissions/route";
import * as kidsUpload from "@/app/api/v1/kids/challenges/[id]/video-upload-url/route";
import * as noticesAck from "@/app/api/v1/kids/notices/ack/route";
import * as levelUpAck from "@/app/api/v1/kids/level-up/ack/route";
import * as kidsAvatar from "@/app/api/v1/kids/avatar/route";
import * as kidsRecords from "@/app/api/v1/kids/records/route";
import * as devStorage from "@/app/api/dev-storage/[...key]/route";
import { prisma } from "@/server/db";
import { TestClient, uniqueId, waitFor } from "./helpers";

const PASSWORD = "pass1234";
const CHILD_PASSWORD = "123456";

async function newParent() {
  const c = new TestClient();
  const loginId = uniqueId("p");
  const r = await c.call(signup.POST, "POST", "/api/v1/auth/signup", {
    body: { loginId, password: PASSWORD, displayName: "おや", email: `${loginId}@example.com`, agreeTerms: true },
  });
  expect(r.status).toBe(201);
  await c.call(reauth.POST, "POST", "/api/v1/auth/reauth", { body: { password: PASSWORD } });
  return c;
}

async function newChild(parent: TestClient) {
  const loginId = uniqueId("k");
  const r = await parent.call(children.POST, "POST", "/api/v1/children", {
    body: { displayName: "こども", grade: 2, loginId, password: CHILD_PASSWORD },
  });
  expect(r.status).toBe(201);
  const kid = new TestClient();
  const l = await kid.call(login.POST, "POST", "/api/v1/auth/login", { body: { loginId, password: CHILD_PASSWORD } });
  expect(l.status).toBe(200);
  expect(l.body.redirectTo).toBe("/kids");
  return { kid, childId: r.body.id as string, loginId };
}

async function newMission(parent: TestClient, childIds: string[], verifyMethod = "EITHER", dueDate: string | null = null) {
  const r = await parent.call(missions.POST, "POST", "/api/v1/missions", {
    body: { title: "さかあがり", categoryCode: "BAR", verifyMethod, childIds, dueDate },
  });
  expect(r.status).toBe(201);
  return r.body as { missionId: string; challengeIds: string[] };
}

beforeAll(async () => {
  const masters = await prisma.levelMaster.count();
  if (masters === 0) throw new Error("マスタがありません。先に npm run db:setup を実行してください");
});

describe("認証", () => {
  it("子どもアカウントの作成には再認証が必要（NF-S-10）", async () => {
    const c = new TestClient();
    const loginId = uniqueId("p");
    await c.call(signup.POST, "POST", "/api/v1/auth/signup", {
      body: { loginId, password: PASSWORD, displayName: "おや", email: `${loginId}@example.com`, agreeTerms: true },
    });
    const r = await c.call(children.POST, "POST", "/api/v1/children", {
      body: { displayName: "こども", grade: 1, loginId: uniqueId("k"), password: CHILD_PASSWORD },
    });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("REAUTH_REQUIRED");
  });

  it("連続5回失敗すると15分ロック（F-AUTH-08）", async () => {
    const parent = await newParent();
    const { loginId } = await newChild(parent);
    const attacker = new TestClient();
    for (let i = 0; i < 5; i++) {
      const r = await attacker.call(login.POST, "POST", "/api/v1/auth/login", { body: { loginId, password: "wrong!" } });
      expect(r.status).toBe(401);
    }
    const locked = await attacker.call(login.POST, "POST", "/api/v1/auth/login", { body: { loginId, password: CHILD_PASSWORD } });
    expect(locked.status).toBe(423);
  });

  it("子どもは保護者用APIを呼べない（403）。未ログインは401", async () => {
    const parent = await newParent();
    const { kid } = await newChild(parent);
    expect((await kid.call(dashboard.GET, "GET", "/api/v1/parent/dashboard")).status).toBe(403);
    expect((await new TestClient().call(kidsHome.GET, "GET", "/api/v1/kids/home")).status).toBe(401);
    expect((await kid.call(me.GET, "GET", "/api/v1/me")).body.role).toBe("CHILD");
  });

  it("他サイトからの更新リクエストは拒否する（CSRF対策）", async () => {
    const parent = await newParent();
    const r = await parent.call(missions.POST, "POST", "/api/v1/missions", {
      body: {},
      headers: { origin: "https://evil.example.com" },
    });
    expect(r.status).toBe(403);
  });
});

describe("主要な流れ：目視申請 → 承認 → レベルアップ", () => {
  it("一通り動く", async () => {
    const parent = await newParent();
    const { kid, childId } = await newChild(parent);
    const { challengeIds } = await newMission(parent, [childId], "VISUAL");
    const challengeId = challengeIds[0]!;

    let home = await kid.call(kidsHome.GET, "GET", "/api/v1/kids/home");
    expect(home.body.child.avatarInitialized).toBe(false);
    expect(home.body.challenges.map((c: { id: string }) => c.id)).toContain(challengeId);

    // 動画はこのミッションでは使えない
    const badMethod = await kid.call(kidsSubmit.POST, "POST", "/", { params: { id: challengeId }, body: { method: "VIDEO", videoId: challengeId } });
    expect(badMethod.status).toBe(400);

    const sub = await kid.call(kidsSubmit.POST, "POST", "/", { params: { id: challengeId }, body: { method: "VISUAL", stampCode: "GANBATTA" } });
    expect(sub.status).toBe(201);
    const again = await kid.call(kidsSubmit.POST, "POST", "/", { params: { id: challengeId }, body: { method: "VISUAL" } });
    expect(again.status).toBe(409);

    const pending = await parent.call(submissions.GET, "GET", "/api/v1/submissions?status=PENDING");
    expect(pending.body.items).toHaveLength(1);
    expect(pending.body.items[0].stampLabel).toBe("がんばった！");
    expect((await parent.call(dashboard.GET, "GET", "/api/v1/parent/dashboard")).body.pendingCount).toBe(1);

    const ok = await parent.call(approve.POST, "POST", "/", { params: { id: sub.body.submissionId }, body: { comment: "すごいね！" } });
    expect(ok.status).toBe(200);
    expect(ok.body.child).toEqual({ approvedCount: 1, level: 2, leveledUp: true });

    home = await kid.call(kidsHome.GET, "GET", "/api/v1/kids/home");
    expect(home.body.notices[0]).toMatchObject({ kind: "APPROVED", comment: "すごいね！" });
    expect(home.body.levelUp).toMatchObject({ from: 1, to: 2 });
    expect(home.body.levelUp.unlockedItems.length).toBeGreaterThan(0);
    expect(home.body.challenges).toHaveLength(0);

    await kid.call(noticesAck.POST, "POST", "/", { body: { submissionIds: [sub.body.submissionId] } });
    await kid.call(levelUpAck.POST, "POST", "/");
    home = await kid.call(kidsHome.GET, "GET", "/api/v1/kids/home");
    expect(home.body.notices).toHaveLength(0);
    expect(home.body.levelUp).toBeNull();

    const records = await kid.call(kidsRecords.GET, "GET", "/");
    expect(records.body).toMatchObject({ approvedCount: 1, items: [{ challengeId, comment: "すごいね！" }] });
  });

  it("差し戻しは理由が必須。差し戻し後は再申請できる", async () => {
    const parent = await newParent();
    const { kid, childId } = await newChild(parent);
    const { challengeIds } = await newMission(parent, [childId]);
    const sub = await kid.call(kidsSubmit.POST, "POST", "/", { params: { id: challengeIds[0] }, body: { method: "VISUAL" } });
    expect((await parent.call(reject.POST, "POST", "/", { params: { id: sub.body.submissionId }, body: { comment: "" } })).status).toBe(400);
    const r = await parent.call(reject.POST, "POST", "/", { params: { id: sub.body.submissionId }, body: { comment: "もうすこし！" } });
    expect(r.body.challengeStatus).toBe("REJECTED");
    const detail = await kid.call(kidsChallenge.GET, "GET", "/", { params: { id: challengeIds[0] } });
    expect(detail.body).toMatchObject({ status: "REJECTED", rejectionComment: "もうすこし！" });
    const again = await kid.call(kidsSubmit.POST, "POST", "/", { params: { id: challengeIds[0] }, body: { method: "VISUAL" } });
    expect(again.status).toBe(201);
  });
});

describe("保護者による直接登録（F-APV-08）", () => {
  it("挑戦中のミッションを直接達成にできる。承認待ちのものはできない", async () => {
    const parent = await newParent();
    const { kid, childId } = await newChild(parent);
    const a = await newMission(parent, [childId], "VIDEO");
    const b = await newMission(parent, [childId], "VISUAL");

    const done = await parent.call(complete.POST, "POST", "/", { params: { id: a.challengeIds[0] }, body: { comment: "見てたよ！" } });
    expect(done.status).toBe(200);
    expect(done.body.child.approvedCount).toBe(1);

    await kid.call(kidsSubmit.POST, "POST", "/", { params: { id: b.challengeIds[0] }, body: { method: "VISUAL" } });
    const blocked = await parent.call(complete.POST, "POST", "/", { params: { id: b.challengeIds[0] }, body: {} });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.reason).toBe("PENDING_EXISTS");

    const home = await kid.call(kidsHome.GET, "GET", "/api/v1/kids/home");
    expect(home.body.notices.some((n: { kind: string }) => n.kind === "PARENT_COMPLETED")).toBe(true);

    // 子どもが直接登録済みのミッションに申請しようとすると409（ALREADY_APPROVED）
    const late = await kid.call(kidsSubmit.POST, "POST", "/", { params: { id: a.challengeIds[0] }, body: { method: "VISUAL" } });
    expect(late.status).toBe(409);
    expect(late.body.error.reason).toBe("ALREADY_APPROVED");

    const summary = await parent.call(childSummary.GET, "GET", "/", { params: { id: childId } });
    expect(summary.body.history[0]).toMatchObject({ source: "PARENT" });
  });
});

describe("認可：他の家族のデータは404（NF-S-04）", () => {
  it("ミッション・申請・子ども・直接登録", async () => {
    const parentA = await newParent();
    const { kid, childId } = await newChild(parentA);
    const m = await newMission(parentA, [childId]);
    const sub = await kid.call(kidsSubmit.POST, "POST", "/", { params: { id: m.challengeIds[0] }, body: { method: "VISUAL" } });

    const parentB = await newParent();
    expect((await parentB.call(mission.GET, "GET", "/", { params: { id: m.missionId } })).status).toBe(404);
    expect((await parentB.call(submission.GET, "GET", "/", { params: { id: sub.body.submissionId } })).status).toBe(404);
    expect((await parentB.call(approve.POST, "POST", "/", { params: { id: sub.body.submissionId }, body: {} })).status).toBe(404);
    expect((await parentB.call(complete.POST, "POST", "/", { params: { id: m.challengeIds[0] }, body: {} })).status).toBe(404);
    expect((await parentB.call(archive.POST, "POST", "/", { params: { id: m.challengeIds[0] } })).status).toBe(404);
    expect((await parentB.call(childSummary.GET, "GET", "/", { params: { id: childId } })).status).toBe(404);
    expect((await parentB.call(missions.POST, "POST", "/", { body: { title: "x", categoryCode: "BAR", verifyMethod: "VISUAL", childIds: [childId] } })).status).toBe(404);
    expect((await parentB.call(submissions.GET, "GET", "/api/v1/submissions")).body.items).toHaveLength(0);

    // 他の子どものチャレンジ
    const { kid: otherKid } = await newChild(parentB);
    expect((await otherKid.call(kidsChallenge.GET, "GET", "/", { params: { id: m.challengeIds[0] } })).status).toBe(404);
  });
});

describe("同時実行（D-1, D-2）", () => {
  it("同じ申請を同時に承認しても1回しか数えない", async () => {
    const parent = await newParent();
    const { kid, childId } = await newChild(parent);
    const { challengeIds } = await newMission(parent, [childId]);
    const sub = await kid.call(kidsSubmit.POST, "POST", "/", { params: { id: challengeIds[0] }, body: { method: "VISUAL" } });
    const results = await Promise.all([
      parent.call(approve.POST, "POST", "/", { params: { id: sub.body.submissionId }, body: {} }),
      parent.call(approve.POST, "POST", "/", { params: { id: sub.body.submissionId }, body: {} }),
      parent.call(reject.POST, "POST", "/", { params: { id: sub.body.submissionId }, body: { comment: "x" } }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    const profile = await prisma.childProfile.findUniqueOrThrow({ where: { userId: childId } });
    expect(profile.approvedCount).toBeLessThanOrEqual(1);
  });

  it("同じ子どもの別々の申請を同時に承認すると、両方数える", async () => {
    const parent = await newParent();
    const { kid, childId } = await newChild(parent);
    const subs = [];
    for (let i = 0; i < 3; i++) {
      const { challengeIds } = await newMission(parent, [childId]);
      subs.push((await kid.call(kidsSubmit.POST, "POST", "/", { params: { id: challengeIds[0] }, body: { method: "VISUAL" } })).body.submissionId);
    }
    const results = await Promise.all(subs.map((id) => parent.call(approve.POST, "POST", "/", { params: { id }, body: {} })));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const profile = await prisma.childProfile.findUniqueOrThrow({ where: { userId: childId } });
    expect(profile).toMatchObject({ approvedCount: 3, level: 3 });
  });

  it("子どもの申請と保護者の直接登録が同時でも、どちらか一方だけが通る", async () => {
    const parent = await newParent();
    const { kid, childId } = await newChild(parent);
    const { challengeIds } = await newMission(parent, [childId]);
    const [s, c] = await Promise.all([
      kid.call(kidsSubmit.POST, "POST", "/", { params: { id: challengeIds[0] }, body: { method: "VISUAL" } }),
      parent.call(complete.POST, "POST", "/", { params: { id: challengeIds[0] }, body: {} }),
    ]);
    expect([s.status === 201, c.status === 200].filter(Boolean)).toHaveLength(1);
    const count = await prisma.submission.count({ where: { challengeId: challengeIds[0] } });
    expect(count).toBe(1);
  });
});

describe("ミッション編集・期限（4.6, R-2）", () => {
  it("達成済みの子がいると編集できない。承認待ちがあると確認方法は変えられない", async () => {
    const parent = await newParent();
    const a = await newChild(parent);
    const b = await newChild(parent);
    const m = await newMission(parent, [a.childId, b.childId]);
    await a.kid.call(kidsSubmit.POST, "POST", "/", { params: { id: m.challengeIds[0] }, body: { method: "VISUAL" } });
    const locked = await parent.call(mission.PATCH, "PATCH", "/", { params: { id: m.missionId }, body: { verifyMethod: "VIDEO" } });
    expect(locked.status).toBe(409);
    const titleOk = await parent.call(mission.PATCH, "PATCH", "/", { params: { id: m.missionId }, body: { title: "あたらしい" } });
    expect(titleOk.status).toBe(200);
    await parent.call(complete.POST, "POST", "/", { params: { id: m.challengeIds[1] }, body: {} });
    const detail = await parent.call(mission.GET, "GET", "/", { params: { id: m.missionId } });
    expect(detail.body.editable.allowed).toBe(false);
  });

  it("期限を過ぎたミッションは申請できず、子どもホームに出ない", async () => {
    const parent = await newParent();
    const { kid, childId } = await newChild(parent);
    const m = await newMission(parent, [childId]);
    await prisma.mission.update({ where: { id: m.missionId }, data: { dueDate: new Date("2020-01-01T00:00:00Z") } });
    const r = await kid.call(kidsSubmit.POST, "POST", "/", { params: { id: m.challengeIds[0] }, body: { method: "VISUAL" } });
    expect(r.status).toBe(422);
    const home = await kid.call(kidsHome.GET, "GET", "/api/v1/kids/home");
    expect(home.body.challenges).toHaveLength(0);
  });
});

describe("アバター", () => {
  it("解放されていないパーツは装備できない。保存すると初期作成済みになる", async () => {
    const parent = await newParent();
    const { kid } = await newChild(parent);
    const state = await kid.call(kidsAvatar.GET, "GET", "/");
    const equips = { ...state.body.equips };
    const locked = state.body.items.find((i: { unlocked: boolean; slot: string }) => !i.unlocked && i.slot === "HAT");
    const bad = await kid.call(kidsAvatar.PUT, "PUT", "/", { body: { equips: { ...equips, HAT: locked.id } } });
    expect(bad.status).toBe(400);
    const good = await kid.call(kidsAvatar.PUT, "PUT", "/", { body: { equips: { ...equips, HAIR: "hair_long_black" } } });
    expect(good.status).toBe(200);
    expect((await kid.call(kidsHome.GET, "GET", "/api/v1/kids/home")).body.child.avatarInitialized).toBe(true);
  });
});

describe("動画（1.6.2、ローカルストレージ）", () => {
  it("アップロード → 申請 → 変換 → 保護者が再生URLを取得", async () => {
    const parent = await newParent();
    const { kid, childId } = await newChild(parent);
    const { challengeIds } = await newMission(parent, [childId], "VIDEO");
    const id = challengeIds[0]!;
    const data = Buffer.from("fake mp4 data for test");

    // 申請の前に動画がないと 422
    const noVideo = await kid.call(kidsSubmit.POST, "POST", "/", { params: { id }, body: { method: "VIDEO", videoId: "0192f3c4-0000-7000-8000-000000000000" } });
    expect(noVideo.status).toBe(422);

    const up = await kid.call(kidsUpload.POST, "POST", "/", {
      params: { id },
      body: { contentType: "video/mp4", sizeBytes: data.length, durationSec: 12.3 },
    });
    expect(up.status).toBe(200);
    const url = new URL(up.body.uploadUrl, "http://localhost:3000");
    const keyParts = url.pathname.replace("/api/dev-storage/", "").split("/");
    const put = await kid.call(devStorage.PUT, "PUT", `${url.pathname}${url.search}`, {
      params: { key: keyParts },
      headers: { "content-type": "video/mp4" },
      raw: data,
    });
    expect(put.status).toBe(200);

    const sub = await kid.call(kidsSubmit.POST, "POST", "/", { params: { id }, body: { method: "VIDEO", videoId: up.body.videoId } });
    expect(sub.status).toBe(201);

    await waitFor(async () => (await prisma.video.findUnique({ where: { id: up.body.videoId } }))?.status === "READY");
    const detail = await parent.call(submission.GET, "GET", "/", { params: { id: sub.body.submissionId } });
    expect(detail.body.video.status).toBe("READY");
    const v = await parent.call(videoUrl.GET, "GET", "/", { params: { id: sub.body.submissionId } });
    expect(v.status).toBe(200);
    const getUrl = new URL(v.body.url, "http://localhost:3000");
    const got = await parent.call(devStorage.GET, "GET", `${getUrl.pathname}${getUrl.search}`, {
      params: { key: getUrl.pathname.replace("/api/dev-storage/", "").split("/") },
      headers: { range: "bytes=0-3" },
    });
    expect(got.status).toBe(206);
    expect(await got.res.text()).toBe("fake");

    // 子どもは保護者用の再生URLを取れない
    expect((await kid.call(videoUrl.GET, "GET", "/", { params: { id: sub.body.submissionId } })).status).toBe(403);
  });
});
