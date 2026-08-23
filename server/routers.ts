import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { clearSessionCookie, createSessionToken, hashPassword, setSessionCookie, verifyPassword } from "./localAuth";
import { COOKIE_NAME } from "../shared/const";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createEncryptedMessage,
  createLocalUser,
  getOrCreateDirectConversation,
  getUserByMatricNumber,
  listConversations,
  listEncryptedMessages,
  listNotifications,
  markNotificationRead,
  searchUsers,
  setPublicKey,
  setUserPresence,
  updateMessageStatus,
} from "./db";

const matricSchema = z.string().trim().min(4).max(40).transform(value => value.toUpperCase());
const universityEmailSchema = z.string().trim().email().max(320).transform(value => value.toLowerCase());
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
    register: publicProcedure.input(z.object({
      matricNumber: matricSchema,
      universityEmail: universityEmailSchema,
      name: z.string().trim().min(2).max(120),
      password: z.string().min(8).max(128),
    })).mutation(async ({ ctx, input }) => {
      if (await getUserByMatricNumber(input.matricNumber)) throw new TRPCError({ code: "CONFLICT", message: "That matric number is already registered." });
      const userId = await createLocalUser({ ...input, passwordHash: hashPassword(input.password) });
      if (!userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create account." });
      setSessionCookie(ctx.res, createSessionToken(userId));
      return { success: true } as const;
    }),
    login: publicProcedure.input(z.object({ matricNumber: matricSchema, password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const user = await getUserByMatricNumber(input.matricNumber);
      if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid matric number or password." });
      setSessionCookie(ctx.res, createSessionToken(user.id));
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => { clearSessionCookie(ctx.res); return { success: true } as const; }),
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
