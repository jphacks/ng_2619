// 画面の振り分け（基本設計書 3.3）。
// ここでは Cookie の有無で画面を誘導するだけ。正式な権限チェックはすべて API 側で行う。
// セッションの Cookie は保護者用（sid_parent）と子ども用（sid_child）に分かれている（server/http.ts）
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasParent = !!req.cookies.get("sid_parent")?.value;
  const hasChild = !!req.cookies.get("sid_child")?.value;

  if (pathname === "/") {
    const home = hasParent ? "/parent" : hasChild ? "/kids" : "/login";
    return NextResponse.redirect(new URL(home, req.url));
  }

  const isParent = pathname === "/parent" || pathname.startsWith("/parent/");
  const isKids = pathname === "/kids" || pathname.startsWith("/kids/");
  if (!isParent && !isKids) return NextResponse.next();
  if ((isParent && hasParent) || (isKids && hasChild)) return NextResponse.next();

  // 子どもだけがログインしているときに保護者の画面を開いたら、子どものホームへ。
  // 逆（子どもの画面で保護者だけがログイン中）は保護者のホームへは移さない。共用端末で子どもが保護者の画面に入らないようにするため
  if (isParent && hasChild) return NextResponse.redirect(new URL("/kids", req.url));

  const url = new URL("/login", req.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/", "/parent/:path*", "/kids/:path*"] };
