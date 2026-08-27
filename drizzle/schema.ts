import { boolean, integer, pgTable, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  username: varchar("username", { length: 32 }).unique(),
  email: varchar("email", { length: 320 }),
  universityEmail: varchar("universityEmail", { length: 320 }).unique(),
  matricNumber: varchar("matricNumber", { length: 40 }).notNull().unique(),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16, enum: ["user", "admin"] }).default("user").notNull(),
  publicKey: text("publicKey"),
  lastSeenAt: timestamp("lastSeenAt"),
  isOnline: boolean("isOnline").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const conversationParticipants = pgTable("conversationParticipants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull(),
  userId: integer("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  lastReadAt: timestamp("lastReadAt"),
}, (table) => ({
  participantUnique: unique("conversation_participant_unique").on(table.conversationId, table.userId),
}));

export const encryptedMessages = pgTable("encryptedMessages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull(),
  senderId: integer("senderId").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: varchar("iv", { length: 128 }).notNull(),
  keyVersion: varchar("keyVersion", { length: 64 }).default("v1").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
});

export const messageStatuses = pgTable("messageStatuses", {
  id: serial("id").primaryKey(),
  messageId: integer("messageId").notNull(),
  userId: integer("userId").notNull(),
  status: varchar("status", { length: 16, enum: ["sent", "delivered", "read"] }).default("sent").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  messageUserUnique: unique("message_status_user_unique").on(table.messageId, table.userId),
}));

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 32, enum: ["new_message", "recipient_returned"] }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  conversationId: integer("conversationId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type EncryptedMessage = typeof encryptedMessages.$inferSelect;
