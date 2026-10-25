import { z } from "zod";
import { created, route } from "@/server/http";
import { addCategory, listCategories } from "@/server/services/categories";

export const GET = route("parent", async c => ({ items: await listCategories(c.session.familyId) }));
export const POST = route("parent", async c => {
  const { label } = await c.body(z.object({ label: z.string().trim().min(1, "カテゴリ名を入力してください").max(20, "カテゴリ名は20文字以内にしてください") }));
  return created(await addCategory(c.session.familyId, label));
});
