import React from "react";
import { ensureIdentity, prepareGroupKey, saveGroupKey } from "@/lib/crypto";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Check, LockKeyhole, Plus, Settings2, ShieldBan, UserRound, UserRoundCheck, UsersRound, X } from "lucide-react";
import { useState } from "react";

type ChatUser = {
  id: number;
  name?: string | null;
  email?: string | null;
  matricNumber?: string | null;
  openId?: string;
};

function subjectFromOpenId(openId?: string) {
  return openId?.startsWith("supabase:") ? openId.slice("supabase:".length) : openId ?? "";
}

export function ProfileControls({ user, onSignOut }: { user: ChatUser; onSignOut: () => Promise<void> }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const settings = trpc.secureChat.profileSettings.useQuery(undefined, { enabled: settingsOpen });
  const requests = trpc.secureChat.messageRequests.useQuery(undefined, { enabled: requestsOpen, refetchInterval: requestsOpen ? 5000 : false });
  const blocked = trpc.secureChat.blockedUsers.useQuery(undefined, { enabled: settingsOpen });
  const updatePrivacy = trpc.secureChat.updatePrivacy.useMutation({ onSuccess: () => void settings.refetch() });
  const respond = trpc.secureChat.respondToMessageRequest.useMutation({ onSuccess: () => void requests.refetch() });
  const unblock = trpc.secureChat.unblockUser.useMutation({ onSuccess: () => void blocked.refetch() });

  return <>
    <div className="relative"><button onClick={() => setMenuOpen(value => !value)} className="flex items-center gap-2 group" aria-label="Open profile menu" aria-expanded={menuOpen}><div className="h-8 w-8 rounded-sm bg-[#c8f7f1] text-[#101722] grid place-items-center font-mono text-xs">{(user.name ?? "U").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase()}</div><span className="hidden md:block text-sm font-semibold group-hover:underline">{user.name ?? "University user"}</span></button>{menuOpen && <div className="absolute right-0 top-11 z-40 w-60 border border-slate-900/15 bg-white p-2 shadow-xl"><div className="px-3 py-2 border-b border-slate-900/10"><p className="text-sm font-semibold truncate">{user.name ?? "University user"}</p><p className="text-xs text-slate-500 truncate mt-0.5">{user.email ?? "Signed in"}</p></div><button onClick={() => { setMenuOpen(false); setRequestsOpen(true); }} className="mt-1 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium hover:bg-[#c8f7f1]"><UserRoundCheck className="h-4 w-4" />Message requests</button><button onClick={() => { setMenuOpen(false); setSettingsOpen(true); }} className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium hover:bg-[#c8f7f1]"><Settings2 className="h-4 w-4" />Profile & settings</button><button onClick={() => void onSignOut()} className="mt-1 flex w-full items-center rounded-sm px-3 py-2 text-left text-sm font-medium text-[#101722] hover:bg-[#ffd7e5]">Sign out</button></div>}</div>
    <Dialog open={requestsOpen} onOpenChange={setRequestsOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Message requests</DialogTitle><DialogDescription>Accept a request before a new person appears in your messages.</DialogDescription></DialogHeader><div className="max-h-[48vh] overflow-y-auto divide-y divide-slate-100">{requests.data?.length ? requests.data.map(request => <div key={request.id} className="py-4 flex items-center gap-3"><div className="h-9 w-9 rounded-sm bg-[#ffd7e5] grid place-items-center font-semibold">{(request.sender.name ?? "U").slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{request.sender.name}</p><p className="text-xs text-slate-500 truncate">{request.sender.email}</p></div><Button size="sm" className="rounded-sm" onClick={() => respond.mutate({ requestId: request.id, action: "accept" })}><Check className="h-3.5 w-3.5 mr-1" />Accept</Button><Button size="sm" variant="outline" className="rounded-sm" onClick={() => respond.mutate({ requestId: request.id, action: "decline" })}><X className="h-3.5 w-3.5" /></Button></div>) : <p className="py-8 text-center text-sm text-slate-500">No pending message requests.</p>}</div></DialogContent></Dialog>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Profile & settings</DialogTitle><DialogDescription>Account details and message privacy controls.</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-sm border border-slate-200 bg-slate-50 p-4"><div className="flex gap-3"><div className="h-10 w-10 rounded-sm bg-[#c8f7f1] grid place-items-center"><UserRound className="h-4 w-4" /></div><div className="min-w-0"><p className="font-semibold">{settings.data?.name ?? user.name}</p><p className="text-sm text-slate-500 truncate">{settings.data?.email ?? user.email}</p><p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 mt-1">{settings.data?.matricNumber ?? user.matricNumber}</p></div></div></div><div className="flex items-center justify-between gap-5 border-y border-slate-100 py-4"><div><p className="text-sm font-semibold">Read receipts</p><p className="text-xs text-slate-500 mt-1">Let others know when you read their messages.</p></div><Switch aria-label="Read receipts" checked={settings.data?.readReceiptsEnabled ?? true} onCheckedChange={(readReceiptsEnabled) => updatePrivacy.mutate({ readReceiptsEnabled })} /></div><div><div className="flex items-center gap-2"><ShieldBan className="h-4 w-4" /><p className="text-sm font-semibold">Blocked users</p></div>{blocked.data?.length ? <div className="mt-2 divide-y divide-slate-100">{blocked.data.map(profile => <div key={profile.id} className="flex items-center justify-between py-2"><span className="text-sm">{profile.name ?? profile.email}</span><Button size="sm" variant="outline" className="rounded-sm" onClick={() => unblock.mutate({ userId: profile.id })}>Unblock</Button></div>)}</div> : <p className="mt-2 text-xs text-slate-500">No blocked users.</p>}</div></div></DialogContent></Dialog>
  </>;
}

export function GroupCreator({ currentUser, onCreated }: { currentUser: ChatUser; onCreated: (conversationId: number) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Array<{ id: number; subject: string; name?: string | null; publicKey?: string | null }>>([]);
  const directory = trpc.secureChat.searchUsers.useQuery({ query }, { enabled: open && query.trim().length > 1 });
  const createGroup = trpc.secureChat.createGroup.useMutation();

  const toggleMember = (person: { id: number; subject: string; name?: string | null; publicKey?: string | null }) => setSelected(current => current.some(member => member.id === person.id) ? current.filter(member => member.id !== person.id) : [...current, person]);
  const create = async () => {
    if (!title.trim() || selected.length < 2) return toast.error("Choose a name and at least two members");
    if (selected.some(member => !member.publicKey)) return toast.error("Each member must open SecureChat once before joining a group");
    try {
      const ownPublicKey = await ensureIdentity();
      const peerKeys = Object.fromEntries([[subjectFromOpenId(currentUser.openId), ownPublicKey], ...selected.map(member => [member.subject, member.publicKey!] as const)]);
      const { encodedKey, envelopes } = await prepareGroupKey(peerKeys);
      const conversationId = await createGroup.mutateAsync({ title, participantIds: selected.map(member => member.id), groupKeyEnvelopes: envelopes });
      saveGroupKey(conversationId, encodedKey);
      setOpen(false); setTitle(""); setQuery(""); setSelected([]); onCreated(conversationId);
    } catch { toast.error("Could not create this encrypted group"); }
  };

  return <><Button onClick={() => setOpen(true)} variant="outline" className="rounded-sm h-9 font-mono text-[10px] uppercase tracking-wider"><UsersRound className="h-3.5 w-3.5 mr-2" />New group</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>New group</DialogTitle><DialogDescription>Messages in this group are encrypted before they leave your browser.</DialogDescription></DialogHeader><Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Group name" className="rounded-sm" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search members" className="rounded-sm" /><div className="min-h-20 max-h-48 overflow-y-auto border-y border-slate-100 py-2">{directory.data?.map(person => <button key={person.id} onClick={() => toggleMember(person)} className="w-full flex items-center gap-3 p-2 text-left hover:bg-slate-50"><div className={`h-6 w-6 border grid place-items-center ${selected.some(member => member.id === person.id) ? "border-[#101722] bg-[#c8f7f1]" : "border-slate-300"}`}>{selected.some(member => member.id === person.id) && <Check className="h-3.5 w-3.5" />}</div><div><p className="text-sm font-medium">{person.name}</p><p className="text-xs text-slate-500">{person.email}</p></div></button>) ?? <p className="p-3 text-sm text-slate-500">Search for at least two SecureChat users.</p>}</div>{selected.length ? <p className="text-xs text-slate-500">{selected.length} member{selected.length === 1 ? "" : "s"} selected</p> : null}<DialogFooter><Button onClick={create} disabled={createGroup.isPending} className="rounded-sm"><Plus className="h-4 w-4 mr-2" />Create encrypted group</Button></DialogFooter></DialogContent></Dialog></>;
}

export function GroupMemberManager({ currentUser, conversationId, onUpdated }: { currentUser: ChatUser; conversationId: number; onUpdated: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const members = trpc.secureChat.groupParticipants.useQuery({ conversationId }, { enabled: open });
  const directory = trpc.secureChat.searchUsers.useQuery({ query }, { enabled: open && query.trim().length > 1 });
  const add = trpc.secureChat.addGroupParticipant.useMutation();
  const isOwner = members.data?.some(member => member.id === currentUser.id && member.isOwner);
  const candidates = directory.data?.filter(person => !members.data?.some(member => member.id === person.id)) ?? [];
  const addMember = async (person: { id: number; subject: string; publicKey?: string | null }) => {
    const groupMembers = members.data ?? [];
    if (!person.publicKey || groupMembers.some(member => !member.publicKey)) return toast.error("Each group member must open SecureChat once before the group key can be rotated");
    try {
      const ownPublicKey = await ensureIdentity();
      const peerKeys = Object.fromEntries([[subjectFromOpenId(currentUser.openId), ownPublicKey], ...groupMembers.filter(member => member.id !== currentUser.id).map(member => [member.subject, member.publicKey!] as const), [person.subject, person.publicKey] as const]);
      const { encodedKey, envelopes } = await prepareGroupKey(peerKeys);
      const result = await add.mutateAsync({ conversationId, userId: person.id, groupKeyEnvelopes: envelopes });
      if (!result) throw new Error("Group membership update was not confirmed");
      saveGroupKey(conversationId, encodedKey, result.keyVersion);
      await onUpdated();
      setQuery("");
      toast.success("Member added with a new group key");
    } catch { toast.error("Could not add this member"); }
  };
  if (!isOwner && members.data) return null;
  return <><button className="w-full flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setOpen(true)}><UsersRound className="h-3.5 w-3.5" />Manage members</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Group members</DialogTitle><DialogDescription>Adding a member creates a new encrypted group key for everyone.</DialogDescription></DialogHeader><div className="max-h-36 overflow-y-auto divide-y divide-slate-100">{members.data?.map(member => <div key={member.id} className="py-2 text-sm"><span className="font-medium">{member.name}</span>{member.isOwner ? <span className="ml-2 text-xs text-slate-500">Creator</span> : null}</div>)}</div><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a user to add" className="rounded-sm" /><div className="max-h-36 overflow-y-auto">{candidates.map(person => <button key={person.id} onClick={() => void addMember(person)} className="w-full p-2 text-left hover:bg-slate-50"><p className="text-sm font-medium">{person.name}</p><p className="text-xs text-slate-500">{person.email}</p></button>)}</div></DialogContent></Dialog></>;
}
