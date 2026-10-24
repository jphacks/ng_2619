import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

// 死活監視用（基本設計書 6.5 NF-O-02）
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
