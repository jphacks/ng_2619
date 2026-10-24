"use client";

// 画面から API を呼ぶ共通処理（基本設計書 5.2）

import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly reason?: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal };

/**
 * いま開いている画面のロール。同じブラウザで保護者と子どもが両方ログインしているとき、
 * どちらでも呼べる API（/me、ログアウトなど）でどちらのセッションを使うかをサーバに伝える（server/http.ts）
 */
function screenRole(): "PARENT" | "CHILD" | null {
  if (typeof window === "undefined") return null;
  const p = window.location.pathname;
  if (p === "/parent" || p.startsWith("/parent/")) return "PARENT";
  if (p === "/kids" || p.startsWith("/kids/")) return "CHILD";
  return null;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const role = screenRole();
  if (role) headers["X-Session-Role"] = role;
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "NETWORK_ERROR", "通信できませんでした。電波のよいところで、もう一度お試しください");
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    const err = data?.error;
    if (res.status === 401 && err?.code === "AUTH_REQUIRED" && typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }
    throw new ApiError(res.status, err?.code ?? "INTERNAL_ERROR", err?.message ?? "エラーが発生しました", err?.reason, err?.fields);
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : "エラーが発生しました");
