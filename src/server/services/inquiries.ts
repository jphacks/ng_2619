// 問い合わせ（F-INQ-01 / NF-O-06）
import { prisma } from "../db";
import { env } from "../env";
import { newId } from "../ids";
import { sendMail } from "../mail";
import type { SessionContext } from "../auth/session";

export async function createInquiry(session: SessionContext, input: { subject: string; body: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const id = newId();
  await prisma.inquiry.create({ data: { id, userId: user.id, subject: input.subject, body: input.body } });
  // 転送先は未定【要確認 BQ-09】。未設定ならDBへの保存のみ
  if (env.inquiryToEmail) {
    await sendMail({
      to: env.inquiryToEmail,
      subject: `[問い合わせ] ${input.subject}`,
      text: [`問い合わせID: ${id}`, `ユーザID: ${user.loginId}`, `返信先: ${user.email ?? "-"}`, "", input.body].join("\n"),
    });
  }
  return { inquiryId: id };
}
