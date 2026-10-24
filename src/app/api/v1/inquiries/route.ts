import { inquirySchema } from "@/lib/schemas";
import { created, route } from "@/server/http";
import { createInquiry } from "@/server/services/inquiries";

// F-INQ-01
export const POST = route("parent", async (c) => created(await createInquiry(c.session, await c.body(inquirySchema))));
