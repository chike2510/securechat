import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import AuthLanding from "@/pages/AuthLanding";
import { trpc } from "@/lib/trpc";
import { decryptGroupMessage, decryptMessage, encryptGroupMessage, encryptMessage, ensureIdentity } from "@/lib/crypto";
import { EncryptedAttachmentCard, EncryptedMediaComposer } from "@/components/SecureChatMedia";
import { GroupCreator, GroupMemberManager } from "@/components/SecureChatPlatformControls";
import { ProfileControls } from "@/components/FullProfileControls";
import { FriendProfileDialog } from "@/components/FriendProfileDialog";
import { SecureChatLogo } from "@/components/SecureChatLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, ChevronLeft, LockKeyhole, MessageCircle, MoreHorizontal, Moon, Pin, Search, Send, ShieldBan, ShieldCheck, Sun, UserRoundPlus, UsersRound, VolumeX, X } from "lucide-react";
import { io } from "socket.io-client";
import { useTheme } from "@/contexts/ThemeContext";

const accents = ["#c8f7f1", "#ffd7e5", "#d9d4ff", "#ffe1bd"];

function initials(name?: string | null) {
  return (name ?? "U").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function ProfileAvatar({ src, name, className, fallbackClassName, accent }: { src?: string | null; name?: string | null; className: string; fallbackClassName?: string; accent?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [src]);
  const imageSource = typeof src === "string" && src.trim() ? src.trim() : null;
  return <Avatar className={className}>{imageSource && !imageFailed ? <img src={imageSource} alt={`${name ?? "Friend"} profile photo`} className="h-full w-full object-cover" loading="eager" decoding="async" referrerPolicy="no-referrer" onLoad={() => setImageFailed(false)} onError={() => setImageFailed(true)} /> : <AvatarFallback className={fallbackClassName} style={accent ? { background: accent } : undefined}>{initials(name)}</AvatarFallback>}</Avatar>;
}

function timeLabel(value?: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const { user, loading, isAuthenticated, databaseProfileReady, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const chatReady = isAuthenticated && databaseProfileReady;
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [friendProfileUserId, setFriendProfileUserId] = useState<number | null>(null);
  const [pendingFriendIds, setPendingFriendIds] = useState<Set<number>>(() => new Set());
  const [draft, setDraft] = useState("");
  const [showSecurity, setShowSecurity] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [decrypted, setDecrypted] = useState<Record<number, string>>({});
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const utils = trpc.useUtils();
  const identityMutation = trpc.secureChat.setPublicKey.useMutation();
  const requestMutation = trpc.secureChat.requestMessage.useMutation();
  const sendMutation = trpc.secureChat.sendEncryptedMessage.useMutation();
  const statusMutation = trpc.secureChat.updateMessageStatus.useMutation();
  const presenceMutation = trpc.secureChat.presence.useMutation();
  const preferenceMutation = trpc.secureChat.setConversationPreference.useMutation();
  const blockMutation = trpc.secureChat.blockUser.useMutation();
  const { data: conversations = [], isLoading: conversationsLoading, error: conversationsError } = trpc.secureChat.conversations.useQuery(undefined, { enabled: chatReady, refetchInterval: 5000 });
  const directoryQuery = peopleOpen ? "" : search;
  const { data: results = [] } = trpc.secureChat.searchUsers.useQuery({ query: directoryQuery }, { enabled: chatReady && (peopleOpen || search.length > 1) });
  const { data: messages = [], isLoading: messagesLoading, error: messagesError } = trpc.secureChat.messages.useQuery({ conversationId: selectedConversation ?? 0 }, { enabled: chatReady && Boolean(selectedConversation), refetchInterval: 3500 });
  const { data: notifications = [], error: notificationsError } = trpc.secureChat.notifications.useQuery(undefined, { enabled: chatReady, refetchInterval: 7000 });
  const readNotificationMutation = trpc.secureChat.readNotification.useMutation();

  const activeConversation = conversations.find(item => item.conversationId === selectedConversation);
  const activePeerId = activeConversation?.kind === "direct" ? activeConversation.peer?.id : undefined;
  const { data: activePeerProfile } = trpc.secureChat.friendProfile.useQuery({ userId: activePeerId ?? 0 }, { enabled: chatReady && Boolean(activePeerId), staleTime: 30_000 });
  const unreadCount = notifications.filter(item => !item.isRead).length;
  const conversationName = activeConversation?.kind === "group" ? activeConversation.title || "Study group" : activeConversation?.peer?.name || "University user";
  const activePeerImageUrl = activePeerProfile?.profileImageUrl ?? activeConversation?.peer?.profileImageUrl;

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  useEffect(() => {
    if (!chatReady) return;
    ensureIdentity().then(publicKey => identityMutation.mutate({ publicKey })).catch(() => toast.error("Could not initialize local encryption keys"));
    const socket = io(window.location.origin, { path: "/api/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("message-created", () => { void utils.secureChat.messages.invalidate(); void utils.secureChat.conversations.invalidate(); void utils.secureChat.notifications.invalidate(); });
    socket.on("presence-changed", () => void utils.secureChat.conversations.invalidate());
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [chatReady]);

  useEffect(() => {
    if (!chatReady) return;
    presenceMutation.mutate({ online: true });
    return () => { presenceMutation.mutate({ online: false }); };
  }, [chatReady]);

  useEffect(() => {
    if (!selectedConversation || !messages.length) return;
    messages.filter(message => message.senderId !== user?.id && !message.deliveredAt).forEach(message => statusMutation.mutate({ messageId: message.id, status: "delivered" }));
    messages.filter(message => message.senderId !== user?.id && !message.readAt).forEach(message => statusMutation.mutate({ messageId: message.id, status: "read" }));
  }, [selectedConversation, messages, user?.id]);

  useEffect(() => {
    if (!selectedConversation || !socketRef.current) return;
    socketRef.current.emit("join-conversation", selectedConversation);
    return () => { socketRef.current?.emit("leave-conversation", selectedConversation); };
  }, [selectedConversation]);

  useEffect(() => {
    if (!selectedConversation || !messages.length || !activeConversation) return;
    let cancelled = false;
    Promise.all(messages.map(async message => {
      try {
        const text = activeConversation.kind === "group"
          ? await decryptGroupMessage(selectedConversation, message.ciphertext, message.iv, activeConversation.groupKeyEnvelopes?.[message.keyVersion] ?? activeConversation.groupKeyEnvelope, message.keyVersion)
          : await decryptMessage(selectedConversation, activeConversation.peer?.publicKey || "", message.ciphertext, message.iv);
        return [message.id, text] as const;
      } catch { return [message.id, "Unable to decrypt on this device"] as const; }
    })).then(items => { if (!cancelled) setDecrypted(previous => ({ ...previous, ...Object.fromEntries(items) })); });
    return () => { cancelled = true; };
  }, [selectedConversation, messages, activeConversation]);

  const refreshConversationData = async (conversationId?: number) => {
    if (conversationId) await utils.secureChat.messages.invalidate({ conversationId });
    await utils.secureChat.conversations.invalidate();
    await utils.secureChat.notifications.invalidate();
  };

  const chooseUser = async (userId: number) => {
    try {
      const result = await requestMutation.mutateAsync({ userId });
      setPendingFriendIds(current => new Set(current).add(userId));
      toast[result.alreadyPending ? "message" : "success"](result.alreadyPending ? "Friend request is already pending" : "Friend request sent");
    } catch { toast.error("This contact is unavailable"); }
  };

  const sendMessage = async () => {
    if (!draft.trim() || !selectedConversation || !activeConversation || sendMutation.isPending) return;
    const plaintext = draft.trim();
    setDraft("");
    try {
      const payload = activeConversation.kind === "group"
        ? await encryptGroupMessage(selectedConversation, plaintext, activeConversation.groupKeyEnvelope, activeConversation.groupKeyVersion)
        : await encryptMessage(selectedConversation, activeConversation.peer?.publicKey || "", plaintext);
      const result = await sendMutation.mutateAsync({ conversationId: selectedConversation, ...payload, keyVersion: activeConversation.kind === "group" ? activeConversation.groupKeyVersion : undefined });
      socketRef.current?.emit("message-created", { conversationId: selectedConversation, messageId: result.messageId });
      await refreshConversationData(selectedConversation);
    } catch {
      setDraft(plaintext);
      toast.error("Message was not sent. Your plaintext stayed on this device.");
    }
  };

  const updatePreference = async (preference: "pinned" | "muted" | "hidden", value: boolean) => {
    if (!selectedConversation) return;
    await preferenceMutation.mutateAsync({ conversationId: selectedConversation, preference, value });
    if (preference === "hidden") { setSelectedConversation(null); setMobileListOpen(true); }
    setShowActions(false);
    await utils.secureChat.conversations.invalidate();
  };

  const blockCurrentUser = async () => {
    if (!activeConversation?.peer?.id || activeConversation.kind === "group") return;
    await blockMutation.mutateAsync({ userId: activeConversation.peer.id });
    await updatePreference("hidden", true);
    toast.success("User blocked");
  };

  if (loading) return <main className="min-h-screen blueprint-bg flex items-center justify-center"><div role="status" aria-label="Loading SecureChat" className="grid place-items-center animate-pulse"><SecureChatLogo size={88} /></div></main>;
  if (!isAuthenticated || !user) return <AuthLanding />;
  if (!databaseProfileReady) return <WorkspaceDatabasePending user={user} logout={logout} />;

  return <div className="min-h-screen h-[100dvh] min-h-[100dvh] w-full max-w-full overflow-x-hidden overflow-y-hidden blueprint-bg text-[#101722]">
    <header className="h-16 border-b border-slate-900/10 bg-white/85 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 relative z-20"><div className="flex items-center gap-3"><SecureChatLogo size={42} /><p className="font-black tracking-tight text-lg leading-none">SecureChat</p></div><div className="flex items-center gap-3"><div className="hidden sm:flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500"><span className={`h-2 w-2 rounded-full ${online && socketConnected ? "bg-emerald-500" : "bg-amber-500"}`} />{online && socketConnected ? "Connected" : "Reconnecting"}</div><Button variant="ghost" size="icon" className="rounded-sm" aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"} onClick={toggleTheme}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><Button variant="ghost" size="icon" className="rounded-sm relative" aria-label="Notifications" onClick={() => setShowNotifications(value => !value)}><MessageCircle className="h-4 w-4" />{unreadCount > 0 && <span className="absolute top-1 right-1 h-2 w-2 bg-[#ff4f87] rounded-full" />}</Button><ProfileControls user={user} onSignOut={logout} /></div></header>
    {showNotifications && <aside className="fixed top-16 right-4 md:right-8 z-40 w-[min(360px,calc(100vw-2rem))] bg-[#101722] text-white shadow-2xl border border-white/10 p-4"><div className="flex items-center justify-between mb-3"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c8f7f1]">Notifications / {notifications.length}</p><button onClick={() => setShowNotifications(false)} aria-label="Close notifications"><X className="h-4 w-4 text-white/60" /></button></div>{notifications.length ? notifications.map(note => <button key={note.id} onClick={() => { readNotificationMutation.mutate({ notificationId: note.id }); setShowNotifications(false); if (note.conversationId) { setSelectedConversation(note.conversationId); setMobileListOpen(false); } }} className="w-full text-left border-t border-white/10 py-3 hover:bg-white/5"><p className="text-sm font-semibold">{note.title}</p><p className="text-xs text-white/55 mt-1">{note.body}</p><p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mt-2">{timeLabel(note.createdAt)} {note.isRead ? "· read" : "· new"}</p></button>) : <p className="text-sm text-white/55 py-5">No new notifications.</p>}</aside>}
    {(conversationsError || messagesError || notificationsError) && <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#101722] text-white px-4 py-3 shadow-xl border border-[#ff4f87]/50 flex items-center gap-3 text-sm"><ShieldCheck className="h-4 w-4 text-[#ff4f87]" /><span>{conversationsError?.message || messagesError?.message || notificationsError?.message || "Secure data could not be loaded."}</span><button className="ml-2 text-white/60 hover:text-white" onClick={() => window.location.reload()} aria-label="Retry secure connection">Retry</button></div>}
    <main className="mx-auto h-[calc(100vh-4rem)] h-[calc(100dvh-4rem)] min-h-0 w-full max-w-[1600px] min-w-0 max-w-full overflow-hidden p-0 md:p-6"><div className="flex h-full w-full min-w-0 max-w-full overflow-hidden bg-white/75 shadow-[0_24px_80px_rgba(16,23,34,0.10)] md:border md:border-slate-900/15">
      <aside className={`${mobileListOpen ? "flex" : "hidden"} md:flex w-full min-w-0 md:w-[340px] shrink-0 border-r border-slate-900/10 flex-col bg-white/80`}><div className="p-5 border-b border-slate-900/10"><div className="flex items-start justify-between mb-5"><div><p className="font-mono text-[10px] text-slate-400 uppercase tracking-[0.24em]">Inbox</p><h1 className="text-3xl font-black tracking-[-0.05em] mt-1">Messages</h1></div><Badge className="rounded-sm bg-[#ffd7e5] text-[#101722] hover:bg-[#ffd7e5] font-mono text-[10px]">ENCRYPTED</Badge></div><div className="flex gap-2 mb-3"><GroupCreator currentUser={user} onCreated={(id) => { setSelectedConversation(id); setMobileListOpen(false); void utils.secureChat.conversations.invalidate(); }} /><Button variant="outline" onClick={() => { setPeopleOpen(value => !value); setSearch(""); }} className="rounded-sm h-9 font-mono text-[10px] tracking-wider"><UsersRound className="h-3.5 w-3.5 mr-2" />Find friend</Button></div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={event => { setSearch(event.target.value); setPeopleOpen(false); }} placeholder="Find a friend" className="h-10 rounded-sm border-slate-900/15 bg-slate-50 pl-10 font-mono text-xs" /></div></div>
      {(search.length > 1 || peopleOpen) && <div className="border-b border-slate-900/10 p-2 space-y-1">{peopleOpen && <div className="flex items-center justify-between px-3 pt-2 pb-1"><div><p className="text-sm font-bold">Find friends</p><p className="text-[11px] text-slate-500">Other people on SecureChat</p></div><button onClick={() => setPeopleOpen(false)} aria-label="Close find friends" className="p-1 text-slate-500 hover:text-[#101722]"><X className="h-4 w-4" /></button></div>}{results.length ? results.map((person, index) => { const requestPending = pendingFriendIds.has(person.id) || person.friendRequestStatus === "pending"; const friends = person.friendRequestStatus === "accepted"; return <button key={person.id} onClick={() => setFriendProfileUserId(person.id)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#c8f7f1]/45 transition-colors"><ProfileAvatar src={person.profileImageUrl} name={person.name} className="h-9 w-9 rounded-sm" fallbackClassName="rounded-sm" accent={accents[index % accents.length]} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{person.name || "Unnamed user"}</p><p className="text-[11px] text-slate-500 truncate">@{person.username}</p></div><span className="h-8 shrink-0 rounded-sm px-2 grid place-items-center font-mono text-[9px] uppercase tracking-wider text-slate-500">{requestPending ? <><Check className="h-3 w-3 mr-1 inline" />Request sent</> : friends ? <><Check className="h-3 w-3 mr-1 inline" />Friends</> : <><UserRoundPlus className="h-3 w-3 mr-1 inline" />View</>}</span></button>; }) : <p className="p-3 text-xs text-slate-500 font-mono">No other people found yet.</p>}</div>}
      <ScrollArea className="flex-1"><div className="p-2">{conversationsLoading ? <div className="p-5 font-mono text-xs text-slate-400 animate-pulse">Loading encrypted index...</div> : conversations.length ? conversations.map((item, index) => <button key={item.conversationId} onClick={() => { setSelectedConversation(item.conversationId); setMobileListOpen(false); }} className={`w-full p-3 flex items-center gap-3 text-left border-l-2 transition-all ${selectedConversation === item.conversationId ? "bg-[#c8f7f1]/40 border-[#101722]" : "border-transparent hover:bg-slate-50"}`}><ProfileAvatar src={item.kind === "direct" ? item.peer?.profileImageUrl : null} name={item.kind === "group" ? item.title : item.peer?.name} className="h-11 w-11 rounded-sm" fallbackClassName="rounded-sm text-sm font-bold" accent={accents[index % accents.length]} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="font-bold text-sm truncate">{item.kind === "group" ? item.title || "Study group" : item.peer?.name || "University user"}</p>{item.pinned ? <Pin className="h-3.5 w-3.5 shrink-0" /> : null}</div><p className="text-xs text-slate-500 truncate mt-1">{item.kind === "group" ? "Encrypted group" : "Encrypted conversation"}{item.muted ? " · muted" : ""}</p></div></button>) : <EmptyInbox />}</div></ScrollArea></aside>
      <section className={(mobileListOpen ? "hidden md:flex" : "flex") + " min-w-0 w-full max-w-full flex-1 overflow-hidden"}>
        {activeConversation ? <div className="chat-shell flex h-full w-full max-w-full min-w-0 flex-1 min-h-0 flex-col overflow-hidden">
          <div className="chat-header shrink-0 border-b px-4 pb-4 pt-3 md:px-8 md:pb-5 md:pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Button variant="ghost" size="icon" className="chat-header-action h-9 w-9 shrink-0 rounded-full md:hidden" onClick={() => setMobileListOpen(true)} aria-label="Back to conversations"><ChevronLeft className="h-5 w-5" /></Button>
                <button onClick={() => activeConversation.kind === "direct" && activeConversation.peer?.id && setFriendProfileUserId(activeConversation.peer.id)} className="flex min-w-0 items-center gap-3 text-left">
                  <ProfileAvatar src={activePeerImageUrl} name={conversationName} className="h-10 w-10 shrink-0 rounded-xl border border-white/15 bg-[#ffd1e1] text-sm" fallbackClassName="rounded-xl bg-[#ffd1e1] font-black text-[#101722]" />
                  <span className="min-w-0"><span className="block truncate text-base font-black tracking-tight md:text-lg">{conversationName}</span><span className="chat-peer-meta mt-0.5 block truncate text-[11px]">{activeConversation.kind === "group" ? "Encrypted group" : "@" + (activeConversation.peer?.username ?? "friend")}</span></span>
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="icon" aria-label="Security" title="Security" className="chat-security-button h-9 w-9 rounded-full bg-transparent" onClick={() => setShowSecurity(value => !value)}><LockKeyhole className="h-4 w-4" /></Button>
                <div className="relative">
                  <Button variant="ghost" size="icon" className="chat-header-action h-9 w-9 rounded-full" aria-label="Conversation actions" onClick={() => setShowActions(value => !value)}><MoreHorizontal className="h-5 w-5" /></Button>
                  {showActions && <div className="absolute right-0 top-11 z-30 w-56 rounded-2xl border border-white/10 bg-[#132235] p-1 text-white shadow-2xl">{activeConversation.kind === "group" && <GroupMemberManager currentUser={user} conversationId={activeConversation.conversationId} onUpdated={() => refreshConversationData(activeConversation.conversationId)} />}<button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10" onClick={() => void updatePreference("pinned", !activeConversation.pinned)}><Pin className="mr-2 inline h-3.5 w-3.5" />{activeConversation.pinned ? "Unpin conversation" : "Pin conversation"}</button><button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10" onClick={() => void updatePreference("muted", !activeConversation.muted)}><VolumeX className="mr-2 inline h-3.5 w-3.5" />{activeConversation.muted ? "Unmute notifications" : "Mute notifications"}</button><button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10" onClick={() => void updatePreference("hidden", true)}>Clear from my inbox</button>{activeConversation.kind === "direct" && <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-[#ff9fbd] hover:bg-[#4b243b]" onClick={() => void blockCurrentUser()}><ShieldBan className="mr-2 inline h-3.5 w-3.5" />Block user</button>}</div>}
                </div>
              </div>
            </div>
          </div>
          <ScrollArea className="chat-body min-h-0 w-full max-w-full min-w-0 flex-1 overflow-x-hidden"><div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-7 overflow-x-hidden px-4 py-7 md:px-8 md:py-10"><div className="flex min-w-0 items-center gap-3 text-[10px] font-mono uppercase tracking-[0.25em] text-[#d77d9e]"><div className="chat-divider h-px min-w-0 flex-1" /><span className="shrink-0">{activeConversation.kind === "group" ? "Group channel" : "Private chat"}</span><div className="chat-divider h-px min-w-0 flex-1" /></div>{messagesLoading ? <p className="chat-meta py-12 text-center text-xs font-mono">Decrypting local message history...</p> : messages.length ? messages.map(message => { const mine = message.senderId === user.id; const text = decrypted[message.id]; return <div key={message.id} className={"flex min-w-0 " + (mine ? "justify-end" : "justify-start")}><div className={"flex min-w-0 w-fit max-w-[min(88%,42rem)] flex-col gap-2 " + (mine ? "items-end" : "items-start")}><div className={(mine ? "chat-bubble-outgoing rounded-[1.6rem] rounded-br-md" : "chat-bubble-incoming rounded-[1.6rem] rounded-bl-md") + " min-w-0 max-w-full break-words overflow-hidden [overflow-wrap:anywhere] px-5 py-4 text-[15px] leading-relaxed shadow-lg"}>{text || <span className="chat-meta">Decrypting...</span>}{message.attachment && <EncryptedAttachmentCard conversation={activeConversation} attachment={message.attachment} keyVersion={message.keyVersion} />}</div><div className="chat-meta flex items-center gap-2 px-1 text-[10px] font-mono uppercase tracking-wider">{timeLabel(message.createdAt)} {mine && (message.readAt ? <CheckCheck className="h-3.5 w-3.5 text-[#70b6aa]" /> : message.deliveredAt ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />)}</div></div></div>; }) : <EmptyConversation peer={conversationName} />}</div></ScrollArea>
          <div className="chat-composer w-full max-w-full shrink-0 border-t px-3 pb-3 pt-3 md:px-8 md:pb-7"><div className="mx-auto w-full max-w-3xl min-w-0"><div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#d77d9e]"><LockKeyhole className="h-4 w-4" />Private chat</div><div className="chat-composer-box flex w-full min-w-0 items-end gap-1.5 rounded-[1.8rem] border p-2 shadow-lg"><EncryptedMediaComposer conversation={activeConversation} onSent={() => refreshConversationData(selectedConversation ?? undefined)} /><Textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Write a message" className="min-h-[48px] min-w-0 basis-0 flex-1 resize-none border-0 bg-transparent px-2 py-3 text-[15px] text-[#101722] placeholder:text-slate-500 focus-visible:ring-0" /><Button onClick={() => void sendMessage()} disabled={!draft.trim() || sendMutation.isPending || !online} className="h-12 w-12 shrink-0 rounded-full bg-[#b9f2e8] text-[#101722] hover:bg-[#9ff1e4]" size="icon" aria-label="Send encrypted message">{sendMutation.isPending ? <span className="h-4 w-4 rounded-full border-2 border-[#101722]/35 border-t-[#101722] animate-spin" /> : <Send className="h-5 w-5" />}</Button></div></div></div>        </div> : <NoActiveChat onStart={() => setMobileListOpen(true)} />}
      </section>
      {showSecurity && activeConversation && <SecurityPanel messages={messages} onClose={() => setShowSecurity(false)} />}
      <FriendProfileDialog userId={friendProfileUserId} open={Boolean(friendProfileUserId)} onOpenChange={(open) => { if (!open) setFriendProfileUserId(null); }} onConversationOpen={(conversationId) => { setSelectedConversation(conversationId); setMobileListOpen(false); void utils.secureChat.conversations.invalidate(); }} />
    </div></main>
  </div>;
}

function WorkspaceDatabasePending({ user, logout }: { user: { name?: string | null; email?: string | null }; logout: () => Promise<void> }) { return <main className="min-h-screen blueprint-bg text-[#101722]"><header className="h-16 border-b border-slate-900/10 bg-white/85 backdrop-blur-xl flex items-center justify-between px-4 md:px-8"><div className="flex items-center gap-3"><SecureChatLogo size={42} /><p className="font-black tracking-tight text-lg leading-none">SecureChat</p></div><button onClick={() => void logout()} className="text-sm font-semibold hover:underline">Sign out</button></header><section className="max-w-5xl mx-auto px-4 py-8 md:py-14"><div className="border border-slate-900/15 bg-white/80 shadow-[0_24px_80px_rgba(16,23,34,0.10)] p-8 md:p-12"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">Workspace access confirmed</p><h1 className="text-3xl font-black tracking-[-0.05em] mt-2">You are signed in.</h1><p className="text-slate-600 leading-relaxed mt-4 max-w-xl">Your SecureChat account is verified. The private message store is reconnecting, so conversations and sending are temporarily paused rather than sending you back to login.</p></div></section></main>; }
function EmptyInbox() { return <div className="p-8 text-center"><div className="h-12 w-12 border border-dashed border-slate-300 mx-auto grid place-items-center mb-4"><Search className="h-4 w-4 text-slate-400" /></div><p className="font-bold text-sm">No conversations yet</p><p className="text-xs text-slate-500 mt-2 leading-relaxed">Find someone, send a friend request, or create a group.</p></div>; }
function EmptyConversation({ peer }: { peer?: string | null }) { return <div className="text-center py-16"><div className="h-16 w-16 mx-auto bg-[#ffd7e5] grid place-items-center rotate-3"><LockKeyhole className="h-6 w-6" /></div><h3 className="font-black text-xl mt-6">Channel ready</h3><p className="text-sm text-slate-500 mt-2">Say hello to {peer || "your contact"}. This channel is protected by local encryption.</p></div>; }
function NoActiveChat({ onStart }: { onStart: () => void }) { return <div className="flex-1 grid place-items-center p-10"><div className="max-w-md text-center"><div className="h-20 w-20 mx-auto border border-slate-900/15 bg-[#c8f7f1] grid place-items-center rotate-[-6deg]"><MessageCircle className="h-8 w-8" /></div><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 mt-8">SecureChat</p><h2 className="text-4xl font-black tracking-[-0.06em] mt-2">Choose a conversation.</h2><p className="text-slate-500 mt-4 leading-relaxed">Find someone first, or create a group for people you know.</p><Button onClick={onStart} variant="outline" className="rounded-sm mt-7 md:hidden">Open conversations</Button></div></div>; }
function SecurityPanel({ messages, onClose }: { messages: any[]; onClose: () => void }) { const sample = messages[0]; return <aside className="absolute inset-y-0 right-0 w-full sm:w-[360px] bg-[#101722] text-white z-30 shadow-2xl p-6 flex flex-col"><div className="flex items-start justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#c8f7f1]">Security view</p><h3 className="text-2xl font-black tracking-tight mt-2">Protected exchange</h3></div><Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-sm" onClick={onClose} aria-label="Close security view"><X className="h-4 w-4" /></Button></div><div className="mt-8 space-y-6"><div><p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Message flow</p><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between border-b border-white/10 pb-2"><span>Plaintext</span><span className="text-[#c8f7f1]">Browser only</span></div><div className="flex justify-between border-b border-white/10 pb-2"><span>Files & voice notes</span><span className="text-[#c8f7f1]">Encrypted bytes</span></div><div className="flex justify-between border-b border-white/10 pb-2"><span>Server payload</span><span className="text-[#c8f7f1]">Ciphertext</span></div></div></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Stored payload sample</p><div className="mt-3 bg-white/5 border border-white/10 p-3 font-mono text-[10px] leading-5 break-all text-[#c8f7f1]">{sample?.ciphertext || "No ciphertext stored yet"}</div></div></div><div className="mt-auto border-t border-white/10 pt-4 text-[11px] text-white/50 leading-relaxed">Academic prototype: client-side encryption and access-controlled storage. It is not an independently audited production messenger.</div></aside>; }
