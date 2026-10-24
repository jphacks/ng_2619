"use client";

// P-09 お問い合わせ（F-INQ-01）
import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button, Card, ErrorBanner, Field, inputClass, PageTitle } from "@/components/ui";

export default function InquiryPage() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api("/inquiries", { method: "POST", body: { subject, body } });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle>お問い合わせ</PageTitle>
      <Link href="/parent/settings" className="text-sm text-parent-primary underline">‹ 設定</Link>
      {sent ? (
        <Card className="space-y-2">
          <p className="font-bold">お問い合わせを受け付けました。</p>
          <p className="text-sm text-muted">ご登録のメールアドレス宛てにご返信します。</p>
        </Card>
      ) : (
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <ErrorBanner message={error} />
            <Field label="件名" hint="50文字まで" error={fields.subject}>
              {(id, d) => <input id={id} aria-describedby={d} className={inputClass()} maxLength={50} value={subject} onChange={(e) => setSubject(e.target.value)} required />}
            </Field>
            <Field label="内容" hint="2000文字まで" error={fields.body}>
              {(id, d) => <textarea id={id} aria-describedby={d} className={`${inputClass()} py-2`} rows={6} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} required />}
            </Field>
            <Button type="submit" block disabled={busy}>送信する</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
