// 起動済みのアプリに対して実行: npm run e2e:camera
// ブラウザの合成カメラを使用。APIはモックし、実際の撮影・データ保存は行わない。
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ID = "0192f3c4-0000-7000-8000-000000000000";
const browserOptions = {
  channel: process.env.BROWSER_CHANNEL || undefined,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
};

async function scenario(mode, verify, suffix = "") {
  if (process.env.CAMERA_CASE && process.env.CAMERA_CASE !== mode) return;
  // 合成デバイスをケースごとに初期化する（Edgeでは別contextへの再接続が失敗する場合がある）。
  const browser = await chromium.launch(browserOptions);
  const context = await browser.newContext({ permissions: ["camera", "microphone"] });
  let page;
  try {
    await context.addCookies([{ name: "sid_child", value: "camera-test", url: BASE }]);
    await context.addInitScript(mode => {
      window.__cameraStreams = [];
      const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      // Edgeの合成デバイスはstop後の再取得でNotFoundになるため、
      // テスト用ソースからcloneを渡す。アプリが各trackを解放したかはcloneで検証する。
      let source;
      navigator.mediaDevices.getUserMedia = async constraints => {
        if (mode === "denied") throw new DOMException("denied", "NotAllowedError");
        source ??= getUserMedia(constraints);
        const stream = (await source).clone();
        if (mode === "late") await new Promise(resolve => setTimeout(resolve, 1000));
        window.__cameraStreams.push(stream);
        return stream;
      };
      if (mode === "webm") {
        const supported = MediaRecorder.isTypeSupported.bind(MediaRecorder);
        MediaRecorder.isTypeSupported = type => type.startsWith("video/webm") && supported(type);
      }
      if (mode === "unsupported") window.MediaRecorder = undefined;
      if (mode === "auto") {
        const timeout = window.setTimeout.bind(window);
        window.setTimeout = (fn, ms, ...args) => timeout(fn, ms === 60000 ? 1500 : ms, ...args);
      }
    }, mode);
    page = await context.newPage();
    const errors = [];
    let fileChoosers = 0;
    page.on("filechooser", () => { fileChoosers++; });
    page.on("pageerror", error => errors.push(error.message));
    let uploadedType;
    let uploadBytes = 0;
    let submittedComment;
    await page.route("**/api/v1/**", async route => {
      const pathname = new URL(route.request().url()).pathname;
      let body;
      if (pathname.endsWith("/video-upload-url")) {
        uploadedType = route.request().postDataJSON().contentType;
        body = { videoId: ID, uploadUrl: "/api/v1/camera-test-upload", method: "PUT", headers: { "Content-Type": uploadedType } };
      } else if (pathname.endsWith("/camera-test-upload")) {
        uploadBytes = route.request().postDataBuffer().length;
        assert.equal(route.request().headers()["content-type"], uploadedType);
        body = {};
      } else if (pathname.endsWith("/submissions")) {
        submittedComment = route.request().postDataJSON().childComment;
        body = { submissionId: ID, challengeStatus: "PENDING" };
      }
      else if (pathname.endsWith("/masters")) body = { stamps: [] };
      else if (pathname.endsWith("/kids/home")) body = { child: { displayName: "テスト", avatarInitialized: true, level: 1, approvedCount: 0, remainingToNext: 1, levelStart: 0, levelEnd: 1 }, avatar: [], notices: [], challenges: [], levelUp: null, safetyMessage: null };
      else body = { id: ID, grade: 1, title: "カメラテスト", status: "OPEN", description: null, categoryCode: "OTHER", verifyMethod: "VIDEO", targetValue: null, targetUnit: null, targetUnitLabel: null, dueDate: null };
      await route.fulfill({ json: body });
    });
    await page.goto(`${BASE}/kids/challenges/${ID}${suffix}`);
    await page.getByRole("button", { name: "🎥 どうがを とる", exact: true }).click();
    await verify(page, () => ({ uploadedType, uploadBytes, submittedComment }));
    assert.deepEqual(errors, []);
    assert.equal(fileChoosers, 0, "撮影ボタンはファイル選択ダイアログを開かない");
    console.log(`PASS: camera ${mode}`);
  } catch (error) {
    console.error(`FAIL: camera ${mode}`, await page?.locator("body").innerText());
    throw error;
  } finally { await context.close(); await browser.close(); }
}

