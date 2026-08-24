import { and, desc, eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  conversationParticipants,
  conversations,
  encryptedMessages,
  InsertUser,
  messageStatuses,
  notifications,
  users,
} from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";
import { advanceMessageStatus, notificationFor } from "../shared/message-lifecycle.js";
import { assertParticipantAccess } from "./accessControl.js";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  if (!user.matricNumber) throw new Error("User matric number is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, matricNumber: user.matricNumber };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOrCreateSupabaseUser(input: { openId: string; email: string | null; name: string; matricNumber: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await getUserByOpenId(input.openId);
  if (existing) {
    await db.update(users).set({ email: input.email, universityEmail: input.email, name: input.name, matricNumber: input.matricNumber, loginMethod: "supabase-email" }).where(eq(users.id, existing.id));
    return { ...existing, email: input.email, universityEmail: input.email, name: input.name, matricNumber: input.matricNumber, loginMethod: "supabase-email" };
  }
  const inserted = await db.insert(users).values({ openId: input.openId, email: input.email, universityEmail: input.email, name: input.name, matricNumber: input.matricNumber, loginMethod: "supabase-email" }).$returningId();
  return getUserById(inserted[0]?.id ?? 0);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByMatricNumber(matricNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.matricNumber, matricNumber)).limit(1);
  return result[0];
}

export async function getUserByUniversityEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.universityEmail, email)).limit(1);
  return result[0];
}

