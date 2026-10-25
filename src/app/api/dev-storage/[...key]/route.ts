// 開発用ストレージ（STORAGE_DRIVER=local のときだけ動く）。
// Cloud Storage の署名付きURLの代わりに、HMAC付きのURLでアップロード・ダウンロードを受け付ける。

import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { VIDEO_MAX_BYTES } from "@/lib/constants";
import { env } from "@/server/env";
import { localPath, verifyLocalSignature } from "@/server/storage/local";
import type { Bucket } from "@/server/storage/types";
import { processInBackground } from "@/server/services/videos";

export const dynamic = "force-dynamic";

type Args = { params: Promise<{ key: string[] }> };

async function parse(req: Request, args: Args, op: "put" | "get") {
  if (env.storageDriver !== "local") return null;
  const [bucket, ...rest] = (await args.params).key;
  if (bucket !== "raw" && bucket !== "videos") return null;
  const key = rest.join("/");
  const q = new URL(req.url).searchParams;
  const params = {
    op,
    bucket: bucket as Bucket,
    key,
    exp: Number(q.get("exp")),
    max: q.get("max") ? Number(q.get("max")) : undefined,
    ct: q.get("ct") ?? undefined,
  };
  if (q.get("op") !== op || !verifyLocalSignature(params, q.get("sig") ?? "")) return null;
  return params;
}

const forbidden = () => NextResponse.json({ error: { code: "FORBIDDEN", message: "URLが無効です" } }, { status: 403 });

export async function PUT(req: Request, args: Args) {
  const p = await parse(req, args, "put");
  if (!p) return forbidden();
  if (p.ct && req.headers.get("content-type") !== p.ct) return forbidden();
  const max = Math.min(p.max ?? VIDEO_MAX_BYTES, VIDEO_MAX_BYTES);
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > max) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "大きすぎます" } }, { status: 413 });

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0 || buf.length > max) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "サイズが正しくありません" } }, { status: 413 });
  }
  const dest = localPath(p.bucket, p.key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  // 本番では Eventarc がアップロード完了を通知する。開発では同じプロセスで変換を始める
  if (p.bucket === "raw") processInBackground(p.key);
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: Request, args: Args) {
  const p = await parse(req, args, "get");
  if (!p) return forbidden();
  const file = localPath(p.bucket, p.key);
  let size: number;
  try {
    size = (await fs.stat(file)).size;
  } catch {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "見つかりません" } }, { status: 404 });
  }

  // iOS Safari の <video> は Range リクエストに対応していないと再生できない
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  const contentType = p.key.endsWith(".webm") ? "video/webm" : p.key.endsWith(".mov") ? "video/quicktime" : "video/mp4";
  const headers: Record<string, string> = { "Content-Type": contentType, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" };
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new NextResponse(stream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}
