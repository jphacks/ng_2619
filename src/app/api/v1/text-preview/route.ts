import { z } from "zod";
import { json, route } from "@/server/http";
import { readableText } from "@/server/readable-text";

const schema = z.object({
  title: z.string().max(30),
  description: z.string().max(200),
  grade: z.number().int().min(1).max(6),
});

export const POST = route("parent", async c => {
  const { title, description, grade } = await c.body(schema);
  const [kanaTitle, kanaDescription, gradeTitle, gradeDescription] = await Promise.all([
    readableText(title, 1), readableText(description, 1),
    readableText(title, grade), readableText(description, grade),
  ]);
  return json({ kanaTitle, kanaDescription, gradeTitle, gradeDescription });
});