export async function createLocalUser(input: { matricNumber: string; universityEmail: string; name: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const inserted = await db.insert(users).values({
    openId: `local:${input.matricNumber}`,
    matricNumber: input.matricNumber,
    universityEmail: input.universityEmail,
    email: input.universityEmail,
    name: input.name,
    passwordHash: input.passwordHash,
    loginMethod: "matric-password",
  }).$returningId();
  return inserted[0]?.id;
}

export async function searchUsers(currentUserId: number, query: string) {
  const db = await getDb();
  if (!db) return [];
  const usersList = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    publicKey: users.publicKey,
    isOnline: users.isOnline,
    lastSeenAt: users.lastSeenAt,
  }).from(users).where(ne(users.id, currentUserId)).limit(30);
  const needle = query.trim().toLowerCase();
  return needle ? usersList.filter(u => `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(needle)) : usersList;
}

export async function setUserPresence(userId: number, online: boolean) {
  const db = await getDb();
  if (!db) return;
  const previous = await db.select({ isOnline: users.isOnline, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  await db.update(users).set({ isOnline: online ? 1 : 0, lastSeenAt: new Date() }).where(eq(users.id, userId));
  if (online && previous[0]?.isOnline === 0) {
    const memberships = await db.select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants).where(eq(conversationParticipants.userId, userId));
    for (const membership of memberships) {
      const peers = await db.select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(and(eq(conversationParticipants.conversationId, membership.conversationId), ne(conversationParticipants.userId, userId)));
      for (const peer of peers) {
        await db.insert(notifications).values({
          userId: peer.userId,
          ...notificationFor("recipient-returned"),
          body: `${previous[0]?.name || "Your contact"} returned to SecureChat.`,
          conversationId: membership.conversationId,
        });
      }
    }
  }
}

export async function setPublicKey(userId: number, publicKey: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ publicKey }).where(eq(users.id, userId));
}

export async function userIsParticipant(userId: number, conversationId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.userId, userId), eq(conversationParticipants.conversationId, conversationId)))
    .limit(1);
  return Boolean(result[0]);
}

export async function getOrCreateDirectConversation(userId: number, otherUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const mine = await db.select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants).where(eq(conversationParticipants.userId, userId));
  for (const candidate of mine) {
    const members = await db.select({ userId: conversationParticipants.userId })
      .from(conversationParticipants).where(eq(conversationParticipants.conversationId, candidate.conversationId));
    if (members.length === 2 && members.some(m => m.userId === otherUserId)) return candidate.conversationId;
  }
  const created = await db.insert(conversations).values({}).$returningId();
  const conversationId = created[0]?.id;
  if (!conversationId) throw new Error("Could not create conversation");
  await db.insert(conversationParticipants).values([
    { conversationId, userId },
    { conversationId, userId: otherUserId },
  ]);
  return conversationId;
}

export async function listConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const memberships = await db.select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants).where(eq(conversationParticipants.userId, userId));
  const result = [];
  for (const membership of memberships) {
    const members = await db.select({ userId: conversationParticipants.userId, name: users.name, email: users.email, publicKey: users.publicKey, isOnline: users.isOnline, lastSeenAt: users.lastSeenAt })
      .from(conversationParticipants).innerJoin(users, eq(users.id, conversationParticipants.userId))
      .where(and(eq(conversationParticipants.conversationId, membership.conversationId), ne(users.id, userId)));
    const latest = await db.select({ id: encryptedMessages.id, createdAt: encryptedMessages.createdAt })
      .from(encryptedMessages).where(eq(encryptedMessages.conversationId, membership.conversationId)).orderBy(desc(encryptedMessages.createdAt)).limit(1);
    result.push({ conversationId: membership.conversationId, peer: members[0], latestMessageAt: latest[0]?.createdAt ?? null });
  }
  return result.sort((a, b) => (b.latestMessageAt?.getTime() ?? 0) - (a.latestMessageAt?.getTime() ?? 0));
}

export async function listEncryptedMessages(userId: number, conversationId: number) {
  assertParticipantAccess(true, await userIsParticipant(userId, conversationId), "Unauthorized conversation access");
  const db = await getDb();
  if (!db) return [];
  return db.select().from(encryptedMessages).where(eq(encryptedMessages.conversationId, conversationId)).orderBy(encryptedMessages.createdAt);
}

export async function createEncryptedMessage(input: {
  userId: number;
  conversationId: number;
  ciphertext: string;
  iv: string;
  keyVersion?: string;
}) {
  if (!(await userIsParticipant(input.userId, input.conversationId))) throw new Error("Unauthorized conversation access");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const inserted = await db.insert(encryptedMessages).values({
    conversationId: input.conversationId,
    senderId: input.userId,
    ciphertext: input.ciphertext,
    iv: input.iv,
    keyVersion: input.keyVersion ?? "v1",
  }).$returningId();
  const messageId = inserted[0]?.id;
  if (!messageId) throw new Error("Could not create message");
  await db.insert(messageStatuses).values({ messageId, userId: input.userId, status: "sent" });
  const members = await db.select({ userId: conversationParticipants.userId }).from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, input.conversationId));
  for (const member of members.filter(m => m.userId !== input.userId)) {
    await db.insert(messageStatuses).values({ messageId, userId: member.userId, status: "sent" });
    await db.insert(notifications).values({
      userId: member.userId,
      ...notificationFor("new-message"),
      body: "A protected message is waiting in SecureChat.",
      conversationId: input.conversationId,
    });
  }
  return { messageId };
}

export async function updateMessageStatus(userId: number, messageId: number, status: "delivered" | "read") {
  const db = await getDb();
  if (!db) return;
  const message = await db.select().from(encryptedMessages).where(eq(encryptedMessages.id, messageId)).limit(1);
  assertParticipantAccess(Boolean(message[0]), Boolean(message[0] && await userIsParticipant(userId, message[0].conversationId)), "Unauthorized message access");
  const currentStatus = await db.select({ status: messageStatuses.status }).from(messageStatuses)
    .where(and(eq(messageStatuses.messageId, messageId), eq(messageStatuses.userId, userId))).limit(1);
  const nextStatus = advanceMessageStatus(currentStatus[0]?.status ?? "sent", status);
  await db.update(messageStatuses).set({ status: nextStatus }).where(and(eq(messageStatuses.messageId, messageId), eq(messageStatuses.userId, userId)));
  if (nextStatus === "delivered") await db.update(encryptedMessages).set({ deliveredAt: new Date() }).where(eq(encryptedMessages.id, messageId));
  if (nextStatus === "read") await db.update(encryptedMessages).set({ deliveredAt: new Date(), readAt: new Date() }).where(eq(encryptedMessages.id, messageId));
}

export async function listNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(30);
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: 1 }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}
