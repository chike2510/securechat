import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Check, ChevronLeft, MessageCircle, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";

const avatars = {
  mint: "/manus-storage/securechat-avatar-smile_635298be.png",
  violet: "/manus-storage/securechat-avatar-headphones_939036c4.png",
  rose: "/manus-storage/securechat-avatar-bucket-hat_d5d97374.png",
  ink: "/manus-storage/securechat-avatar-yellow-hoodie_6195fb3d.png",
} as const;

type FriendProfileDialogProps = {
  userId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationOpen: (conversationId: number) => void;
};

export function FriendProfileDialog({ userId, open, onOpenChange, onConversationOpen }: FriendProfileDialogProps) {
  const profile = trpc.secureChat.friendProfile.useQuery({ userId: userId ?? 0 }, { enabled: open && Boolean(userId) });
  const request = trpc.secureChat.requestMessage.useMutation({ onSuccess: () => void profile.refetch() });
  const openConversation = trpc.secureChat.openConversation.useMutation();
  const person = profile.data;
  const start = async () => {
    if (!person || !userId) return;
    try {
      if (person.relationship === "friends") {
        const conversationId = await openConversation.mutateAsync({ userId });
        onOpenChange(false);
        onConversationOpen(conversationId);
        return;
      }
      if (person.relationship === "pending") return;
      await request.mutateAsync({ userId });
      await profile.refetch();
      toast.success("Friend request sent");
    } catch {
      toast.error("That action is unavailable right now");
    }
  };
  const relationshipLabel = person?.relationship === "friends" ? "Friends" : person?.relationship === "pending" ? "Request sent" : "Add friend";
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md max-h-[calc(100svh-1rem)] overflow-y-auto rounded-2xl p-0 gap-0"><DialogHeader className="sr-only"><DialogTitle>Friend profile</DialogTitle><DialogDescription>View a SecureChat friend profile and contact actions.</DialogDescription></DialogHeader><div className="bg-[#101722] text-white px-6 pt-5 pb-7"><div className="flex items-center justify-between"><button onClick={() => onOpenChange(false)} aria-label="Back to friends" className="grid h-9 w-9 place-items-center rounded-sm border border-white/15 hover:bg-white/10"><ChevronLeft className="h-5 w-5" /></button><span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">SecureChat</span><div className="w-9" /></div>{profile.isLoading ? <div className="h-72 animate-pulse" /> : person ? <div className="text-center pt-8"><div className="relative mx-auto h-28 w-28"><img src={person.profileImageUrl || avatars[person.avatarStyle]} alt="" className="h-28 w-28 rounded-[2rem] object-cover border-4 border-white/10" /><span className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-[#101722] ${person.isOnline ? "bg-emerald-400" : "bg-slate-400"}`} /></div><h2 className="mt-5 text-2xl font-black tracking-tight">{person.name || "SecureChat user"}</h2><p className="mt-1 text-sm text-[#c8f7f1]">@{person.username}</p><p className="mt-5 text-xs text-white/50">{person.isOnline ? "Online now" : "On SecureChat"}</p></div> : <p className="py-20 text-center text-sm text-white/55">This profile is unavailable.</p>}</div>{person && <div className="p-5 bg-white space-y-5"><div className="grid grid-cols-2 gap-3"><Button onClick={() => void start()} disabled={request.isPending || openConversation.isPending || person.relationship === "pending"} className="h-12 rounded-sm bg-[#c8f7f1] text-[#101722] hover:bg-[#afe9e1] disabled:opacity-100">{person.relationship === "friends" ? <MessageCircle className="h-4 w-4 mr-2" /> : person.relationship === "pending" ? <Check className="h-4 w-4 mr-2" /> : <UserRoundPlus className="h-4 w-4 mr-2" />}{person.relationship === "friends" ? "Message" : relationshipLabel}</Button><div className="h-12 rounded-sm border border-[#101722]/15 grid place-items-center text-sm font-semibold text-[#101722]"><Check className="h-4 w-4 mr-2 text-emerald-600" />{relationshipLabel}</div></div><div className="border-t border-slate-100 pt-5"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">About</p><p className="mt-2 text-sm text-slate-500 leading-relaxed">This person is on SecureChat. Their contact details stay private.</p></div></div>}</DialogContent></Dialog>;
}
