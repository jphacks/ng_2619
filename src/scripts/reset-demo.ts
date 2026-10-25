// DBだけを起動した状態で、ルートから npm run reset:demo。
// --dry-run は確認のみ。--delete-other-families でデモ家族以外のアカウントも削除する。
import { PrismaClient } from "@prisma/client";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
process.loadEnvFile(".env");
const db = new PrismaClient();

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "54329" || url.pathname !== "/kids_outdoor" || (process.env.STORAGE_DRIVER ?? "local") !== "local") {
    throw new Error("このコマンドは標準のローカルDB・ローカルストレージ専用です。");
  }
  const parent = await db.user.findUnique({ where: { loginId: "demo_parent" } });
  if (!parent || parent.role !== "PARENT" || parent.deletedAt) throw new Error("demo_parent が見つかりません。データは変更していません。");
  const familyId = parent.familyId;
  const deleteOthers = process.argv.includes("--delete-other-families");
  const otherFamilies = deleteOthers ? await db.family.findMany({ where: { id: { not: familyId } }, select: { id: true } }) : [];
  const otherFamilyIds = otherFamilies.map(family => family.id);
  const otherUsers = deleteOthers ? await db.user.findMany({ where: { familyId: { in: otherFamilyIds } }, select: { id: true, loginId: true } }) : [];
  const targetFamilyIds = [familyId, ...otherFamilyIds];
  const children = await db.user.findMany({ where: { familyId, role: "CHILD" }, select: { id: true, loginId: true } });
  const childIds = children.map(child => child.id);
  const missionCount = await db.mission.count({ where: { familyId: { in: targetFamilyIds } } });
  const videoCount = await db.video.count({ where: { familyId: { in: targetFamilyIds } } });

  const storageRoot = path.resolve(root, process.env.STORAGE_LOCAL_DIR ?? ".storage");
  if (targetFamilyIds.some(id => !/^[0-9a-f-]{36}$/i.test(id))) throw new Error("家族IDが正しくありません。");
  const targets = targetFamilyIds.flatMap(id => [path.resolve(storageRoot, "raw", "raw", id), path.resolve(storageRoot, "videos", "v", id)]);
  // Windowsの再帰削除前に、実際の絶対パスがこのプロジェクト内かつ保存先内であることを検証する。
  if (!storageRoot.startsWith(root) || targets.some(target => !target.startsWith(storageRoot + path.sep))) {
    throw new Error("動画保存先がプロジェクト外です。データは変更していません。");
  }
  console.log(`対象: demo_parent と同じ家族（子ども: ${children.map(child => child.loginId).join(", ")}）`);
  console.log(`ミッション ${missionCount}件、動画 ${videoCount}件。アカウント・パスワード・学年は保持します。`);
  if (deleteOthers) console.log(`追加の削除対象: デモ家族以外の ${otherFamilyIds.length}家族・${otherUsers.length}アカウント（ログイン情報を含めて削除）。`);
  if (process.argv.includes("--dry-run")) { console.log("確認のみ。データは変更していません。"); return; }

  // ミッション削除によりチャレンジ・報告・コメントもCASCADEで削除される。
  await db.$transaction(async tx => {
    await tx.video.deleteMany({ where: { familyId: { in: targetFamilyIds } } });
    await tx.mission.deleteMany({ where: { familyId: { in: targetFamilyIds } } });
    await tx.activityDay.deleteMany({ where: { userId: { in: childIds } } });
    await tx.childProfile.updateMany({ where: { userId: { in: childIds } }, data: { approvedCount: 0, level: 1, lastSeenLevel: 1, avatarInitialized: false } });
    const { createDefaultEquips } = await import("../server/services/avatar");
    await tx.avatarEquip.deleteMany({ where: { childUserId: { in: childIds } } });
    for (const child of children) await createDefaultEquips(tx, child.id);
    if (deleteOthers) {
      await tx.loginEvent.deleteMany({ where: { OR: [{ userId: { in: otherUsers.map(user => user.id) } }, { loginIdInput: { in: otherUsers.map(user => user.loginId) } }] } });
      await tx.family.deleteMany({ where: { id: { in: otherFamilyIds } } });
    }
  });
  for (const target of targets) await rm(target, { recursive: true, force: true });
  console.log("完了: デモ家族のミッション・報告・動画・活動記録を削除し、レベルとアバターを初期化しました。");
  console.log(deleteOthers ? "デモ家族のアカウントはそのまま使えます。ほかの家族はアカウントごと削除しました。" : "アカウントはそのまま使えます。ほかの家族のデータは変更していません。");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
