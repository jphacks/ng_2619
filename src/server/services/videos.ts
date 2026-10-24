// 動画変換と削除（F-SYS-01、基本設計書 5.1）
// 本番：videos-raw へのアップロード完了 → Eventarc → transcoder/server.ts → processRawObject()
// 開発：/api/dev-storage への PUT 完了時に、同じプロセスで processRawObject() を呼ぶ

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { convertedKey, storage, videoIdFromRawKey } from "../storage";

export const MAX_TRANSCODE_ATTEMPTS = 3;

function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", (e) => resolve({ code: -1, stdout, stderr: String(e) }));
    p.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

let ffmpegAvailable: Promise<boolean> | null = null;
const hasFfmpeg = () => (ffmpegAvailable ??= run(env.ffmpegPath, ["-version"]).then((r) => r.code === 0));

async function probeDuration(file: string): Promise<number | null> {
  const r = await run(env.ffprobePath, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  const n = Number.parseFloat(r.stdout.trim());
  return r.code === 0 && Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

/** 基本設計書 5.1 の変換コマンド：H.264・短辺720px・メタデータ削除・60秒で打ち切り */
export function ffmpegArgs(input: string, output: string): string[] {
  return [
    "-y",
    "-i", input,
    "-t", "60",
    "-vf", "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-profile:v", "main", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k",
    "-map_metadata", "-1", "-map_chapters", "-1",
    "-movflags", "+faststart",
    output,
  ];
}

/**
 * 元動画を変換して videos バケットに保存する。同じイベントが2回届いても結果は変わらない（冪等）。
 * 失敗したら例外を投げる（Eventarc が再試行する）。3回目の失敗で FAILED にする。
 */
export async function processRawObject(objectKey: string): Promise<"done" | "skipped" | "failed"> {
  const videoId = videoIdFromRawKey(objectKey);
  if (!videoId) {
    logger.warn("transcode: unexpected object key", { objectKey });
    return "skipped";
  }
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video || !["UPLOADING", "PROCESSING"].includes(video.status) || video.deletedAt) return "skipped";

  const { attemptCount } = await prisma.video.update({
    where: { id: videoId },
    data: { attemptCount: { increment: 1 } },
    select: { attemptCount: true },
  });

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "transcode-"));
  const input = path.join(dir, "input");
  const output = path.join(dir, "output.mp4");
  try {
    await storage.downloadToFile("raw", video.rawObject, input);
    let duration: number | null = null;
    if (await hasFfmpeg()) {
      duration = await probeDuration(input);
      const r = await run(env.ffmpegPath, ffmpegArgs(input, output));
      if (r.code !== 0) throw new Error(`ffmpeg failed: ${r.stderr.slice(-500)}`);
    } else if (!env.isProd) {
      // 開発環境に ffmpeg がない場合は変換せずにコピーする（iPhoneのHEVC動画はAndroidで再生できないことがある）
      logger.warn("ffmpeg not found: copying video without transcoding (dev only)", { videoId });
      await fs.copyFile(input, output);
    } else {
      throw new Error("ffmpeg not found");
    }

    const key = convertedKey(video.familyId, video.id);
    await storage.uploadFromFile("videos", key, output, "video/mp4");
    const updated = await prisma.video.updateMany({
      where: { id: videoId, status: { in: ["UPLOADING", "PROCESSING"] } },
      data: { status: "READY", convertedObject: key, durationSec: duration, failureReason: null },
    });
    if (updated.count === 1) {
      // 元動画には撮影場所などのメタデータが残るため、変換が終わったら消す（バケットのライフサイクルでも1日で消える）
      await storage.delete("raw", video.rawObject).catch(() => undefined);
    } else {
      await storage.delete("videos", key).catch(() => undefined);
    }
    return "done";
  } catch (e) {
    logger.error("transcode failed", { videoId, attemptCount, error: e });
    if (attemptCount >= MAX_TRANSCODE_ATTEMPTS) {
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "FAILED", failureReason: String((e as Error).message ?? e).slice(0, 500) },
      });
      return "failed";
    }
    throw e;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** 開発用：同じプロセスで変換を走らせる（最大3回まで再試行） */
export function processInBackground(objectKey: string) {
  void (async () => {
    for (let i = 0; i < MAX_TRANSCODE_ATTEMPTS; i++) {
      try {
        const r = await processRawObject(objectKey);
        if (r !== "failed" || i === MAX_TRANSCODE_ATTEMPTS - 1) return;
      } catch {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  })();
}

/** 動画ファイル（元動画・変換後）を消す */
export async function deleteVideoObjects(video: { rawObject: string; convertedObject: string | null }) {
  await storage.delete("raw", video.rawObject);
  if (video.convertedObject) await storage.delete("videos", video.convertedObject);
}
