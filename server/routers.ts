import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const universityProcedure = protectedProcedure.use(({ ctx, next }) => {
  const email = ctx.user.email?.toLowerCase() ?? "";
  const isUniversityUser = email.endsWith("@fupre.edu.ng") || ctx.user.openId === process.env.OWNER_OPEN_ID;
  if (!isUniversityUser) throw new TRPCError({ code: "FORBIDDEN", message: "SecureChat is restricted to approved university accounts." });
  return next();
});
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
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  secureChat: router({
    searchUsers: universityProcedure.input(z.object({ query: z.string().max(80).default("") })).query(({ ctx, input }) =>
      searchUsers(ctx.user.id, input.query)
    ),
    conversations: universityProcedure.query(({ ctx }) => listConversations(ctx.user.id)),
    openConversation: universityProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(({ ctx, input }) =>
      getOrCreateDirectConversation(ctx.user.id, input.userId)
    ),
    messages: universityProcedure.input(z.object({ conversationId: z.number().int().positive() })).query(({ ctx, input }) =>
      listEncryptedMessages(ctx.user.id, input.conversationId)
    ),
    sendEncryptedMessage: universityProcedure.input(z.object({
      conversationId: z.number().int().positive(),
      ciphertext: z.string().min(1).max(20000),
      iv: z.string().min(1).max(128),
      keyVersion: z.string().max(64).optional(),
    })).mutation(({ ctx, input }) => createEncryptedMessage({ userId: ctx.user.id, ...input })),
    updateMessageStatus: universityProcedure.input(z.object({
      messageId: z.number().int().positive(),
      status: z.enum(["delivered", "read"]),
    })).mutation(({ ctx, input }) => updateMessageStatus(ctx.user.id, input.messageId, input.status)),
    setPublicKey: universityProcedure.input(z.object({ publicKey: z.string().min(1).max(10000) })).mutation(({ ctx, input }) =>
      setPublicKey(ctx.user.id, input.publicKey)
    ),
    presence: universityProcedure.input(z.object({ online: z.boolean() })).mutation(({ ctx, input }) =>
      setUserPresence(ctx.user.id, input.online)
    ),
    notifications: universityProcedure.query(({ ctx }) => listNotifications(ctx.user.id)),
    readNotification: universityProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(({ ctx, input }) =>
      markNotificationRead(ctx.user.id, input.notificationId)
    ),
  }),
});

export type AppRouter = typeof appRouter;
