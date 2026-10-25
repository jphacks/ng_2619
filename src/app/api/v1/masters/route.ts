import { NextResponse } from "next/server";
import { route } from "@/server/http";
import { getMasters } from "@/server/services/masters";

export const GET = route("any", async (c) => {
  const { body, etag } = await getMasters(c.session.familyId);
  const headers = { ETag: etag, "Cache-Control": "private, max-age=3600" };
  if (c.req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return NextResponse.json(body, { headers });
});
