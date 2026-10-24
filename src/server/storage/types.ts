// オブジェクトストレージの共通インターフェース（基本設計書 5.1 E-1）

/** raw＝変換前（非公開・1日で自動削除）、videos＝変換後（非公開） */
export type Bucket = "raw" | "videos";

export type SignedUpload = { url: string; headers: Record<string, string> };

export interface StorageDriver {
  /** ブラウザから直接 PUT するための署名付きURL */
  createUploadUrl(bucket: Bucket, key: string, contentType: string, maxBytes: number, expiresSec: number): Promise<SignedUpload>;
  /** ブラウザから直接 GET するための署名付きURL */
  createDownloadUrl(bucket: Bucket, key: string, expiresSec: number): Promise<string>;
  stat(bucket: Bucket, key: string): Promise<{ size: number } | null>;
  delete(bucket: Bucket, key: string): Promise<void>;
  deletePrefix(bucket: Bucket, prefix: string): Promise<void>;
  downloadToFile(bucket: Bucket, key: string, filePath: string): Promise<void>;
  uploadFromFile(bucket: Bucket, key: string, filePath: string, contentType: string): Promise<void>;
}

export const rawKey = (familyId: string, videoId: string) => `raw/${familyId}/${videoId}`;
export const convertedKey = (familyId: string, videoId: string) => `v/${familyId}/${videoId}.mp4`;

/** raw/{familyId}/{videoId} から videoId を取り出す */
export function videoIdFromRawKey(key: string): string | null {
  const m = /^raw\/[0-9a-f-]{36}\/([0-9a-f-]{36})$/i.exec(key);
  return m ? m[1]! : null;
}
