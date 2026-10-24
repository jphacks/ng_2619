"use client";

// P-07 子どもアカウント管理（F-AUTH-04〜06）。更新系の操作は再認証が必要
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { ChildCard, ChildrenListResponse } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Button, Card, EmptyState, ErrorBanner, Field, inputClass, Loading, Modal, PageTitle } from "@/components/ui";
import { useParentApi } from "@/components/parent/ReauthProvider";

type Dialog =
  | { kind: "add" }
  | { kind: "edit"; child: ChildCard }
  | { kind: "password"; child: ChildCard }
  | { kind: "delete"; child: ChildCard }
  | null;

const GRADES = [1, 2, 3, 4, 5, 6];

export default function ChildrenPage() {
  const call = useParentApi();
  const { data, error, loading, reload } = useApi<ChildrenListResponse>("/children");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState({ displayName: "", grade: "1", loginId: "", password: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function open(d: Exclude<Dialog, null>) {
    setFields({});
    setFormError(null);
    setForm(
      d.kind === "edit"
        ? { displayName: d.child.displayName, grade: String(d.child.grade), loginId: "", password: "" }
        : { displayName: "", grade: "1", loginId: "", password: "" },
    );
    setDialog(d);
  }

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setFields({});
    setFormError(null);
    try {
      await fn();
      setDialog(null);
      setNotice(done);
      await reload();
    } catch (e) {
      if (e instanceof ApiError && e.code === "REAUTH_CANCELLED") return;
      if (e instanceof ApiError) {
        setFormError(e.message);
        setFields(e.fields ?? {});
      }
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading && !data) return <Loading />;
  const items = data?.items ?? [];
  const full = data ? items.length >= data.max : false;

  return (
    <div className="space-y-4">
      <PageTitle action={<Button onClick={() => open({ kind: "add" })} disabled={full}>＋ 追加</Button>}>子どもアカウント</PageTitle>
      <Link href="/parent/settings" className="text-sm text-parent-primary underline">‹ 設定</Link>
      <ErrorBanner message={error?.message} />
      {notice && <p role="status" className="rounded-xl bg-green-100 p-3 text-sm font-bold text-green-900">{notice}</p>}
      {full && <p className="text-sm text-muted">子どもアカウントは{data?.max}人まで作成できます。</p>}
      {items.length === 0 ? (
        <EmptyState>まだお子さまのアカウントがありません。「＋ 追加」から作成してください。</EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id}>
              <Card className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar layers={c.avatar} size={56} />
                  <div>
                    <p className="font-bold">{c.displayName} <span className="text-sm font-normal text-muted">{c.grade}年生</span></p>
                    <p className="text-sm text-muted">ユーザID：{c.loginId}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="min-h-10 text-sm" onClick={() => open({ kind: "edit", child: c })}>編集</Button>
                  <Button variant="secondary" className="min-h-10 text-sm" onClick={() => open({ kind: "password", child: c })}>パスワード再設定</Button>
                  <Button variant="ghost" className="min-h-10 text-sm text-danger" onClick={() => open({ kind: "delete", child: c })}>削除</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={dialog?.kind === "add"} onClose={() => setDialog(null)} title="子どもアカウントを追加">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => call("/children", { method: "POST", body: { ...form, grade: Number(form.grade) } }), "子どもアカウントを作成しました。ユーザIDとパスワードをお子さまに伝えてください。");
          }}
        >
          <ErrorBanner message={formError} />
          <Field label="表示名" hint="ニックネームで入力してください（本名は避けてください）。10文字まで" error={fields.displayName}>
            {(id, d) => <input id={id} aria-describedby={d} className={inputClass()} value={form.displayName} onChange={set("displayName")} maxLength={10} required />}
          </Field>
          <Field label="学年" error={fields.grade}>
            {(id) => (
              <select id={id} className={inputClass()} value={form.grade} onChange={set("grade")}>
                {GRADES.map((g) => <option key={g} value={g}>{g}年生</option>)}
              </select>
            )}
          </Field>
          <Field label="ユーザID" hint="半角英数字と _ で4〜20文字。削除したユーザIDは30日間使えません" error={fields.loginId}>
            {(id, d) => <input id={id} aria-describedby={d} className={inputClass()} value={form.loginId} onChange={set("loginId")} autoCapitalize="none" autoComplete="off" required />}
          </Field>
          <Field label="パスワード" hint="6文字以上（数字だけでもOK）。お子さまの誕生日などは避けてください" error={fields.password}>
            {(id, d) => <input id={id} aria-describedby={d} className={inputClass()} value={form.password} onChange={set("password")} autoComplete="new-password" required />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>やめる</Button>
            <Button type="submit" disabled={busy}>作成する</Button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog?.kind === "edit"} onClose={() => setDialog(null)} title="表示名・学年の変更">
        {dialog?.kind === "edit" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => call(`/children/${dialog.child.id}`, { method: "PATCH", body: { displayName: form.displayName, grade: Number(form.grade) } }), "変更しました");
            }}
          >
            <ErrorBanner message={formError} />
            <Field label="表示名" error={fields.displayName}>
              {(id) => <input id={id} className={inputClass()} value={form.displayName} onChange={set("displayName")} maxLength={10} required />}
            </Field>
            <Field label="学年">
              {(id) => (
                <select id={id} className={inputClass()} value={form.grade} onChange={set("grade")}>
                  {GRADES.map((g) => <option key={g} value={g}>{g}年生</option>)}
                </select>
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>やめる</Button>
              <Button type="submit" disabled={busy}>保存する</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={dialog?.kind === "password"} onClose={() => setDialog(null)} title="パスワードの再設定">
        {dialog?.kind === "password" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => call(`/children/${dialog.child.id}/password`, { method: "PUT", body: { password: form.password } }), `${dialog.child.displayName}さんのパスワードを変更しました。ログイン中の端末はログアウトされます。`);
            }}
          >
            <p className="text-sm">{dialog.child.displayName}さん（{dialog.child.loginId}）の新しいパスワードを設定します。</p>
            <ErrorBanner message={formError} />
            <Field label="新しいパスワード" hint="6文字以上（数字だけでもOK）" error={fields.password}>
              {(id, d) => <input id={id} aria-describedby={d} className={inputClass()} value={form.password} onChange={set("password")} autoComplete="new-password" required />}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>やめる</Button>
              <Button type="submit" disabled={busy}>変更する</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={dialog?.kind === "delete"} onClose={() => setDialog(null)} title="子どもアカウントを削除しますか？">
        {dialog?.kind === "delete" && (
          <div className="space-y-4">
            <p>
              {dialog.child.displayName}さんのアカウントを削除します。ミッションの記録と動画も削除され、元に戻せません。
            </p>
            <p className="text-sm text-muted">削除したユーザID（{dialog.child.loginId}）は30日間使えません。</p>
            <ErrorBanner message={formError} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>やめる</Button>
              <Button variant="danger" disabled={busy} onClick={() => void run(() => call(`/children/${dialog.child.id}`, { method: "DELETE" }), "削除しました")}>
                削除する
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
