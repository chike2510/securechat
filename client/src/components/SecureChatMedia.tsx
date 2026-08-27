import React from "react";
import { decryptAttachment, encryptAttachment, encryptGroupMessage, encryptMessage } from "@/lib/crypto";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Download, FileAudio, FileIcon, Loader2, Mic, Paperclip, Square } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
  const [recording, setRecording] = useState(false);
  const upload = trpc.secureChat.uploadEncryptedAttachment.useMutation();
  const send = trpc.secureChat.sendEncryptedMessage.useMutation();

  const shareFile = async (file: File, kind: "file" | "voice") => {
    if (file.size > 3 * 1024 * 1024) return toast.error("Files and voice notes must be 3 MB or smaller");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const encrypted = await encryptAttachment(conversation.conversationId, conversation.peer?.publicKey ?? "", bytes, conversation.kind === "group" ? conversation.groupKeyEnvelope : null, conversation.groupKeyVersion);
      const attachment = await upload.mutateAsync({ conversationId: conversation.conversationId, ciphertext: encrypted.ciphertext, iv: encrypted.iv, name: file.name, mediaType: file.type || "application/octet-stream", size: file.size, kind });
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

  const toggleRecording = async () => {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const instance = new MediaRecorder(stream);
      chunks.current = [];
      instance.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      instance.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);
        const type = instance.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        if (blob.size) void shareFile(new File([blob], `Voice note ${new Date().toLocaleTimeString()}.webm`, { type }), "voice");
      };
      recorder.current = instance;
      instance.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access is needed to record a voice note");
    }
  };

  const busy = upload.isPending || send.isPending;
  return <div className="flex gap-2 shrink-0"><input ref={fileInput} type="file" className="hidden" onChange={selectFile} /><Button variant="outline" size="icon" className="rounded-sm h-12 w-12" aria-label="Attach encrypted file" onClick={() => fileInput.current?.click()} disabled={busy}><Paperclip className="h-4 w-4" /></Button><Button variant={recording ? "default" : "outline"} size="icon" className={`rounded-sm h-12 w-12 ${recording ? "bg-[#ff4f87] hover:bg-[#e24275]" : ""}`} aria-label={recording ? "Stop voice note" : "Record voice note"} onClick={() => void toggleRecording()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button></div>;
}

export function EncryptedAttachmentCard({ conversation, attachment, keyVersion }: { conversation: MediaConversation; attachment: Attachment; keyVersion?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
  const voice = attachment.kind === "voice";
  return <div className="mt-2 rounded-sm border border-current/20 bg-black/5 p-2.5 min-w-48"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-sm bg-white/70 grid place-items-center">{voice ? <FileAudio className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="font-medium text-xs truncate">{attachment.name}</p><p className="font-mono text-[9px] uppercase tracking-wider opacity-60">{voice ? "Voice note" : byteLabel(attachment.size)}</p></div><Button onClick={() => void save()} variant="ghost" size="icon" className="h-8 w-8 rounded-sm" aria-label={`Download ${attachment.name}`}>{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}</Button></div>{voice && <div className="mt-2">{url ? <audio src={url} controls className="w-full h-8" /> : <Button variant="outline" size="sm" className="h-7 rounded-sm text-xs" onClick={() => void retrieve()} disabled={loading}>Play voice note</Button>}</div>}</div>;
}
