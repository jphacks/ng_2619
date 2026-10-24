// API共通基盤（基本設計書 5.2）
// - エラーレスポンス形式の統一
// - 更新系リクエストの Origin ヘッダ確認（CSRF対策）
// - セッション確認とロール判定（requireSession）
// - セッション延長時の Cookie 再発行

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodTypeAny, type output } from "zod";
import type { Role } from "@/lib/constants";
import { AppError, errors } from "./errors";
import { logger } from "./logger";
import { loadSession, type SessionContext } from "./auth/session";
import { env } from "./env";

export type AuthMode = "none" | "any" | "parent" | "child";

type BaseContext<P> = {
  req: Request;
  params: P;
  url: URL;
  ip: string;
  userAgent: string | null;
  /** リクエストボディを読み込み、スキーマでチェックする */
  body<S extends ZodTypeAny>(schema: S): Promise<output<S>>;
};

export type PublicContext<P> = BaseContext<P> & { session: SessionContext | null };
export type AuthedContext<P> = BaseContext<P> & { session: SessionContext };

type RouteArgs<P> = { params: Promise<P> };
type Handler<P> = (req: Request, args: RouteArgs<P>) => Promise<Response>;

// ---- Cookie ----

/**
 * セッションの Cookie はロールごとに分ける。同じブラウザで保護者のタブと子どものタブを並べて使えるようにするため。
 * Middleware は Cookie の有無で画面を振り分ける（認可には使わない。3.3）
 */
export const SESSION_COOKIES: Record<Role, string> = { PARENT: "sid_parent", CHILD: "sid_child" };
const ROLES = Object.keys(SESSION_COOKIES) as Role[];

/** どちらのロールでも呼べる API で、画面がどちらのセッションを使うかを伝えるヘッダ（lib/api.ts が付ける） */
export const SESSION_ROLE_HEADER = "x-session-role";

function cookie(name: string, value: string, maxAgeSec: number): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
  if (env.isProd) parts.push("Secure");
  return parts.join("; ");
}

export function sessionCookies(token: string, role: Role, ttlSec: number): string[] {
  return [cookie(SESSION_COOKIES[role], token, ttlSec)];
}

/** role を省略すると両方のロールの Cookie を消す */
export function clearedCookies(role?: Role): string[] {
  return (role ? [role] : ROLES).map((r) => cookie(SESSION_COOKIES[r], "", 0));
}

/**
 * このリクエストで使うセッションのロールを決める。
 * ロール指定の API はそのロール。どちらでもよい API は、ヘッダの指定 → Cookie が1つだけならそれ → 保護者 の順。
 * Cookie がなければ null
 */
export function sessionRole(req: Request, mode: AuthMode): Role | null {
  if (mode === "parent") return readCookie(req, SESSION_COOKIES.PARENT) ? "PARENT" : null;
  if (mode === "child") return readCookie(req, SESSION_COOKIES.CHILD) ? "CHILD" : null;
  const present = ROLES.filter((r) => readCookie(req, SESSION_COOKIES[r]));
  const hint = req.headers.get(SESSION_ROLE_HEADER)?.toUpperCase() as Role | undefined;
  if (hint && present.includes(hint)) return hint;
  return present.includes("PARENT") ? "PARENT" : (present[0] ?? null);
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function withCookies<R extends Response>(res: R, cookies: string[]): R {
  for (const c of cookies) res.headers.append("Set-Cookie", c);
  return res;
}

// ---- レスポンス ----

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

export const created = (body: unknown) => json(body, 201);

/** sessionRole：セッションを確認したロール。ログインが必要なときは、そのロールの Cookie だけを消す */
function errorResponse(e: unknown, sessionRole: Role | null = null): Response {
  if (e instanceof AppError) {
    const res = json({ error: { code: e.code, message: e.message, ...e.extra } }, e.status);
    return e.status === 401 && e.code === "AUTH_REQUIRED" && sessionRole ? withCookies(res, clearedCookies(sessionRole)) : res;
  }
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of e.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    return json({ error: { code: "VALIDATION_ERROR", message: "入力内容を確認してください", fields } }, 400);
  }
  logger.error("unhandled error", { error: e });
  return json({ error: { code: "INTERNAL_ERROR", message: "エラーが発生しました。時間をおいてもう一度お試しください" } }, 500);
}

// ---- リクエスト ----

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** 更新系では Origin が自サイトと一致することを確認する（SameSite=Lax と組み合わせる） */
function checkOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // ブラウザ以外（curl・テスト）は Origin を付けない。CSRFはブラウザ経由でのみ起きる
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw errors.forbidden("不正なリクエストです");
  }
  if (!host || originHost !== host) throw errors.forbidden("不正なリクエストです");
}

/** role の Cookie のセッションを読む。Cookie の名前とユーザのロールが違うものは無効とする */
async function loadRoleSession(req: Request, role: Role): Promise<SessionContext | null> {
  const token = readCookie(req, SESSION_COOKIES[role]);
  const session = token ? await loadSession(token) : null;
  return session?.role === role ? session : null;
}

/** role は sessionRole() で API のロール指定から決めたもの。セッションのロールは loadRoleSession() で一致を確認済み */
async function requireSession(req: Request, role: Role | null): Promise<SessionContext> {
  // 別のロールでだけログインしている場合（例：子どもが保護者の API を呼んだ）も、このロールでは未ログインとして扱う
  if (!role) throw errors.authRequired();
  const session = await loadRoleSession(req, role);
  if (!session) throw errors.authRequired();
  return session;
}

/** 一覧APIのページング（?cursor=...&limit=20、最大50） */
export function pageQuery(url: URL): { cursor?: string; limit: number } {
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const cursor = url.searchParams.get("cursor") || undefined;
  return { cursor, limit };
}

/** Prisma の一意制約違反か */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// ---- ルート定義 ----

export function route<P = Record<string, never>>(
  auth: "none",
  fn: (ctx: PublicContext<P>) => Promise<unknown>,
): Handler<P>;
export function route<P = Record<string, never>>(
  auth: "any" | "parent" | "child",
  fn: (ctx: AuthedContext<P>) => Promise<unknown>,
): Handler<P>;
export function route<P>(auth: AuthMode, fn: (ctx: never) => Promise<unknown>): Handler<P> {
  return async (req, args) => {
    let session: SessionContext | null = null;
    const role = sessionRole(req, auth);
    try {
      checkOrigin(req);
      const params = (args?.params ? await args.params : {}) as P;
      if (auth !== "none") {
        session = await requireSession(req, role);
      } else {
        session = role ? await loadRoleSession(req, role) : null;
      }
      const ctx: PublicContext<P> = {
        req,
        params,
        url: new URL(req.url),
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
        session,
        async body(schema) {
          let raw: unknown;
          try {
            raw = await req.json();
          } catch {
            throw errors.validation("リクエストの形式が正しくありません");
          }
          return schema.parse(raw);
        },
      };
      const result = await (fn as (c: PublicContext<P>) => Promise<unknown>)(ctx);
      const res = result instanceof Response ? result : json(result ?? { ok: true });
      if (session?.refreshed && !res.headers.has("Set-Cookie")) {
        withCookies(res, sessionCookies(session.token, session.role, session.ttlSec));
      }
      return res;
    } catch (e) {
      return errorResponse(e, role);
    }
  };
}
