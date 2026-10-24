"use client";

// P-03 ミッション作成（F-MIS-01）。?from=<missionId> で複製（F-MIS-05）、?childId= で割り当て先を選んだ状態にする
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { ChildrenListResponse, MissionDetail } from "@/lib/types";
import { Loading, PageTitle } from "@/components/ui";
import { emptyMission, MissionForm, toCreateBody, type MissionFormValues } from "@/components/parent/MissionForm";

function NewMission() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from");
  const childId = params.get("childId");
  const { data: children } = useApi<ChildrenListResponse>("/children");
  const { data: source, loading } = useApi<MissionDetail>(from ? `/missions/${from}` : null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const initial = useMemo<MissionFormValues | null>(() => {
    if (from && !source) return null;
    if (!children) return null;
    const base: MissionFormValues = source
      ? {
          ...emptyMission,
          title: source.title,
          description: source.description ?? "",
          categoryCode: source.categoryCode,
          targetValue: source.targetValue?.toString() ?? "",
          targetUnit: source.targetUnit ?? "",
          verifyMethod: source.verifyMethod,
          childIds: source.challenges.map((c) => c.childId),
        }
      : emptyMission;
    if (childId) return { ...base, childIds: [childId] };
    if (!source && children.items.length === 1) return { ...base, childIds: [children.items[0]!.id] };
    return base;
  }, [from, source, children, childId]);

  async function submit(v: MissionFormValues) {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await api("/missions", { method: "POST", body: toCreateBody(v) });
      router.push("/parent/missions");
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fields ?? {});
      }
      setBusy(false);
    }
  }

  if ((from && loading) || !initial) return <Loading />;
  return (
    <>
      <PageTitle>{from ? "ミッションを複製" : "ミッションを作る"}</PageTitle>
      <MissionForm mode="create" initial={initial} childOptions={children?.items} error={error} fieldErrors={fieldErrors} busy={busy} onSubmit={submit} />
    </>
  );
}

export default function NewMissionPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewMission />
    </Suspense>
  );
}
