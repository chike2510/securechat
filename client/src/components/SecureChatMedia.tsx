import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  decryptAttachment,
  encryptAttachment,
  encryptGroupMessage,
  encryptMessage,
} from "@/lib/crypto";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileIcon,
  Loader2,
  Mic,
  Paperclip,
  Pause,
  Play,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { fallbackWaveform, normalizeWaveform } from "@/lib/waveform";

type GroupEnvelope = {
  ciphertext: string;
  iv: string;
  ownerPublicKey: string;
} | null;

export type MediaConversation = {
  conversationId: number;
  kind?: "direct" | "group";
  groupKeyVersion?: string;
  peer?: { publicKey?: string | null; name?: string | null } | null;
  groupKeyEnvelope?: GroupEnvelope;
  groupKeyEnvelopes?: Record<string, GroupEnvelope>;
};

type Attachment = {
  id: number;
  name: string;
  mediaType: string;
  size: number;
  ciphertextPath: string;
  iv: string;
  kind: "file" | "voice";
  waveform?: number[];
};

function byteLabel(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number, empty = "--:--") {
  if (!Number.isFinite(seconds) || seconds < 0) return empty;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function base64FromBytes(bytes: Uint8Array) {
  let result = "";
  for (let index = 0; index < bytes.length; index += 1)
    result += String.fromCharCode(bytes[index] ?? 0);
  return btoa(result);
}

function encryptedText(conversation: MediaConversation, text: string) {
  return conversation.kind === "group"
    ? encryptGroupMessage(
        conversation.conversationId,
        text,
        conversation.groupKeyEnvelope,
        conversation.groupKeyVersion
      )
    : encryptMessage(
        conversation.conversationId,
        text,
        conversation.peer?.publicKey ?? ""
      );
}

export function EncryptedMediaComposer({
  conversation,
  onSent,
}: {
  conversation: MediaConversation;
  onSent: () => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const animationFrame = useRef<number | null>(null);
  const levels = useRef<number[]>([]);
  const [recording, setRecording] = useState(false);
  const upload = trpc.secureChat.uploadEncryptedAttachment.useMutation();
  const send = trpc.secureChat.sendEncryptedMessage.useMutation();

  const shareFile = async (
    file: File,
    kind: "file" | "voice",
    waveform?: number[]
  ) => {
    if (file.size > 3 * 1024 * 1024)
      return toast.error("Files and voice notes must be 3 MB or smaller");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const encrypted = await encryptAttachment(
        conversation.conversationId,
        conversation.peer?.publicKey ?? "",
        bytes,
        conversation.kind === "group" ? conversation.groupKeyEnvelope : null,
        conversation.groupKeyVersion
      );
      const attachment = await upload.mutateAsync({
        conversationId: conversation.conversationId,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        name: file.name,
        mediaType: file.type || "application/octet-stream",
        size: file.size,
        kind,
        waveform,
      });
      const payload = await encryptedText(
        conversation,
        kind === "voice" ? "Shared a voice note" : `Shared ${file.name}`
      );
      await send.mutateAsync({
        conversationId: conversation.conversationId,
        ...payload,
        attachment,
        keyVersion:
          conversation.kind === "group"
            ? conversation.groupKeyVersion
            : undefined,
      });
      await onSent();
    } catch {
      toast.error("The encrypted attachment could not be sent");
    }
  };

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void shareFile(file, "file");
  };

  const sampleVolume = () => {
    const currentAnalyser = analyser.current;
    if (!currentAnalyser) return;
    const data = new Uint8Array(currentAnalyser.fftSize);
    currentAnalyser.getByteTimeDomainData(data);
    let total = 0;
    for (let index = 0; index < data.length; index += 1) {
      const value = data[index] ?? 128;
      const centered = (value - 128) / 128;
      total += centered * centered;
    }
    const rms = Math.sqrt(total / data.length);
    levels.current.push(Math.max(0.08, Math.min(1, rms * 4.5)));
    animationFrame.current = requestAnimationFrame(sampleVolume);
  };

  const stopMeter = () => {
    if (animationFrame.current !== null)
      cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
    analyser.current = null;
    const context = audioContext.current;
    audioContext.current = null;
    if (context) void context.close();
  };

  const toggleRecording = async () => {
    if (recording) {
      recorder.current?.stop();
      stopMeter();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const instance = new MediaRecorder(stream);
      chunks.current = [];
      levels.current = [];
      instance.ondataavailable = event => {
        if (event.data.size) chunks.current.push(event.data);
      };
      instance.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);
        stopMeter();
        const type = instance.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        const waveform = normalizeWaveform(
          levels.current.length
            ? levels.current
            : [0.16, 0.24, 0.2, 0.34, 0.28, 0.46, 0.36, 0.22]
        );
        if (blob.size)
          void shareFile(
            new File(
              [blob],
              `Voice note ${new Date().toLocaleTimeString()}.webm`,
              { type }
            ),
            "voice",
            waveform
          );
      };
      recorder.current = instance;
      try {
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const meter = context.createAnalyser();
        meter.fftSize = 256;
        source.connect(meter);
        audioContext.current = context;
        analyser.current = meter;
      } catch {
        // Recording still works if the browser does not expose AudioContext.
      }
      instance.start();
      setRecording(true);
      sampleVolume();
    } catch {
      toast.error("Microphone access is needed to record a voice note");
    }
  };

  const busy = upload.isPending || send.isPending;
  return (
    <div className="flex min-w-0 shrink-0 gap-1">
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={selectFile}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-12 w-9 shrink-0 rounded-full bg-transparent text-current shadow-none hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Attach encrypted file"
        onClick={() => fileInput.current?.click()}
        disabled={busy}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
      <Button
        variant={recording ? "default" : "ghost"}
        size="icon"
        className={`h-12 w-9 shrink-0 rounded-full bg-transparent text-current shadow-none hover:bg-black/5 dark:hover:bg-white/10 ${recording ? "bg-[#ff4f87] text-white hover:bg-[#e24275]" : ""}`}
        aria-label={recording ? "Stop voice note" : "Record voice note"}
        onClick={() => void toggleRecording()}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : recording ? (
          <Square className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function voiceWaveform(attachment: Attachment) {
  const stored = normalizeWaveform(attachment.waveform);
  return stored.length ? stored : fallbackWaveform(attachment.id);
}

export function EncryptedAttachmentCard({
  conversation,
  attachment,
  keyVersion,
}: {
  conversation: MediaConversation;
  attachment: Attachment;
  keyVersion?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [imageOpen, setImageOpen] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const download = trpc.secureChat.downloadEncryptedAttachment.useQuery(
    {
      conversationId: conversation.conversationId,
      attachmentId: attachment.id,
    },
    { enabled: false }
  );
  const voice = attachment.kind === "voice";
  const image =
    attachment.kind === "file" &&
    attachment.mediaType.toLowerCase().startsWith("image/");
  const bars = voice ? voiceWaveform(attachment) : [];

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url]
  );

  const retrieve = async () => {
    if (loading) return null;
    setLoading(true);
    try {
      const result = await download.refetch();
      if (!result.data) throw new Error("Attachment not found");
      const binary = atob(result.data.ciphertext);
      const bytes = Uint8Array.from(binary, character =>
        character.charCodeAt(0)
      );
      const plain = await decryptAttachment(
        conversation.conversationId,
        conversation.peer?.publicKey ?? "",
        base64FromBytes(bytes),
        attachment.iv,
        conversation.kind === "group"
          ? (conversation.groupKeyEnvelopes?.[keyVersion ?? "v1"] ??
              conversation.groupKeyEnvelope)
          : null,
        keyVersion
      );
      const objectUrl = URL.createObjectURL(
        new Blob([Uint8Array.from(plain)], { type: attachment.mediaType })
      );
      setUrl(objectUrl);
      return objectUrl;
    } catch {
      toast.error(
        "This encrypted attachment could not be opened on this device"
      );
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((image || voice) && !url) void retrieve();
  }, [attachment.id, image, voice]);

  useEffect(() => {
    if (!imageOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImageOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [imageOpen]);

  const save = async () => {
    const objectUrl = url ?? (await retrieve());
    if (!objectUrl) return;
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = attachment.name;
    link.click();
  };

  const togglePlayback = async () => {
    const objectUrl = url ?? (await retrieve());
    if (!objectUrl || !audio.current) return;
    if (audio.current.paused) {
      await audio.current.play();
      setPlaying(true);
    } else {
      audio.current.pause();
      setPlaying(false);
    }
  };

  if (image)
    return (
      <>
        <div className="relative mt-2 max-w-full overflow-hidden rounded-[22px] bg-black/10 shadow-sm ring-1 ring-black/10">
          <button
            type="button"
            className="block w-full max-w-full text-left"
            onClick={() => {
              if (url) setImageOpen(true);
              else void retrieve();
            }}
            aria-label={
              url
                ? `View ${attachment.name} full size`
                : `Load ${attachment.name}`
            }
          >
            {url ? (
              <img
                src={url}
                alt={attachment.name}
                className="block max-h-80 w-full max-w-full object-cover md:max-h-96"
              />
            ) : (
              <div className="grid min-h-36 w-full place-items-center bg-black/5 px-6 py-8 text-center text-xs text-current/60">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span>Tap to load image</span>
                )}
              </div>
            )}
          </button>
          {url && (
            <Button
              onClick={() => void save()}
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 rounded-full bg-black/45 text-white hover:bg-black/65"
              aria-label={`Download ${attachment.name}`}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {imageOpen && url && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`${attachment.name} full size`}
            onClick={() => setImageOpen(false)}
          >
            <div
              className="relative flex max-h-full max-w-full flex-col items-center gap-3"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex w-full items-center justify-end gap-2 text-white">
                <Button
                  onClick={() => void save()}
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
                  aria-label={`Download ${attachment.name}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setImageOpen(false)}
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
                  aria-label="Close image"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <img
                src={url}
                alt={attachment.name}
                className="max-h-[calc(100vh-6rem)] max-w-full rounded-2xl object-contain"
              />
            </div>
          </div>
        )}
      </>
    );

  if (voice)
    return (
      <div className="mt-2 max-w-full overflow-hidden rounded-[20px] border border-[#82cfc3]/80 bg-[#c8f7f1] p-2.5 shadow-sm dark:border-[#3e746f] dark:bg-[#21434a]">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button
            onClick={() => void togglePlayback()}
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-[#1e3c48] text-white hover:bg-[#295666]"
            aria-label={playing ? "Pause voice note" : "Play voice note"}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="ml-0.5 h-4 w-4" />
            )}
          </Button>
          <div className="min-w-0 flex-1">
            <div
              className="flex h-8 min-w-0 items-center gap-1 overflow-hidden rounded-full bg-white/80 px-2.5 ring-1 ring-[#82cfc3]/70"
              aria-label="Voice note waveform"
            >
              {bars.map((level, index) => (
                <span
                  key={`${attachment.id}-${index}`}
                  className={`min-w-0 flex-1 rounded-full transition-colors ${progress * bars.length > index ? "bg-[#d77d9e]" : "bg-[#79aaa5]"}`}
                  style={{ height: `${Math.max(5, Math.round(level * 25))}px` }}
                />
              ))}
            </div>
            <div className="mt-1 flex min-w-0 items-center justify-between gap-2 px-1 font-mono text-[9px] uppercase tracking-wider text-[#6e526c]/75 dark:text-white/55">
              <span className="truncate">
                {playing ? "Playing" : "Voice note"}
              </span>
              <span className="shrink-0">
                {formatDuration(currentTime, "0:00")} /{" "}
                {formatDuration(duration)}
              </span>
            </div>
          </div>
          <Button
            onClick={() => void save()}
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-[#1e3c48] hover:bg-[#1e3c48]/10"
            aria-label={`Download ${attachment.name}`}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
        <audio
          ref={audio}
          src={url ?? undefined}
          preload="metadata"
          onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
          onTimeUpdate={event => {
            const current = event.currentTarget;
            setCurrentTime(current.currentTime);
            setProgress(
              current.duration ? current.currentTime / current.duration : 0
            );
          }}
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(0);
            setProgress(0);
          }}
          className="hidden"
        />
      </div>
    );

  return (
    <div className="mt-2 flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-2xl border border-current/15 bg-black/5 p-2.5 shadow-sm">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/5">
        <FileIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{attachment.name}</p>
        <p className="font-mono text-[9px] uppercase tracking-wider opacity-60">
          {byteLabel(attachment.size)}
        </p>
      </div>
      <Button
        onClick={() => void save()}
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        aria-label={`Download ${attachment.name}`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
