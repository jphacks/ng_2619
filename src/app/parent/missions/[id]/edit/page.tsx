"use client";

// P-03 ミッション編集（F-MIS-03、基本設計書 4.6）
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { MissionDetail } from "@/lib/types";
import { ErrorBanner, Loading, PageTitle } from "@/components/ui";
import { emptyMission, MissionForm, type MissionFormValues } from "@/components/parent/MissionForm";

export default function EditMissionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error: loadError, loading } = useApi<MissionDetail>(`/missions/${id}`);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(v: MissionFormValues) {
    if (!data) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const body: Record<string, unknown> = { title: v.title, description: v.description || null, dueDate: v.dueDate || null };
      if (data.editable.verifyMethod) body.verifyMethod = v.verifyMethod;
      await api(`/missions/${id}`, { method: "PATCH", body });
      router.push("/parent/missions");
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fields ?? {});
      }
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (loadError || !data) return <ErrorBanner message={loadError?.message ?? "見つかりません"} />;
  const initial: MissionFormValues = {
    ...emptyMission,
    title: data.title,
    description: data.description ?? "",
    categoryCode: data.categoryCode,
    targetValue: data.targetValue?.toString() ?? "",
    targetUnit: data.targetUnit ?? "",
    verifyMethod: data.verifyMethod,
    dueDate: data.dueDate ?? "",
  };
  return (
    <>
      <PageTitle>ミッションを編集</PageTitle>
      <MissionForm mode="edit" initial={initial} editable={data.editable} error={error} fieldErrors={fieldErrors} busy={busy} onSubmit={submit} />
    </>
  );
}
