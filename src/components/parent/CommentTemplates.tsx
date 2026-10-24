"use client";

// 褒めコメントの定型文（F-APV-07）
import { useApi } from "@/lib/hooks";
import type { Masters } from "@/lib/types";

export function CommentTemplates({ onPick }: { onPick: (text: string) => void }) {
  const { data } = useApi<Masters>("/masters");
  if (!data || data.commentTemplates.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="定型文">
      {data.commentTemplates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t.text)}
          className="min-h-10 rounded-full bg-parent-soft px-3 text-sm font-bold text-parent-primary-dark"
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
