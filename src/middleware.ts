// 画面の振り分け（基本設計書 3.3）。
// ここでは Cookie の有無とロールで画面を誘導するだけ。正式な権限チェックはすべて API 側で行う。
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = !!req.cookies.get("sid")?.value;
  const role = req.cookies.get("role")?.value;
  const home = role === "CHILD" ? "/kids" : "/parent";

  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? home : "/login", req.url));
  }

  const isParent = pathname === "/parent" || pathname.startsWith("/parent/");
  const isKids = pathname === "/kids" || pathname.startsWith("/kids/");
  if (!isParent && !isKids) return NextResponse.next();

  if (!hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (isParent && role === "CHILD") return NextResponse.redirect(new URL("/kids", req.url));
  if (isKids && role === "PARENT") return NextResponse.redirect(new URL("/parent", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/parent/:path*", "/kids/:path*"] };
