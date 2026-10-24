"use client";

// 共通UI部品。tone="kid" で子ども用のトークン（大きい文字・広いタップ領域）を使う。

import Link from "next/link";
import { useEffect, useId, useRef } from "react";

type Tone = "parent" | "kid";
type Variant = "primary" | "secondary" | "danger" | "ghost";

function buttonClass(tone: Tone, variant: Variant, block?: boolean) {
  const size = tone === "kid" ? "min-h-14 px-6 text-xl rounded-2xl" : "min-h-12 px-4 text-base rounded-xl";
  const colors: Record<Variant, string> = {
    primary:
      tone === "kid"
        ? "bg-kid-primary text-white hover:bg-kid-primary-dark shadow-[0_4px_0_#14532d] active:translate-y-0.5 active:shadow-none"
        : "bg-parent-primary text-white hover:bg-parent-primary-dark",
    secondary:
      tone === "kid"
        ? "bg-white text-kid-ink border-2 border-kid-primary hover:bg-kid-soft"
        : "bg-white text-parent-primary border border-parent-primary hover:bg-parent-soft",
    danger: "bg-danger text-white hover:opacity-90",
    ghost: "bg-transparent text-muted hover:bg-black/5",
  };
  return `inline-flex items-center justify-center gap-2 font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${size} ${colors[variant]} ${block ? "w-full" : ""}`;
}

export function Button({
  tone = "parent",
  variant = "primary",
  block,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; variant?: Variant; block?: boolean }) {
  return <button type="button" className={`${buttonClass(tone, variant, block)} ${className}`} {...props} />;
}

export function LinkButton({
  tone = "parent",
  variant = "primary",
  block,
  className = "",
  href,
  children,
}: { tone?: Tone; variant?: Variant; block?: boolean; className?: string; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`${buttonClass(tone, variant, block)} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${className}`}>{children}</section>;
}

export function Field({
  label,
  hint,
  error,
  children,
  tone = "parent",
}: {
  label: string;
  hint?: string;
  error?: string;
  tone?: Tone;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={`block font-bold ${tone === "kid" ? "text-lg" : "text-sm"}`}>
        {label}
      </label>
      {children(id, describedBy)}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-bold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass = (tone: Tone = "parent", invalid?: boolean) =>
  `w-full rounded-xl border bg-white px-3 ${tone === "kid" ? "min-h-14 text-xl" : "min-h-12 text-base"} ${
    invalid ? "border-danger" : "border-line"
  } focus:border-parent-primary`;

export function ErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl bg-danger-bg p-3 text-sm font-bold text-danger">
      {message}
    </div>
  );
}

export function Loading({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border-2 border-dashed border-line p-6 text-center text-muted">{children}</div>;
}

export function Badge({ children, color = "gray" }: { children: React.ReactNode; color?: "gray" | "blue" | "green" | "orange" | "red" }) {
  const colors = {
    gray: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    orange: "bg-orange-100 text-orange-800",
    red: "bg-red-100 text-red-800",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${colors[color]}`}>{children}</span>;
}

/** モーダル。Esc と背景クリックで閉じる */
export function Modal({
  open,
  onClose,
  title,
  children,
  tone = "parent",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  tone?: Tone;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 初期フォーカスは開いたときだけ。onClose は親の再描画で変わり得る。
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>("input, textarea, button")?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90dvh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl ${tone === "kid" ? "text-lg" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={`mb-4 font-bold ${tone === "kid" ? "text-2xl" : "text-lg"}`}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function PageTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-xl font-bold">{children}</h1>
      {action}
    </div>
  );
}
