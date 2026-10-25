"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS } from "@/lib/constants";
import { Button, ErrorBanner } from "@/components/ui";

const RECORDING_TYPES = ["video/mp4", "video/webm;codecs=vp8,opus", "video/webm"];

export function CameraRecorder({ onCapture, onCancel }: { onCapture: (file: File) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);
  const capture = useRef(onCapture);
  const [phase, setPhase] = useState<"opening" | "live" | "recording" | "stopping" | "error">("opening");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [silent, setSilent] = useState(false);

  useEffect(() => { capture.current = onCapture; }, [onCapture]);

  const clearTimers = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (limitTimer.current) clearTimeout(limitTimer.current);
    timer.current = null;
    limitTimer.current = null;
  }, []);

  const releaseCamera = useCallback(() => {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    if (recorder.current?.state !== "recording") return;
    clearTimers();
    setPhase("stopping");
    recorder.current.stop();
  }, [clearTimers]);

  useEffect(() => {
    active.current = true;
    let cancelled = false;
    async function open() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("カメラを つかうには localhost または https で ひらいてね");
        setPhase("error");
        return;
      }
      if (typeof MediaRecorder === "undefined" || !RECORDING_TYPES.some(type => MediaRecorder.isTypeSupported(type))) {
        setError("この ブラウザでは とれないよ。『どうがを えらぶ』を つかってね");
        setPhase("error");
        return;
      }
      const constraints = { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } };
      try {
        let media: MediaStream;
        try {
          media = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: true });
        } catch (cause) {
          // マイクのないPCでも、映像だけの撮影を利用できるようにする。
          if ((cause as DOMException).name !== "NotFoundError") throw cause;
          media = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
        }
        if (cancelled) { media.getTracks().forEach(track => track.stop()); return; }
        stream.current = media;
        setSilent(media.getAudioTracks().length === 0);
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
        if (cancelled) return;
        setPhase("live");
      } catch (cause) {
        if (cancelled) return;
        releaseCamera();
        const name = (cause as DOMException).name;
        setError(name === "NotAllowedError" ? "カメラと マイクの りようを ブラウザで きょかしてね"
          : name === "NotFoundError" ? "カメラが みつからないよ。つながっているか かくにんしてね"
            : "カメラを ひらけなかったよ。ほかの アプリで つかっていたら とじてね");
        setPhase("error");
      }
    }
    void open();
    const onHidden = () => { if (document.hidden) stop(); };
    const onPageHide = () => {
      active.current = false;
      clearTimers();
      if (recorder.current?.state === "recording") recorder.current.stop();
      releaseCamera();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      cancelled = true;
      active.current = false;
      clearTimers();
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      if (recorder.current?.state === "recording") recorder.current.stop();
      releaseCamera();
    };
  }, [clearTimers, releaseCamera, stop]);

  function start() {
    if (!stream.current || recorder.current) return;
    const chunks: Blob[] = [];
    let bytes = 0;
    let failed = false;
    try {
      const mimeType = RECORDING_TYPES.find(type => MediaRecorder.isTypeSupported(type))!;
      const recording = new MediaRecorder(stream.current, { mimeType, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 96_000 });
      recorder.current = recording;
      recording.ondataavailable = event => {
        if (!active.current || !event.data.size) return;
        chunks.push(event.data);
        bytes += event.data.size;
        if (bytes > VIDEO_MAX_BYTES) { failed = true; setError("どうがが おおきすぎるよ。みじかく とりなおしてね"); stop(); }
      };
      recording.onerror = () => {
        failed = true;
        if (active.current) { setError("とれなかったよ。もういちど やってみてね"); setPhase("error"); }
        clearTimers();
        releaseCamera();
      };
      recording.onstop = () => {
        clearTimers();
        releaseCamera();
        if (!active.current) return;
        if (failed || bytes === 0) {
          setPhase("error");
          if (!failed) setError("どうがが とれていないよ。もういちど やってみてね");
          return;
        }
        const type = recording.mimeType.split(";")[0];
        capture.current(new File(chunks, `mission-${Date.now()}.${type === "video/mp4" ? "mp4" : "webm"}`, { type }));
      };
      recording.start(250);
      setPhase("recording");
      const started = performance.now();
      timer.current = setInterval(() => setElapsed(Math.min(VIDEO_MAX_SECONDS, Math.floor((performance.now() - started) / 1000))), 250);
      limitTimer.current = setTimeout(stop, VIDEO_MAX_SECONDS * 1000);
    } catch {
      clearTimers();
      releaseCamera();
      setError("とれなかったよ。『どうがを えらぶ』も つかえるよ");
      setPhase("error");
    }
  }

  return (
    <section className="space-y-3" aria-label="どうがの さつえい">
      <ErrorBanner message={error} />
      {phase !== "error" && <video ref={video} autoPlay muted playsInline controls={phase === "live"} aria-label="カメラの えいぞう" className="w-full rounded-3xl bg-black" />}
      {phase === "opening" && <p role="status">カメラを ひらいているよ。『きょか』を おしてね</p>}
      {silent && <p className="text-base text-muted">おとは なしで とるよ</p>}
      {phase === "live" && <Button tone="kid" block onClick={start}>🔴 とりはじめる</Button>}
      {phase === "recording" && <>
        <p role="timer" className="text-center text-xl font-bold">🔴 {elapsed} / {VIDEO_MAX_SECONDS}びょう</p>
        <Button tone="kid" block onClick={stop}>⏹ とりおわる</Button>
      </>}
      {phase === "stopping" && <p role="status">どうがを じゅんびしているよ…</p>}
      <p className="text-center text-base text-muted">60びょうで じどうで とまるよ。とりおわったら かくにんして おくってね</p>
      <Button tone="kid" variant="ghost" block onClick={onCancel}>やめて もどる</Button>
    </section>
  );
}
