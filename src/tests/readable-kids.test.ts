import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { prisma } from "@/server/db";
import type { SessionContext } from "@/server/auth/session";
import { home, challengeDetail, records } from "@/server/services/kids";
import { POST as preview } from "@/app/api/v1/text-preview/route";
import { createSession } from "@/server/auth/session";

it("保存済みの原文を保ち、一覧・詳細・通知・記録・学年変更で表記を統一する", async () => {
  const familyId = randomUUID();
  const parentId = randomUUID();
  const childId = randomUUID();
  const missionId = randomUUID();
  const challengeId = randomUUID();
  const suffix = familyId.replaceAll("-", "").slice(0, 10);
  await prisma.family.create({ data: { id: familyId } });
  try {
    await prisma.user.create({ data: { id: parentId, familyId, role: "PARENT", loginId: `rp_${suffix}`, displayName: "テスト保護者", email: "test@example.com", passwordHash: "unused" } });
    await prisma.user.create({ data: { id: childId, familyId, role: "CHILD", loginId: `rk_${suffix}`, displayName: "テスト子", passwordHash: "unused", childProfile: { create: { grade: 1 } } } });
    const title = "なわとび 100回";
    const description = "学校で練習する";
    await prisma.mission.create({ data: { id: missionId, familyId, createdBy: parentId, categoryCode: "ROPE", title, description, verifyMethod: "VISUAL", targetValue: 100, targetUnit: "TIMES" } });
    await prisma.challenge.create({ data: { id: challengeId, missionId, familyId, childUserId: childId, status: "OPEN" } });
    const session: SessionContext = { userId: childId, familyId, role: "CHILD", displayName: "テスト子", sessionId: "unused", token: "unused", elevatedUntil: null, refreshed: false, ttlSec: 60 };
    expect((await home(session)).challenges[0]).toMatchObject({ title: "なわとび 100かい", targetUnitLabel: "かい" });
    expect(await challengeDetail(session, challengeId)).toMatchObject({ title: "なわとび 100かい", description: "がっこうでれんしゅうする" });
    await prisma.childProfile.update({ where: { userId: childId }, data: { grade: 6 } });
    expect((await home(session)).challenges[0]).toMatchObject({ title, targetUnitLabel: "回" });
    expect(await challengeDetail(session, challengeId)).toMatchObject({ title, description });
    await prisma.childProfile.update({ where: { userId: childId }, data: { grade: 1 } });
    await prisma.challenge.update({ where: { id: challengeId }, data: { status: "APPROVED", approvedAt: new Date() } });
    await prisma.submission.create({ data: { id: randomUUID(), challengeId, method: "VISUAL", submittedAt: new Date(), reviewResult: "APPROVED", reviewComment: "練習できたね", reviewerId: parentId, reviewedAt: new Date() } });
    expect((await records(session)).items[0]).toMatchObject({ title: "なわとび 100かい", comment: "れんしゅうできたね" });
    expect((await home(session)).notices[0]).toMatchObject({ missionTitle: "なわとび 100かい", comment: "れんしゅうできたね" });
    expect(await prisma.mission.findUnique({ where: { id: missionId } })).toMatchObject({ title, description });

    const request = (token?: string) => new Request("http://localhost:3000/api/v1/text-preview", {
      method: "POST", headers: { "content-type": "application/json", ...(token ? { cookie: `sid=${token}` } : {}) },
      body: JSON.stringify({ title, description, grade: 6 }),
    });
    const args = { params: Promise.resolve({}) };
    expect((await preview(request(), args)).status).toBe(401);
    const childSession = await createSession(prisma, childId, "CHILD", null);
    expect((await preview(request(childSession.token), args)).status).toBe(403);
    const parentSession = await createSession(prisma, parentId, "PARENT", null);
    const result = await preview(request(parentSession.token), args);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ kanaTitle: "なわとび 100かい", kanaDescription: "がっこうでれんしゅうする", gradeTitle: title, gradeDescription: description });
  } finally {
    await prisma.mission.deleteMany({ where: { familyId } });
    await prisma.family.delete({ where: { id: familyId } });
  }
});
