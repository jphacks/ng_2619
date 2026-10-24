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

export const SESSION_COOKIE = "sid";
/** Middleware が画面を振り分けるためのロール。認可には使わない（3.3） */
export const ROLE_COOKIE = "role";

function cookie(name: string, value: string, maxAgeSec: number): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
  if (env.isProd) parts.push("Secure");
  return parts.join("; ");
}

export function sessionCookies(token: string, role: Role, ttlSec: number): string[] {
  return [cookie(SESSION_COOKIE, token, ttlSec), cookie(ROLE_COOKIE, role, ttlSec)];
}

export function clearedCookies(): string[] {
  return [cookie(SESSION_COOKIE, "", 0), cookie(ROLE_COOKIE, "", 0)];
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

function errorResponse(e: unknown): Response {
  if (e instanceof AppError) {
    const res = json({ error: { code: e.code, message: e.message, ...e.extra } }, e.status);
    return e.status === 401 && e.code === "AUTH_REQUIRED" ? withCookies(res, clearedCookies()) : res;
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

async function requireSession(req: Request, mode: Exclude<AuthMode, "none">): Promise<SessionContext> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) throw errors.authRequired();
  const session = await loadSession(token);
  if (!session) throw errors.authRequired();
  if (mode === "parent" && session.role !== "PARENT") throw errors.forbidden();
  if (mode === "child" && session.role !== "CHILD") throw errors.forbidden();
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
    try {
      checkOrigin(req);
      const params = (args?.params ? await args.params : {}) as P;
      if (auth !== "none") {
        session = await requireSession(req, auth);
      } else {
        const token = readCookie(req, SESSION_COOKIE);
        session = token ? await loadSession(token) : null;
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
      return errorResponse(e);
    }
  };
}
