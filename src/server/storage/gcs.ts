// Cloud Storage（本番・staging）。基本設計書 5.1 E-1a / E-1b
import { Storage } from "@google-cloud/storage";
import { env } from "../env";
import type { Bucket, StorageDriver } from "./types";

let client: Storage | null = null;
const gcs = () => (client ??= new Storage());

function bucketName(bucket: Bucket): string {
  const name = bucket === "raw" ? env.gcsRawBucket : env.gcsVideoBucket;
  if (!name) throw new Error(`GCS bucket for ${bucket} is not configured`);
  return name;
}

const file = (bucket: Bucket, key: string) => gcs().bucket(bucketName(bucket)).file(key);

export const gcsStorageDriver: StorageDriver = {
  async createUploadUrl(bucket, key, contentType, maxBytes, expiresSec) {
    const range = `0,${maxBytes}`;
    const [url] = await file(bucket, key).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + expiresSec * 1000,
      contentType,
      // 署名に含めることで、上限を超えるサイズのアップロードを Cloud Storage 側で拒否する
      extensionHeaders: { "x-goog-content-length-range": range },
    });
    return { url, headers: { "Content-Type": contentType, "x-goog-content-length-range": range } };
  },
  async createDownloadUrl(bucket, key, expiresSec) {
    const [url] = await file(bucket, key).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + expiresSec * 1000,
    });
    return url;
  },
  async stat(bucket, key) {
    const [exists] = await file(bucket, key).exists();
    if (!exists) return null;
    const [meta] = await file(bucket, key).getMetadata();
    return { size: Number(meta.size ?? 0) };
  },
  async delete(bucket, key) {
    await file(bucket, key).delete({ ignoreNotFound: true });
  },
  async deletePrefix(bucket, prefix) {
    await gcs().bucket(bucketName(bucket)).deleteFiles({ prefix, force: true });
  },
  async downloadToFile(bucket, key, filePath) {
    await file(bucket, key).download({ destination: filePath });
  },
  async uploadFromFile(bucket, key, filePath, contentType) {
    await gcs().bucket(bucketName(bucket)).upload(filePath, { destination: key, contentType });
  },
};
