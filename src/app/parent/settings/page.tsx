"use client";

// P-08 アカウント設定（F-AUTH-02, 11）
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { MeResponse } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass, Loading, Modal, PageTitle } from "@/components/ui";
import { useParentApi } from "@/components/parent/ReauthProvider";

export default function SettingsPage() {
  const router = useRouter();
  const call = useParentApi();
  const { data: me, loading, setData } = useApi<MeResponse>("/me");
  const [profile, setProfile] = useState({ displayName: "", email: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [confirmOff, setConfirmOff] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  useEffect(() => {
    if (me) setProfile({ displayName: me.displayName, email: me.email ?? "" });
  }, [me]);

  async function run(fn: () => Promise<unknown>, done: string) {
    setMessage(null);
    setError(null);
    setFields({});
    try {
      await fn();
      setMessage(done);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === "REAUTH_CANCELLED") return false;
      if (e instanceof ApiError) {
        setError(e.message);
        setFields(e.fields ?? {});
      }
      return false;
    }
  }

  async function setReauth(reauthRequired: boolean) {
    setConfirmOff(false);
    await run(async () => setData(await call<MeResponse>("/me/settings", { method: "PATCH", body: { reauthRequired } })), "設定を変更しました");
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (loading || !me) return <Loading />;
  return (
    <div className="space-y-5">
      <PageTitle>設定</PageTitle>
      {message && <p role="status" className="rounded-xl bg-green-100 p-3 text-sm font-bold text-green-900">{message}</p>}
      <ErrorBanner message={error} />

      <Card className="space-y-1">
        <Link href="/parent/children" className="flex min-h-12 items-center justify-between font-bold">子どもアカウントの管理 <span aria-hidden>›</span></Link>
        <Link href="/parent/inquiry" className="flex min-h-12 items-center justify-between border-t border-line font-bold">お問い合わせ <span aria-hidden>›</span></Link>
      </Card>

      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => setData(await call<MeResponse>("/me", { method: "PATCH", body: profile })), "プロフィールを変更しました");
          }}
        >
          <h2 className="font-bold">プロフィール</h2>
          <p className="text-sm text-muted">ユーザID：{me.loginId}</p>
          <Field label="表示名" error={fields.displayName}>
            {(id) => <input id={id} className={inputClass()} value={profile.displayName} maxLength={10} onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))} />}
          </Field>
          <Field label="メールアドレス" error={fields.email}>
            {(id) => <input id={id} type="email" className={inputClass()} value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />}
          </Field>
          <Button type="submit">保存する</Button>
        </form>
      </Card>

      <Card>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => call("/me/password", { method: "PUT", body: pw }), "パスワードを変更しました。ほかの端末はログアウトされました")) {
              setPw({ currentPassword: "", newPassword: "" });
            }
          }}
        >
          <h2 className="font-bold">パスワードの変更</h2>
          <Field label="現在のパスワード" error={fields.currentPassword}>
            {(id) => <input id={id} type="password" className={inputClass()} value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} autoComplete="current-password" required />}
          </Field>
          <Field label="新しいパスワード" hint="8文字以上で、英字と数字をそれぞれ1文字以上" error={fields.newPassword}>
            {(id, d) => <input id={id} aria-describedby={d} type="password" className={inputClass()} value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} autoComplete="new-password" required />}
          </Field>
          <Button type="submit">変更する</Button>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">保護者モードのパスワード再入力</h2>
        <p className="text-sm text-muted">
          承認やアカウントの変更の前に、パスワードの入力を求めます。お子さまと端末を共用する場合はONにしてください。
        </p>
        <label className="flex min-h-12 items-center justify-between">
          <span className="font-bold">{me.reauthRequired ? "ON" : "OFF"}</span>
          <input
            type="checkbox"
            role="switch"
            className="h-6 w-12"
            checked={!!me.reauthRequired}
            onChange={(e) => (e.target.checked ? void setReauth(true) : setConfirmOff(true))}
          />
        </label>
      </Card>

      <Card className="space-y-3">
        <Button variant="secondary" block onClick={logout}>ログアウト</Button>
        <div className="flex justify-center gap-4 text-sm">
          <Link href="/terms" className="text-parent-primary underline">利用規約</Link>
          <Link href="/privacy" className="text-parent-primary underline">プライバシーポリシー</Link>
        </div>
        <Button variant="ghost" block className="text-danger" onClick={() => setConfirmWithdraw(true)}>退会する</Button>
      </Card>

      <Modal open={confirmOff} onClose={() => setConfirmOff(false)} title="パスワードの再入力をOFFにしますか？">
        <p>OFFにすると、保護者のログインが残った端末で、お子さまが承認や達成の登録をできてしまいます。</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOff(false)}>やめる</Button>
          <Button variant="danger" onClick={() => void setReauth(false)}>OFFにする</Button>
        </div>
      </Modal>

      <Modal open={confirmWithdraw} onClose={() => setConfirmWithdraw(false)} title="退会しますか？">
        <p>ご家族全員（お子さまを含む）のアカウントと、ミッション・動画などのデータがすべて削除されます。30日以内に完全に削除され、元に戻せません。</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmWithdraw(false)}>やめる</Button>
          <Button
            variant="danger"
            onClick={async () => {
              setConfirmWithdraw(false);
              if (await run(() => call("/me", { method: "DELETE" }), "退会しました")) router.replace("/login");
            }}
          >
            退会する
          </Button>
        </div>
      </Modal>
    </div>
  );
}
