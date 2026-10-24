// パスワードのハッシュ化（基本設計書 6.3 NF-S-02：Argon2id、OWASP推奨値）
import { hash, verify } from "@node-rs/argon2";

const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/** 存在しないユーザIDのときも同じくらい時間をかけ、応答時間からIDの有無を推測させない（1.6.1） */
export async function verifyDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("dummy-password-for-timing-0");
  await verifyPassword(await dummyHash, password);
}
