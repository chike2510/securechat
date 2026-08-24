import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { systemRouter } from "./_core/systemRouter.js";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc.js";
import { signInSupabaseWithMatric } from "./supabaseAuth.js";
import {
  createEncryptedMessage,
  getOrCreateDirectConversation,
  listConversations,
  listEncryptedMessages,
  listNotifications,
  markNotificationRead,
  searchUsers,
  setPublicKey,
  setUserPresence,
  updateMessageStatus,
} from "./db.js";

const matricSchema = z.string().trim().min(4).max(40).transform(value => value.toUpperCase());
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
    conversations: universityProcedure.query(({ ctx }) => listConversations(ctx.user.id)),
    openConversation: universityProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(({ ctx, input }) => getOrCreateDirectConversation(ctx.user.id, input.userId)),
    messages: universityProcedure.input(z.object({ conversationId: z.number().int().positive() })).query(({ ctx, input }) => listEncryptedMessages(ctx.user.id, input.conversationId)),
    sendEncryptedMessage: universityProcedure.input(z.object({ conversationId: z.number().int().positive(), ciphertext: z.string().min(1).max(20000), iv: z.string().min(1).max(128), keyVersion: z.string().max(64).optional() })).mutation(({ ctx, input }) => createEncryptedMessage({ userId: ctx.user.id, ...input })),
    updateMessageStatus: universityProcedure.input(z.object({ messageId: z.number().int().positive(), status: z.enum(["delivered", "read"]) })).mutation(({ ctx, input }) => updateMessageStatus(ctx.user.id, input.messageId, input.status)),
    setPublicKey: universityProcedure.input(z.object({ publicKey: z.string().min(1).max(10000) })).mutation(({ ctx, input }) => setPublicKey(ctx.user.id, input.publicKey)),
    presence: universityProcedure.input(z.object({ online: z.boolean() })).mutation(({ ctx, input }) => setUserPresence(ctx.user.id, input.online)),
    notifications: universityProcedure.query(({ ctx }) => listNotifications(ctx.user.id)),
    readNotification: universityProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(({ ctx, input }) => markNotificationRead(ctx.user.id, input.notificationId)),
  }),
});

export type AppRouter = typeof appRouter;
