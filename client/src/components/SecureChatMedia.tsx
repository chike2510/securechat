import React from "react";
import { decryptAttachment, encryptAttachment, encryptGroupMessage, encryptMessage } from "@/lib/crypto";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Download, FileAudio, FileIcon, Loader2, Mic, Paperclip, Play, Square, Pause } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fallbackWaveform, normalizeWaveform } from "@/lib/waveform";

type GroupEnvelope = { ciphertext: string; iv: string; ownerPublicKey: string } | null;

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
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function base64FromBytes(bytes: Uint8Array) {
  let result = "";
  for (let index = 0; index < bytes.length; index += 1) result += String.fromCharCode(bytes[index] ?? 0);
  return btoa(result);
}

function encryptedText(conversation: MediaConversation, text: string) {
  return conversation.kind === "group"
    ? encryptGroupMessage(conversation.conversationId, text, conversation.groupKeyEnvelope, conversation.groupKeyVersion)
    : encryptMessage(conversation.conversationId, conversation.peer?.publicKey ?? "", text);
}

export function EncryptedMediaComposer({ conversation, onSent }: { conversation: MediaConversation; onSent: () => Promise<void> }) {
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

  const shareFile = async (file: File, kind: "file" | "voice", waveform?: number[]) => {
    if (file.size > 3 * 1024 * 1024) return toast.error("Files and voice notes must be 3 MB or smaller");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const encrypted = await encryptAttachment(conversation.conversationId, conversation.peer?.publicKey ?? "", bytes, conversation.kind === "group" ? conversation.groupKeyEnvelope : null, conversation.groupKeyVersion);
      const attachment = await upload.mutateAsync({ conversationId: conversation.conversationId, ciphertext: encrypted.ciphertext, iv: encrypted.iv, name: file.name, mediaType: file.type || "application/octet-stream", size: file.size, kind, waveform });
      const payload = await encryptedText(conversation, kind === "voice" ? "Shared a voice note" : `Shared ${file.name}`);
      await send.mutateAsync({ conversationId: conversation.conversationId, ...payload, attachment, keyVersion: conversation.kind === "group" ? conversation.groupKeyVersion : undefined });
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
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
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
      instance.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      instance.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);
        stopMeter();
        const type = instance.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        const waveform = normalizeWaveform(levels.current.length ? levels.current : [0.16, 0.24, 0.2, 0.34, 0.28, 0.46, 0.36, 0.22]);
        if (blob.size) void shareFile(new File([blob], `Voice note ${new Date().toLocaleTimeString()}.webm`, { type }), "voice", waveform);
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
  return <div className="flex gap-2 shrink-0"><input ref={fileInput} type="file" className="hidden" onChange={selectFile} /><Button variant="ghost" size="icon" className="h-12 w-10 rounded-full bg-transparent text-current shadow-none hover:bg-black/5 dark:hover:bg-white/10" aria-label="Attach encrypted file" onClick={() => fileInput.current?.click()} disabled={busy}><Paperclip className="h-4 w-4" /></Button><Button variant={recording ? "default" : "ghost"} size="icon" className={`h-12 w-10 rounded-full bg-transparent text-current shadow-none hover:bg-black/5 dark:hover:bg-white/10 ${recording ? "bg-[#ff4f87] text-white hover:bg-[#e24275]" : ""}`} aria-label={recording ? "Stop voice note" : "Record voice note"} onClick={() => void toggleRecording()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button></div>;
}

function voiceWaveform(attachment: Attachment) {
  const stored = normalizeWaveform(attachment.waveform);
  return stored.length ? stored : fallbackWaveform(attachment.id);
}

export function EncryptedAttachmentCard({ conversation, attachment, keyVersion }: { conversation: MediaConversation; attachment: Attachment; keyVersion?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const download = trpc.secureChat.downloadEncryptedAttachment.useQuery({ conversationId: conversation.conversationId, attachmentId: attachment.id }, { enabled: false });
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const retrieve = async () => {
    setLoading(true);
    try {
      const result = await download.refetch();
      if (!result.data) throw new Error("Attachment not found");
      const binary = atob(result.data.ciphertext);
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      const plain = await decryptAttachment(conversation.conversationId, conversation.peer?.publicKey ?? "", base64FromBytes(bytes), attachment.iv, conversation.kind === "group" ? conversation.groupKeyEnvelopes?.[keyVersion ?? "v1"] ?? conversation.groupKeyEnvelope : null, keyVersion);
      const objectUrl = URL.createObjectURL(new Blob([Uint8Array.from(plain)], { type: attachment.mediaType }));
      setUrl(objectUrl);
      return objectUrl;
    } catch {
      toast.error("This encrypted attachment could not be opened on this device");
      return null;
    } finally { setLoading(false); }
  };
  const save = async () => {
    const objectUrl = url ?? await retrieve();
    if (!objectUrl) return;
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = attachment.name;
    link.click();
  };
  const togglePlayback = async () => {
    const objectUrl = url ?? await retrieve();
    if (!objectUrl || !audio.current) return;
    if (audio.current.paused) {
      await audio.current.play();
      setPlaying(true);
    } else {
      audio.current.pause();
      setPlaying(false);
    }
  };
  const voice = attachment.kind === "voice";
  const bars = voice ? voiceWaveform(attachment) : [];
  return <div className={`mt-2 min-w-56 max-w-full rounded-[24px] border p-3 shadow-sm ${voice ? "border-[#d4b3c9]/70 bg-[linear-gradient(135deg,rgba(255,255,255,.94),rgba(244,232,241,.9))] dark:border-[#69536c] dark:bg-[#26333f]" : "border-current/20 bg-black/5"}`}>
    <div className="flex items-center gap-2"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#dff8f3] text-[#18333a]">{voice ? <FileAudio className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{voice ? "Voice note" : attachment.name}</p><p className="font-mono text-[9px] uppercase tracking-wider opacity-60">{voice ? "Audio message" : byteLabel(attachment.size)}</p></div>{!voice && <Button onClick={() => void save()} variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label={`Download ${attachment.name}`}>{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}</Button>}</div>
    {voice && <div className="mt-3 flex items-center gap-3"><Button onClick={() => void togglePlayback()} variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full bg-[#1e3c48] text-white hover:bg-[#295666]" aria-label={playing ? "Pause voice note" : "Play voice note"}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}</Button><div className="flex h-9 flex-1 items-center gap-[2px] overflow-hidden rounded-full bg-white/65 px-3" aria-label="Voice note volume waveform">{bars.map((level, index) => <span key={`${attachment.id}-${index}`} className="w-[3px] shrink-0 rounded-full bg-[#e78cb9] transition-opacity" style={{ height: `${Math.max(5, Math.round(level * 28))}px`, opacity: playing && progress * bars.length > index ? 1 : 0.7 }} />)}</div><Button onClick={() => void save()} variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" aria-label={`Download ${attachment.name}`}><Download className="h-3.5 w-3.5" /></Button></div>}
    {voice && <div className="mt-2 flex items-center justify-between px-1 font-mono text-[9px] uppercase tracking-wider opacity-55"><span>{playing ? "Playing" : "Voice note"}</span><span>{Math.round(progress * 100)}%</span></div>}
    {voice && <audio ref={audio} src={url ?? undefined} preload="metadata" onTimeUpdate={(event) => { const current = event.currentTarget; setProgress(current.duration ? current.currentTime / current.duration : 0); }} onEnded={() => { setPlaying(false); setProgress(0); }} className="hidden" />}
  </div>;
}
