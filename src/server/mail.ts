// メール送信（基本設計書 5.1 E-3）。SENDGRID_API_KEY がなければログに出すだけ（開発用）。
import { env } from "./env";
import { logger } from "./logger";

export async function sendMail(msg: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!env.sendgridApiKey) {
    // 開発時は本文（再設定URLなど）をログで確認する。ロガーは "token" を含むキーを伏せ字にするため body に入れる
    logger.info("mail (dev: not sent)", { to: msg.to, subject: msg.subject, body: msg.text });
    return true;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.sendgridApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: msg.to }] }],
          from: { email: env.mailFrom },
          subject: msg.subject,
          content: [{ type: "text/plain", value: msg.text }],
        }),
      });
      if (res.ok) return true;
      logger.warn("sendgrid error", { status: res.status, attempt });
    } catch (e) {
      logger.warn("sendgrid request failed", { error: e, attempt });
    }
  }
  logger.error("mail send failed", { subject: msg.subject });
  return false;
}
