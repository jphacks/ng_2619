/* eslint-disable @typescript-eslint/no-explicit-any -- テストではレスポンスを柔軟に参照するため */
// ルートハンドラを直接呼ぶテスト用クライアント（Cookieを保持する）
import { randomBytes } from "node:crypto";

type Handler = (req: Request, args: { params: Promise<never> }) => Promise<Response>;

export type ApiResult<T = any> = { status: number; body: T; res: Response };

export class TestClient {
  private cookies = new Map<string, string>();
  // ログインのIP制限（1分20回）にかからないよう、クライアントごとに別のIPにする
  readonly ip = `10.${rand()}.${rand()}.${rand()}`;

  async call<T = any>(
    handler: Handler,
    method: string,
    path: string,
    opts: { body?: unknown; params?: Record<string, unknown>; headers?: Record<string, string>; raw?: BodyInit } = {},
  ): Promise<ApiResult<T>> {
    const headers: Record<string, string> = { "x-forwarded-for": this.ip, ...opts.headers };
    if (this.cookies.size > 0) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    const req = new Request(`http://localhost:3000${path}`, {
      method,
      headers,
      body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
    const res = await handler(req, { params: Promise.resolve((opts.params ?? {}) as never) });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [k, ...v] = pair!.split("=");
      const value = decodeURIComponent(v.join("="));
      if (value === "" || /Max-Age=0/.test(c)) this.cookies.delete(k!);
      else this.cookies.set(k!, value);
    }
    const text = await res.clone().text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body, res };
  }
}

function rand() {
  return randomBytes(1)[0]! % 250;
}

export const uniqueId = (prefix: string) => `${prefix}_${randomBytes(4).toString("hex")}`;

export async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, timeoutMs = 10000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timeout");
    await new Promise((r) => setTimeout(r, 100));
  }
}
