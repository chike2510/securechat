import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import AuthLanding from "@/pages/AuthLanding";
import { trpc } from "@/lib/trpc";
import { decryptMessage, encryptMessage, ensureIdentity, isEncryptedPayload } from "@/lib/crypto";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, ChevronLeft, LockKeyhole, MessageCircle, MoreHorizontal, Paperclip, Search, Send, ShieldCheck, X } from "lucide-react";
import { io } from "socket.io-client";

const accents = ["#c8f7f1", "#ffd7e5", "#d9d4ff", "#ffe1bd"];

function initials(name?: string | null) {
  return (name ?? "U").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function timeLabel(value?: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [showSecurity, setShowSecurity] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [decrypted, setDecrypted] = useState<Record<number, string>>({});
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const utils = trpc.useUtils();
  const identityMutation = trpc.secureChat.setPublicKey.useMutation();
  const openConversationMutation = trpc.secureChat.openConversation.useMutation();
  const sendMutation = trpc.secureChat.sendEncryptedMessage.useMutation();
  const statusMutation = trpc.secureChat.updateMessageStatus.useMutation();
  const presenceMutation = trpc.secureChat.presence.useMutation();
  const { data: conversations = [], isLoading: conversationsLoading, error: conversationsError } = trpc.secureChat.conversations.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 5000 });
  const { data: results = [] } = trpc.secureChat.searchUsers.useQuery({ query: search }, { enabled: isAuthenticated && search.length > 1 });
  const { data: messages = [], isLoading: messagesLoading, error: messagesError } = trpc.secureChat.messages.useQuery({ conversationId: selectedConversation ?? 0 }, { enabled: Boolean(selectedConversation), refetchInterval: 3500 });
  const { data: notifications = [], error: notificationsError } = trpc.secureChat.notifications.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 7000 });
  const readNotificationMutation = trpc.secureChat.readNotification.useMutation();

  const activeConversation = conversations.find(item => item.conversationId === selectedConversation);
  const unreadCount = notifications.filter(item => !item.isRead).length;

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    ensureIdentity().then(publicKey => identityMutation.mutate({ publicKey })).catch(() => toast.error("Could not initialize local encryption keys"));
    const socket = io(window.location.origin, { path: "/api/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("message-created", () => { utils.secureChat.messages.invalidate(); utils.secureChat.conversations.invalidate(); utils.secureChat.notifications.invalidate(); });
    socket.on("presence-changed", () => utils.secureChat.conversations.invalidate());
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    presenceMutation.mutate({ online: true });
    return () => { presenceMutation.mutate({ online: false }); };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!selectedConversation || !messages.length) return;
    messages.filter(message => message.senderId !== user?.id && !message.deliveredAt).forEach(message => {
      statusMutation.mutate({ messageId: message.id, status: "delivered" });
    });
    messages.filter(message => message.senderId !== user?.id && !message.readAt).forEach(message => {
      statusMutation.mutate({ messageId: message.id, status: "read" });
    });
  }, [selectedConversation, messages, user?.id]);

  useEffect(() => {
    if (!selectedConversation || !socketRef.current) return;
    socketRef.current.emit("join-conversation", selectedConversation);
    return () => { socketRef.current?.emit("leave-conversation", selectedConversation); };
  }, [selectedConversation]);

  useEffect(() => {
    if (!selectedConversation || !messages.length) return;
    let cancelled = false;
    Promise.all(messages.map(async message => {
      try { return [message.id, await decryptMessage(selectedConversation, activeConversation?.peer?.publicKey || "", message.ciphertext, message.iv)] as const; }
      catch { return [message.id, "Unable to decrypt on this device"] as const; }
    })).then(items => { if (!cancelled) setDecrypted(previous => ({ ...previous, ...Object.fromEntries(items) })); });
    return () => { cancelled = true; };
  }, [selectedConversation, messages]);

  const chooseUser = async (userId: number) => {
    try {
      const id = await openConversationMutation.mutateAsync({ userId });
      setSelectedConversation(id);
      setSearch("");
      setMobileListOpen(false);
    } catch { toast.error("Could not open this conversation"); }
  };

  const sendMessage = async () => {
    if (!draft.trim() || !selectedConversation || sendMutation.isPending) return;
    const plaintext = draft.trim();
    setDraft("");
    try {
      const payload = await encryptMessage(selectedConversation, activeConversation?.peer?.publicKey || "", plaintext);
      const result = await sendMutation.mutateAsync({ conversationId: selectedConversation, ...payload });
      socketRef.current?.emit("message-created", { conversationId: selectedConversation, messageId: result.messageId });
      await utils.secureChat.messages.invalidate({ conversationId: selectedConversation });
      await utils.secureChat.conversations.invalidate();
    } catch {
      setDraft(plaintext);
      toast.error("Message was not sent. Your plaintext stayed on this device.");
    }
  };

  if (loading) return <div className="min-h-screen blueprint-bg flex items-center justify-center"><div className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500 animate-pulse">Loading SecureChat</div></div>;

  if (!isAuthenticated || !user) {
    return <AuthLanding />;
  }

  return (
    <div className="min-h-screen blueprint-bg text-[#101722] overflow-hidden">
      <header className="h-16 border-b border-slate-900/10 bg-white/85 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 relative z-20">
        <div className="flex items-center gap-4"><div className="h-9 w-9 bg-[#101722] text-white rounded-sm grid place-items-center font-mono font-bold">SC</div><div><p className="font-black tracking-tight text-lg leading-none">SecureChat</p><p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-500 mt-1">University communications / v1.0</p></div></div>
        <div className="flex items-center gap-3"><div className="hidden sm:flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500"><span className={`h-2 w-2 rounded-full ${online && socketConnected ? "bg-emerald-500" : "bg-amber-500"}`} />{online && socketConnected ? "Connected" : "Reconnecting"}</div><Button variant="ghost" size="icon" className="rounded-sm relative" aria-label="Notifications" onClick={() => setShowNotifications(value => !value)}><MessageCircle className="h-4 w-4" />{unreadCount > 0 && <span className="absolute top-1 right-1 h-2 w-2 bg-[#ff4f87] rounded-full" />}</Button><button onClick={logout} className="flex items-center gap-2 group" aria-label="Sign out"><Avatar className="h-8 w-8 rounded-sm"><AvatarFallback className="rounded-sm bg-[#c8f7f1] text-[#101722] font-mono text-xs">{initials(user.name)}</AvatarFallback></Avatar><span className="hidden md:block text-sm font-semibold group-hover:underline">{user.name ?? "University user"}</span></button></div>
      </header>

      {showNotifications && <aside className="fixed top-16 right-4 md:right-8 z-40 w-[min(360px,calc(100vw-2rem))] bg-[#101722] text-white shadow-2xl border border-white/10 p-4"><div className="flex items-center justify-between mb-3"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c8f7f1]">Signal inbox / {notifications.length}</p><button onClick={() => setShowNotifications(false)} aria-label="Close notifications"><X className="h-4 w-4 text-white/60" /></button></div>{notifications.length ? notifications.map(note => <button key={note.id} onClick={() => { readNotificationMutation.mutate({ notificationId: note.id }); setShowNotifications(false); if (note.conversationId) { setSelectedConversation(note.conversationId); setMobileListOpen(false); } }} className="w-full text-left border-t border-white/10 py-3 hover:bg-white/5"><p className="text-sm font-semibold">{note.title}</p><p className="text-xs text-white/55 mt-1">{note.body}</p><p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mt-2">{timeLabel(note.createdAt)} {note.isRead ? "· read" : "· new"}</p></button>) : <p className="text-sm text-white/55 py-5">No new security events.</p>}</aside>}
      {(conversationsError || messagesError || notificationsError) && <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#101722] text-white px-4 py-3 shadow-xl border border-[#ff4f87]/50 flex items-center gap-3 text-sm"><ShieldCheck className="h-4 w-4 text-[#ff4f87]" /><span>{conversationsError?.message || messagesError?.message || notificationsError?.message || "Secure data could not be loaded."}</span><button className="ml-2 text-white/60 hover:text-white" onClick={() => window.location.reload()} aria-label="Retry secure connection">Retry</button></div>}
      <main className="h-[calc(100vh-4rem)] p-3 md:p-6 max-w-[1600px] mx-auto">
        <div className="h-full bg-white/75 border border-slate-900/15 shadow-[0_24px_80px_rgba(16,23,34,0.10)] flex overflow-hidden relative">
          <aside className={`${mobileListOpen ? "flex" : "hidden"} md:flex w-full md:w-[340px] shrink-0 border-r border-slate-900/10 flex-col bg-white/80`}>
            <div className="p-5 border-b border-slate-900/10"><div className="flex items-start justify-between mb-5"><div><p className="font-mono text-[10px] text-slate-400 uppercase tracking-[0.24em]">Inbox / 01</p><h1 className="text-3xl font-black tracking-[-0.05em] mt-1">Messages</h1></div><Badge className="rounded-sm bg-[#ffd7e5] text-[#101722] hover:bg-[#ffd7e5] font-mono text-[10px]">E2E ACTIVE</Badge></div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a university user" className="h-10 rounded-sm border-slate-900/15 bg-slate-50 pl-10 font-mono text-xs" /></div></div>
            {search.length > 1 && <div className="border-b border-slate-900/10 p-2 space-y-1">{results.length ? results.map((person, index) => <button key={person.id} onClick={() => chooseUser(person.id)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#c8f7f1]/45 transition-colors"><Avatar className="h-9 w-9 rounded-sm"><AvatarFallback className="rounded-sm" style={{ background: accents[index % accents.length] }}>{initials(person.name)}</AvatarFallback></Avatar><div className="min-w-0"><p className="text-sm font-semibold truncate">{person.name || "Unnamed user"}</p><p className="text-[11px] text-slate-500 truncate">{person.email || "Registered university account"}</p></div></button>) : <p className="p-3 text-xs text-slate-500 font-mono">No registered users found.</p>}</div>}
            <ScrollArea className="flex-1"><div className="p-2">{conversationsLoading ? <div className="p-5 font-mono text-xs text-slate-400 animate-pulse">Loading encrypted index...</div> : conversations.length ? conversations.map((item, index) => <button key={item.conversationId} onClick={() => { setSelectedConversation(item.conversationId); setMobileListOpen(false); }} className={`w-full p-3 flex items-center gap-3 text-left border-l-2 transition-all ${selectedConversation === item.conversationId ? "bg-[#c8f7f1]/40 border-[#101722]" : "border-transparent hover:bg-slate-50"}`}><Avatar className="h-11 w-11 rounded-sm"><AvatarFallback className="rounded-sm text-sm font-bold" style={{ background: accents[index % accents.length] }}>{initials(item.peer?.name)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="font-bold text-sm truncate">{item.peer?.name || "University user"}</p><span className={`h-2 w-2 rounded-full shrink-0 ${item.peer?.isOnline ? "bg-emerald-500" : "bg-slate-300"}`} /></div><p className="text-xs text-slate-500 truncate mt-1">Encrypted conversation</p></div></button>) : <EmptyInbox />}</div></ScrollArea>
            <div className="p-4 border-t border-slate-900/10"><div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500"><span>Local key</span><span className="text-emerald-600">Present</span></div><div className="h-1 bg-slate-100 mt-2"><div className="h-full w-[78%] bg-[#101722]" /></div></div>
          </aside>

          <section className={`${mobileListOpen ? "hidden" : "flex"} md:flex flex-1 min-w-0 flex-col bg-[#fbfcfd]/80`}>
            {activeConversation ? <><div className="h-[76px] px-4 md:px-7 border-b border-slate-900/10 flex items-center justify-between"><div className="flex items-center gap-3 min-w-0"><Button variant="ghost" size="icon" className="md:hidden rounded-sm" onClick={() => setMobileListOpen(true)} aria-label="Back to conversations"><ChevronLeft className="h-5 w-5" /></Button><Avatar className="h-10 w-10 rounded-sm"><AvatarFallback className="rounded-sm bg-[#ffd7e5] font-bold">{initials(activeConversation.peer?.name)}</AvatarFallback></Avatar><div className="min-w-0"><h2 className="font-black tracking-tight truncate">{activeConversation.peer?.name || "University user"}</h2><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mt-1">{activeConversation.peer?.isOnline ? "Online now" : `Last seen ${timeLabel(activeConversation.peer?.lastSeenAt)}`}</p></div></div><div className="flex items-center gap-2"><Button variant="outline" className="rounded-sm h-9 font-mono text-[10px] uppercase tracking-wider" onClick={() => setShowSecurity(value => !value)}><LockKeyhole className="h-3.5 w-3.5 mr-2" />Security view</Button><Button variant="ghost" size="icon" className="rounded-sm" aria-label="More conversation options"><MoreHorizontal className="h-4 w-4" /></Button></div></div>
              <ScrollArea className="flex-1"><div className="max-w-3xl mx-auto w-full p-4 md:p-8 space-y-5"><div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400"><div className="h-px bg-slate-900/10 flex-1" />Private channel / participant verified<div className="h-px bg-slate-900/10 flex-1" /></div>{messagesLoading ? <p className="text-center font-mono text-xs text-slate-400 animate-pulse">Decrypting local message history...</p> : messages.length ? messages.map(message => { const mine = message.senderId === user.id; const text = decrypted[message.id]; return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}><div className={`px-4 py-3 rounded-sm text-sm leading-relaxed shadow-sm ${mine ? "bg-[#101722] text-white" : "bg-white border border-slate-900/10"}`}>{text || <span className="text-slate-400 font-mono text-xs">Decrypting...</span>}</div><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-slate-400">{timeLabel(message.createdAt)} {mine && (message.readAt ? <CheckCheck className="h-3 w-3 text-cyan-600" /> : message.deliveredAt ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}</div></div></div>; }) : <EmptyConversation peer={activeConversation.peer?.name} />}</div></ScrollArea>
              <div className="border-t border-slate-900/10 p-4 md:p-6 bg-white/75"><div className="max-w-3xl mx-auto"><div className="flex items-center gap-2 mb-3 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />Your message will be encrypted locally before sending</div><div className="flex gap-2 items-end"><Textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Write a private message..." className="min-h-[48px] max-h-32 resize-none rounded-sm border-slate-900/15 bg-white" /><Button variant="outline" size="icon" className="rounded-sm h-12 w-12 shrink-0" aria-label="Attach file"><Paperclip className="h-4 w-4" /></Button><Button onClick={sendMessage} disabled={!draft.trim() || sendMutation.isPending || !online} className="rounded-sm h-12 w-12 shrink-0 bg-[#101722] hover:bg-[#283342]" size="icon" aria-label="Send encrypted message">{sendMutation.isPending ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Send className="h-4 w-4" />}</Button></div><p className="mt-2 text-[10px] text-slate-400">Shift + Enter for a new line · {online ? "Delivery available" : "Waiting for connection"}</p></div></div></> : <NoActiveChat onStart={() => setMobileListOpen(true)} />}
          </section>
          {showSecurity && activeConversation && <SecurityPanel messages={messages} onClose={() => setShowSecurity(false)} />}
        </div>
      </main>
    </div>
  );
}

function Landing({ onLogin }: { onLogin: () => void }) { return <main className="min-h-screen blueprint-bg flex items-center justify-center p-6"><div className="max-w-5xl w-full grid md:grid-cols-[1.05fr_.95fr] gap-8 items-center"><div><div className="flex items-center gap-3 mb-10"><div className="h-10 w-10 bg-[#101722] text-white grid place-items-center font-mono font-bold">SC</div><span className="font-black text-xl tracking-tight">SecureChat</span></div><p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500 mb-5">Protected academic communications</p><h1 className="text-6xl md:text-8xl font-black tracking-[-0.08em] leading-[.86] max-w-3xl">Messages.<br /><span className="text-[#ff4f87]">Not</span> surveillance.</h1><p className="max-w-lg text-slate-600 mt-8 text-lg leading-relaxed">A focused prototype for private university messaging. Your message is encrypted in the browser before it travels through the network.</p><Button onClick={onLogin} className="mt-8 rounded-sm h-12 px-6 bg-[#101722] hover:bg-[#283342]">Enter SecureChat <ChevronLeft className="ml-2 rotate-180 h-4 w-4" /></Button><p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-slate-400">Registered university users only</p></div><div className="relative min-h-[390px] hidden md:block"><div className="absolute right-12 top-8 h-64 w-64 border border-[#101722]/20 rotate-12" /><div className="absolute right-24 top-20 h-64 w-64 border border-[#ff4f87]/40 -rotate-6" /><div className="absolute left-8 top-24 w-72 bg-white/90 border border-slate-900/15 shadow-xl p-5 rotate-[-4deg]"><div className="flex justify-between font-mono text-[9px] uppercase tracking-widest text-slate-400 mb-8"><span>Message payload</span><LockKeyhole className="h-3 w-3" /></div><div className="font-mono text-xs leading-6 text-slate-500 break-all">8f3a7c2e...d9b11a<br />c2e0f08d...70aa9c<br />e2ff1a03...91bc22</div><div className="mt-8 flex items-center gap-2 text-[10px] font-mono text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" /> plaintext never stored</div></div><div className="absolute bottom-4 right-0 bg-[#c8f7f1] px-5 py-4 font-mono text-xs rotate-3">AES-GCM / local key</div></div></div></main> }
function EmptyInbox() { return <div className="p-8 text-center"><div className="h-12 w-12 border border-dashed border-slate-300 mx-auto grid place-items-center mb-4"><Search className="h-4 w-4 text-slate-400" /></div><p className="font-bold text-sm">No conversations yet</p><p className="text-xs text-slate-500 mt-2 leading-relaxed">Search for a registered university user to start a private channel.</p></div> }
function EmptyConversation({ peer }: { peer?: string | null }) { return <div className="text-center py-16"><div className="h-16 w-16 mx-auto bg-[#ffd7e5] grid place-items-center rotate-3"><LockKeyhole className="h-6 w-6" /></div><h3 className="font-black text-xl mt-6">Private channel ready</h3><p className="text-sm text-slate-500 mt-2">Say hello to {peer || "your contact"}. This channel is protected by local encryption.</p></div> }
function NoActiveChat({ onStart }: { onStart: () => void }) { return <div className="flex-1 grid place-items-center p-10"><div className="max-w-md text-center"><div className="h-20 w-20 mx-auto border border-slate-900/15 bg-[#c8f7f1] grid place-items-center rotate-[-6deg]"><MessageCircle className="h-8 w-8" /></div><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 mt-8">Secure channel matrix / idle</p><h2 className="text-4xl font-black tracking-[-0.06em] mt-2">Choose a conversation.</h2><p className="text-slate-500 mt-4 leading-relaxed">Select an existing thread or search the university directory to begin a protected exchange.</p><Button onClick={onStart} variant="outline" className="rounded-sm mt-7 md:hidden">Open conversations</Button></div></div> }
function SecurityPanel({ messages, onClose }: { messages: any[]; onClose: () => void }) { const sample = messages[0]; return <aside className="absolute inset-y-0 right-0 w-full sm:w-[360px] bg-[#101722] text-white z-30 shadow-2xl p-6 flex flex-col"><div className="flex items-start justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#c8f7f1]">Inspection / 02</p><h3 className="text-2xl font-black tracking-tight mt-2">Security view</h3></div><Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-sm" onClick={onClose} aria-label="Close security view"><X className="h-4 w-4" /></Button></div><div className="mt-8 space-y-6"><div><p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Client flow</p><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between border-b border-white/10 pb-2"><span>Plaintext</span><span className="text-[#c8f7f1]">Browser only</span></div><div className="flex justify-between border-b border-white/10 pb-2"><span>Encryption</span><span className="text-[#c8f7f1]">AES-GCM</span></div><div className="flex justify-between border-b border-white/10 pb-2"><span>Server payload</span><span className="text-[#c8f7f1]">Ciphertext</span></div><div className="flex justify-between border-b border-white/10 pb-2"><span>Decryption</span><span className="text-[#c8f7f1]">Recipient browser</span></div></div></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Stored payload sample</p><div className="mt-3 bg-white/5 border border-white/10 p-3 font-mono text-[10px] leading-5 break-all text-[#c8f7f1]">{sample?.ciphertext || "No ciphertext stored yet"}</div><p className="text-[11px] text-white/50 mt-2">The backend persists this payload, IV, timestamps, and delivery metadata—not readable content.</p></div></div><div className="mt-auto border-t border-white/10 pt-4 text-[11px] text-white/50 leading-relaxed">Academic prototype boundary: this interface demonstrates client-side authenticated encryption and access control. It is not a substitute for an independently audited production messenger.</div></aside> }
