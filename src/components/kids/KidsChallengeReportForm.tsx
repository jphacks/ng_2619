"use client";

// C-03 達成報告（F-CHL-03〜05。基本設計書 3.4 の画面状態）
import { useEffect, useRef, useState } from "react";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, type VideoContentType } from "@/lib/constants";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { KidsChallengeDetail, Masters, SubmissionCreated, VideoUploadUrlResponse } from "@/lib/types";
import { Button, ErrorBanner, Loading } from "@/components/ui";
import { assetUrl } from "@/components/Avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ParentMessage from "./ParentMessage";

type Phase = "choose" | "checking" | "ready" | "uploading" | "sending" | "retry";

/** 一部の Android では file.type が空になるため、拡張子からも判断する */
function contentTypeOf(file: File): VideoContentType | null {
  if (file.type === "video/mp4" || file.type === "video/quicktime") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "mp4" || ext === "m4v") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  return null;
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("metadata"));
    };
    v.src = url;
  });
}

/** fetch ではアップロードの進み具合が取れないため XHR を使う（1.6.2） */
function upload(target: VideoUploadUrlResponse, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.uploadUrl);
    for (const [k, v] of Object.entries(target.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

type Props = {
  challenge: KidsChallengeDetail;
};
export default function KidsChallengeReportForm({ challenge }: Props) {
  const router = useRouter();
  const { data: masters } = useApi<Masters>("/masters");
  const [phase, setPhase] = useState<Phase>("choose");
  const [method, setMethod] = useState<"VIDEO" | "VISUAL" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stamp, setStamp] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // アップロード中に画面を離れようとしたら確認する
  useEffect(() => {
    if (phase !== "uploading" && phase !== "sending") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(null);
    setPhase("checking");
    if (!contentTypeOf(f)) {
      setError("この どうがは おくれないよ。ほかの どうがを えらんでね");
      setPhase("choose");
      return;
    }
    if (f.size > VIDEO_MAX_BYTES) {
      setError("どうがが おおきすぎるよ。みじかく とりなおしてね（100MBまで）");
      setPhase("choose");
      return;
    }
    let duration: number;
    try {
      duration = await readDuration(f);
    } catch {
      duration = 1; // 長さが読めない形式でも送れるようにする（サーバ側で60秒に打ち切る）
    }
    if (Number.isFinite(duration) && duration > VIDEO_MAX_SECONDS + 0.5) {
      setError("どうがが ながすぎるよ。60びょう までに してね");
      setPhase("choose");
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setMethod("VIDEO");
    setPhase("ready");
  }

  async function send() {
    if (!challenge || !method) return;
    setError(null);
    try {
      let videoId: string | undefined;
      if (method === "VIDEO" && file) {
        setPhase("uploading");
        setProgress(0);
        let duration = 1;
        try {
          duration = await readDuration(file);
        } catch {
          /* 上で確認済み */
        }
        const target = await api<VideoUploadUrlResponse>(`/kids/challenges/${challenge.id}/video-upload-url`, {
          method: "POST",
          body: { contentType: contentTypeOf(file), sizeBytes: file.size, durationSec: Number.isFinite(duration) && duration > 0 ? duration : 1 },
        });
        try {
          await upload(target, file, setProgress);
        } catch {
          setError("おくれなかったよ。でんぱの いいところで もういちど おしてね");
          setPhase("retry");
          return;
        }
        videoId = target.videoId;
      }
      setPhase("sending");
      await api<SubmissionCreated>(`/kids/challenges/${challenge.id}/submissions`, {
        method: "POST",
        body: { method, videoId, stampCode: stamp },
      });
      router.replace(`/kids/challenges/${challenge.id}/done`);
    } catch (e) {
      if (e instanceof ApiError && (e.reason === "ALREADY_APPROVED" || e.reason === "ALREADY_PENDING" || e.code === "CHALLENGE_EXPIRED")) {
        setFinished(e.message);
        return;
      }
      setError(e instanceof ApiError ? e.message : "うまく いかなかったよ。もういちど おしてね");
      setPhase("retry");
    }
  }

  if (finished) {
    return (
      <div className="space-y-5 text-center">
        <p className="rounded-3xl bg-kid-soft p-6 text-2xl font-bold">{finished}</p>
        <Link href="/kids" className="inline-flex min-h-14 items-center rounded-2xl bg-kid-primary px-6 text-xl font-bold text-white">ホームへ もどる</Link>
      </div>
    );
  }

  const allowVideo = challenge.verifyMethod !== "VISUAL";
  const allowVisual = challenge.verifyMethod !== "VIDEO";
  const busy = phase === "checking" || phase === "uploading" || phase === "sending";

  return (
    <div className="space-y-5">
      {/* <Link href={`/kids/challenges/${challenge.id}`} className="inline-flex min-h-12 items-center text-lg font-bold text-kid-primary">‹ もどる</Link> */}
      <h1 className="text-2xl font-bold">「{challenge.title}」を ほうこくしよう</h1>
      <ErrorBanner message={error} />

      {(phase === "choose" || phase === "checking") && (
        <div className="grid gap-3">
          {allowVideo && (
            <>
              <Button tone="kid" block disabled={busy} onClick={() => cameraInput.current?.click()}>🎥 どうがを とる</Button>
              <Button tone="kid" variant="secondary" block disabled={busy} onClick={() => fileInput.current?.click()}>📁 どうがを えらぶ</Button>
              <p className="text-center text-base text-muted">みじかく とろう（30びょう くらい）。Wi-Fiで おくると はやいよ</p>
            </>
          )}
          {allowVisual && (
            <Button
              tone="kid"
              variant={allowVideo ? "secondary" : "primary"}
              block
              disabled={busy}
              onClick={() => {
                setMethod("VISUAL");
                setPhase("ready");
              }}
            >
              👀 おうちのひとに みてもらいたい！
            </Button>
          )}
          {/* capture 属性は一部の Android で無視されるため、選ぶボタンも用意している（RK-04） */}
          <input ref={cameraInput} type="file" accept="video/*" capture="environment" className="hidden" onChange={onPick} />
          <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/*" className="hidden" onChange={onPick} />
          {phase === "checking" && <Loading label="どうがを かくにんちゅう…" />}
        </div>
      )}

      {phase !== "choose" && phase !== "checking" && (
        <div className="space-y-5">
          {method === "VIDEO" && previewUrl && <video src={previewUrl} controls playsInline className="w-full rounded-3xl bg-black" />}

          {masters && masters.stamps.length > 0 && (
            <div>
              <ParentMessage />
              <p className="mb-2 text-lg font-bold">ひとことスタンプ（えらばなくても いいよ）</p>
              <div className="grid grid-cols-2 gap-2">
                {masters.stamps.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    aria-pressed={stamp === s.code}
                    disabled={busy}
                    onClick={() => setStamp((cur) => (cur === s.code ? null : s.code))}
                    className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 text-lg font-bold ${stamp === s.code ? "border-kid-primary bg-kid-soft" : "border-line bg-white"}`}
                  >
                    <img src={assetUrl(s.iconPath)} alt="" className="h-8 w-8" />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === "uploading" && (
            <div className="space-y-2" role="status">
              <p className="text-lg font-bold">おくっているよ… {progress}%</p>
              <div className="h-5 overflow-hidden rounded-full bg-kid-soft">
                <div className="h-full bg-kid-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <Button tone="kid" block disabled={busy} onClick={send}>
            {phase === "retry" ? "もういちど おくる" : phase === "sending" || phase === "uploading" ? "おくっているよ…" : "おくる"}
          </Button>
          {!busy && (
            <Button
              tone="kid"
              variant="ghost"
              block
              onClick={() => {
                setPhase("choose");
                setMethod(null);
                setFile(null);
                setPreviewUrl(null);
                setError(null);
              }}
            >
              もどる
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
