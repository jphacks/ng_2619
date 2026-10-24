import { env } from "../env";
import type { StorageDriver } from "./types";
import { localStorageDriver } from "./local";
import { gcsStorageDriver } from "./gcs";

export * from "./types";

/** STORAGE_DRIVER=gcs なら Cloud Storage、それ以外はローカル（開発用） */
export const storage: StorageDriver = env.storageDriver === "gcs" ? gcsStorageDriver : localStorageDriver;

export const UPLOAD_URL_TTL_SEC = 15 * 60;
export const DOWNLOAD_URL_TTL_SEC = 10 * 60;
