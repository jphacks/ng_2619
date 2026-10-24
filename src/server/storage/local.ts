// 開発用のローカルストレージ。ファイルは .storage/ に保存し、
// 署名付きURLの代わりに HMAC 付きの /api/dev-storage/... を発行する。本番では使わない。

import { createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../env";
import type { Bucket, SignedUpload, StorageDriver } from "./types";

const root = () => path.resolve(process.cwd(), env.storageLocalDir);

export function localPath(bucket: Bucket, key: string): string {
  const base = path.resolve(root(), bucket);
  const p = path.resolve(base, key);
  if (!p.startsWith(base + path.sep)) throw new Error("invalid key");
  return p;
}

export type LocalSignParams = { op: "put" | "get"; bucket: Bucket; key: string; exp: number; max?: number; ct?: string };

function signature(p: LocalSignParams): string {
  const payload = [p.op, p.bucket, p.key, p.exp, p.max ?? "", p.ct ?? ""].join("|");
  return createHmac("sha256", env.storageLocalSecret).update(payload).digest("base64url");
}

export function verifyLocalSignature(p: LocalSignParams, sig: string): boolean {
  if (!Number.isFinite(p.exp) || p.exp < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signature(p));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function signedUrl(p: LocalSignParams): string {
  const q = new URLSearchParams({ op: p.op, exp: String(p.exp), sig: signature(p) });
  if (p.max !== undefined) q.set("max", String(p.max));
  if (p.ct) q.set("ct", p.ct);
  return `/api/dev-storage/${p.bucket}/${p.key}?${q.toString()}`;
}

export const localStorageDriver: StorageDriver = {
  async createUploadUrl(bucket, key, contentType, maxBytes, expiresSec): Promise<SignedUpload> {
    const exp = Math.floor(Date.now() / 1000) + expiresSec;
    return {
      url: signedUrl({ op: "put", bucket, key, exp, max: maxBytes, ct: contentType }),
      headers: { "Content-Type": contentType },
    };
  },
  async createDownloadUrl(bucket, key, expiresSec) {
    const exp = Math.floor(Date.now() / 1000) + expiresSec;
    return signedUrl({ op: "get", bucket, key, exp });
  },
  async stat(bucket, key) {
    try {
      const s = await fs.stat(localPath(bucket, key));
      return { size: s.size };
    } catch {
      return null;
    }
  },
  async delete(bucket, key) {
    await fs.rm(localPath(bucket, key), { force: true });
  },
  async deletePrefix(bucket, prefix) {
    await fs.rm(localPath(bucket, prefix), { recursive: true, force: true });
  },
  async downloadToFile(bucket, key, filePath) {
    await fs.copyFile(localPath(bucket, key), filePath);
  },
  async uploadFromFile(bucket, key, filePath) {
    const dest = localPath(bucket, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(filePath, dest);
  },
};