async function cameraReleased(page) {
  await page.waitForFunction(() => window.__cameraStreams.length > 0 && window.__cameraStreams.every(stream => stream.getTracks().every(track => track.readyState === "ended")));
}
async function record(page) {
  await page.waitForFunction(() => document.querySelector('video[aria-label="カメラの えいぞう"]')?.currentTime > 0);
  await page.getByRole("button", { name: "🔴 とりはじめる", exact: true }).click();
  await page.getByRole("timer").filter({ hasText: "1 / 60" }).waitFor();
}
async function preview(page) {
  await page.locator('video[src^="blob:"]').waitFor();
  await page.waitForFunction(() => document.querySelector('video[src^="blob:"]')?.readyState >= 1);
  await cameraReleased(page);
}

{
  for (const mode of ["default", "webm"]) await scenario(mode, async (page, sent) => {
    await record(page);
    await page.getByRole("button", { name: "⏹ とりおわる", exact: true }).click();
    await preview(page);
    assert.equal(await page.getByText("いつ見てほしい？", { exact: true }).count(), 0);
    assert.equal(await page.getByText("どこで見てほしい？", { exact: true }).count(), 0);
    assert.equal(await page.getByText("ひとことスタンプ（えらばなくても いいよ）", { exact: true }).count(), 0);
    const comment = mode === "default" ? "さいごまで がんばったよ！\nたのしかった" : "";
    await page.getByLabel("コメント", { exact: true }).fill(comment);
    await page.getByRole("button", { name: "おくる", exact: true }).click();
    await page.waitForURL(`**/kids/challenges/${ID}/done`);
    assert.ok(sent().uploadBytes > 0);
    assert.equal(sent().submittedComment, comment);
    assert.ok(["video/mp4", "video/webm"].includes(sent().uploadedType));
    if (mode === "webm") assert.equal(sent().uploadedType, "video/webm");
  });
  await scenario("auto", async page => {
    await record(page);
    await preview(page);
    await page.getByRole("button", { name: "もどる", exact: true }).click();
    await page.getByRole("button", { name: "🎥 どうがを とる", exact: true }).click();
    await page.getByRole("button", { name: "🔴 とりはじめる", exact: true }).waitFor();
  });
  await scenario("cancel", async page => {
    await record(page);
    await page.getByRole("button", { name: "やめて もどる", exact: true }).click();
    await cameraReleased(page);
    assert.equal(await page.locator('video[src^="blob:"]').count(), 0);
  });
  await scenario("late", async page => {
    await page.getByRole("button", { name: "やめて もどる", exact: true }).click();
    await cameraReleased(page);
  });
  await scenario("navigation", async page => {
    await record(page);
    await page.getByRole("link", { name: "‹ もどる", exact: true }).click();
    await cameraReleased(page);
  });
  await scenario("denied", async page => {
    await page.getByRole("alert").filter({ hasText: "きょかしてね" }).waitFor();
    await page.getByRole("button", { name: "やめて もどる", exact: true }).click();
    await page.getByRole("button", { name: "📁 どうがを えらぶ", exact: true }).waitFor();
  });
  await scenario("unsupported", async page => {
    await page.getByRole("alert").filter({ hasText: "この ブラウザでは とれないよ" }).waitFor();
    assert.equal(await page.evaluate(() => window.__cameraStreams.length), 0);
  });
  await scenario("standalone", async page => {
    await record(page);
    await page.getByRole("button", { name: "⏹ とりおわる", exact: true }).click();
    await preview(page);
  }, "/report");
}
