import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { systemRouter } from "./_core/systemRouter.js";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc.js";
import { signInSupabaseWithMatric } from "./supabaseAuth.js";
import {
  createEncryptedMessage,
  createMessageRequest,
  createGroupConversation,
  addGroupParticipant,
  blockUser,
  downloadEncryptedAttachment,
  getOrCreateDirectConversation,
  getProfileSettings,
  listBlockedUsers,
  listConversations,
  listEncryptedMessages,
  listGroupParticipants,
  listMessageRequests,
  listNotifications,
  markNotificationRead,
  respondToMessageRequest,
  searchUsers,
  setConversationPreference,
  setPublicKey,
  setUserPresence,
  unblockUser,
  updatePrivacySettings,
  updateProfileSettings,
  updateMessageStatus,
  uploadEncryptedAttachment,
} from "./db.js";

const matricSchema = z.string().trim().min(4).max(40).transform(value => value.toUpperCase());
const groupKeyEnvelopeSchema = z.object({ ciphertext: z.string().min(1).max(2000), iv: z.string().min(1).max(128), ownerPublicKey: z.string().min(1).max(10000) });
const encryptedAttachmentSchema = z.object({ id: z.number().int().positive(), name: z.string().min(1).max(120), mediaType: z.string().min(1).max(120), size: z.number().int().positive().max(3 * 1024 * 1024), ciphertextPath: z.string().min(1).max(200), iv: z.string().min(1).max(128), kind: z.enum(["file", "voice"]) });
const universityProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.matricNumber || !(ctx.user.universityEmail ?? ctx.user.email)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "SecureChat requires a registered student identity." });
  }
  return next();
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    signInWithMatric: publicProcedure.input(z.object({ matricNumber: matricSchema, password: z.string().min(1).max(128) })).mutation(({ input }) => signInSupabaseWithMatric(input.matricNumber, input.password)),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),
  secureChat: router({
    searchUsers: universityProcedure.input(z.object({ query: z.string().max(80).default("") })).query(({ ctx, input }) => searchUsers(ctx.user.id, input.query)),
    profileSettings: universityProcedure.query(({ ctx }) => getProfileSettings(ctx.user.id)),
    updateProfile: universityProcedure.input(z.object({ name: z.string().trim().min(2).max(60), avatarStyle: z.enum(["ink", "mint", "rose", "violet"]), imageData: z.string().max(700_000).nullable().optional(), imageType: z.enum(["image/jpeg", "image/png", "image/webp"]).nullable().optional(), clearImage: z.boolean().optional() })).mutation(({ ctx, input }) => updateProfileSettings(ctx.user.id, input)),
    updatePrivacy: universityProcedure.input(z.object({ readReceiptsEnabled: z.boolean() })).mutation(({ ctx, input }) => updatePrivacySettings(ctx.user.id, input)),
    messageRequests: universityProcedure.query(({ ctx }) => listMessageRequests(ctx.user.id)),
    requestMessage: universityProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(({ ctx, input }) => createMessageRequest(ctx.user.id, input.userId)),
    respondToMessageRequest: universityProcedure.input(z.object({ requestId: z.number().int().positive(), action: z.enum(["accept", "decline"]) })).mutation(({ ctx, input }) => respondToMessageRequest(ctx.user.id, input.requestId, input.action)),
    blockedUsers: universityProcedure.query(({ ctx }) => listBlockedUsers(ctx.user.id)),
    blockUser: universityProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(({ ctx, input }) => blockUser(ctx.user.id, input.userId)),
    unblockUser: universityProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(({ ctx, input }) => unblockUser(ctx.user.id, input.userId)),
    conversations: universityProcedure.query(({ ctx }) => listConversations(ctx.user.id)),
    openConversation: universityProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(({ ctx, input }) => getOrCreateDirectConversation(ctx.user.id, input.userId)),
    createGroup: universityProcedure.input(z.object({ title: z.string().trim().min(2).max(80), participantIds: z.array(z.number().int().positive()).min(2).max(19), groupKeyEnvelopes: z.record(z.string(), groupKeyEnvelopeSchema) })).mutation(({ ctx, input }) => createGroupConversation(ctx.user.id, input)),
    groupParticipants: universityProcedure.input(z.object({ conversationId: z.number().int().positive() })).query(({ ctx, input }) => listGroupParticipants(ctx.user.id, input.conversationId)),
    addGroupParticipant: universityProcedure.input(z.object({ conversationId: z.number().int().positive(), userId: z.number().int().positive(), groupKeyEnvelopes: z.record(z.string(), groupKeyEnvelopeSchema) })).mutation(({ ctx, input }) => addGroupParticipant(ctx.user.id, input)),
    setConversationPreference: universityProcedure.input(z.object({ conversationId: z.number().int().positive(), preference: z.enum(["pinned", "muted", "hidden"]), value: z.boolean() })).mutation(({ ctx, input }) => setConversationPreference(ctx.user.id, input.conversationId, input.preference, input.value)),
    messages: universityProcedure.input(z.object({ conversationId: z.number().int().positive() })).query(({ ctx, input }) => listEncryptedMessages(ctx.user.id, input.conversationId)),
    uploadEncryptedAttachment: universityProcedure.input(z.object({ conversationId: z.number().int().positive(), ciphertext: z.string().min(1).max(4_200_000), iv: z.string().min(1).max(128), name: z.string().max(120), mediaType: z.string().max(120), size: z.number().int().positive().max(3 * 1024 * 1024), kind: z.enum(["file", "voice"]) })).mutation(({ ctx, input }) => uploadEncryptedAttachment(ctx.user.id, input)),
    downloadEncryptedAttachment: universityProcedure.input(z.object({ conversationId: z.number().int().positive(), attachmentId: z.number().int().positive() })).query(({ ctx, input }) => downloadEncryptedAttachment(ctx.user.id, input)),
    sendEncryptedMessage: universityProcedure.input(z.object({ conversationId: z.number().int().positive(), ciphertext: z.string().min(1).max(20000), iv: z.string().min(1).max(128), keyVersion: z.string().max(64).optional(), attachment: encryptedAttachmentSchema.nullish() })).mutation(({ ctx, input }) => createEncryptedMessage({ userId: ctx.user.id, ...input })),
    updateMessageStatus: universityProcedure.input(z.object({ messageId: z.number().int().positive(), status: z.enum(["delivered", "read"]) })).mutation(({ ctx, input }) => updateMessageStatus(ctx.user.id, input.messageId, input.status)),
    setPublicKey: universityProcedure.input(z.object({ publicKey: z.string().min(1).max(10000) })).mutation(({ ctx, input }) => setPublicKey(ctx.user.id, input.publicKey)),
    presence: universityProcedure.input(z.object({ online: z.boolean() })).mutation(({ ctx, input }) => setUserPresence(ctx.user.id, input.online)),
    notifications: universityProcedure.query(({ ctx }) => listNotifications(ctx.user.id)),
    readNotification: universityProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(({ ctx, input }) => markNotificationRead(ctx.user.id, input.notificationId)),
  }),
});

export type AppRouter = typeof appRouter;
