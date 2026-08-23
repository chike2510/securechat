import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, unique } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  universityEmail: varchar("universityEmail", { length: 320 }).unique(),
  matricNumber: varchar("matricNumber", { length: 40 }).unique(),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  publicKey: text("publicKey"),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  isOnline: int("isOnline").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const conversationParticipants = mysqlTable("conversationParticipants", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  lastReadAt: timestamp("lastReadAt"),
}, (table) => ({
  participantUnique: unique("conversation_participant_unique").on(table.conversationId, table.userId),
}));

export const encryptedMessages = mysqlTable("encryptedMessages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  senderId: int("senderId").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: varchar("iv", { length: 128 }).notNull(),
  keyVersion: varchar("keyVersion", { length: 64 }).default("v1").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
});

export const messageStatuses = mysqlTable("messageStatuses", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["sent", "delivered", "read"]).default("sent").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  messageUserUnique: unique("message_status_user_unique").on(table.messageId, table.userId),
}));

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["new_message", "recipient_returned"]).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  conversationId: int("conversationId"),
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type EncryptedMessage = typeof encryptedMessages.$inferSelect;
