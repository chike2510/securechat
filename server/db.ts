import { createHash, randomInt } from "node:crypto";
import { createClient, type SupabaseClient, type User as SupabaseAuthUser } from "@supabase/supabase-js";
import type { InsertUser, User } from "../drizzle/schema.js";
import { advanceMessageStatus, notificationFor } from "../shared/message-lifecycle.js";

const BUCKET = "securechat-private-v1";

type StorageEnv = {
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  STORAGE_SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  STORAGE_SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STORAGE_SUPABASE_SERVICE_ROLE_KEY?: string;
};

type RemoteProfile = {
  subject: string;
  name: string | null;
  email: string | null;
  matricNumber: string;
  role: "user" | "admin";
  publicKey: string | null;
  lastSeenAt: string | null;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
};

type ConversationInfo = {
  id: number;
  participants: [string, string];
  createdAt: string;
  updatedAt: string;
};

type ConversationIndex = {
  conversationId: number;
  peerSubject: string;
  createdAt: string;
  updatedAt: string;
  latestMessageAt: string | null;
};

type StoredMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  senderSubject: string;
  ciphertext: string;
  iv: string;
  keyVersion: string;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
};

type StoredNotification = {
  id: number;
  userSubject: string;
  type: "new_message" | "recipient_returned";
  title: string;
  body: string;
  conversationId: number | null;
  isRead: boolean;
  createdAt: string;
};

let _client: SupabaseClient | null = null;
let _initialization: Promise<SupabaseClient | null> | null = null;
let _readiness: "unconfigured" | "initializing" | "ready" | "failed" = "unconfigured";
let _failureCategory: "authentication" | "connection" | "schema" | "unknown" | null = null;

function resolveSupabaseUrl(env: StorageEnv = process.env as StorageEnv) {
  return env.STORAGE_SUPABASE_URL ?? env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "";
}

function resolveSupabaseServerKey(env: StorageEnv = process.env as StorageEnv) {
  return env.STORAGE_SUPABASE_SECRET_KEY ?? env.SUPABASE_SECRET_KEY ?? env.STORAGE_SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function getSupabaseStorageConfiguration(env: StorageEnv = process.env as StorageEnv) {
  return {
    urlConfigured: Boolean(resolveSupabaseUrl(env)),
    serverKeyConfigured: Boolean(resolveSupabaseServerKey(env)),
  };
}

export function databaseFailureCategory(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("jwt") || message.includes("permission") || message.includes("unauthorized") || message.includes("authentication") || message.includes("api key")) return "authentication" as const;
  if (message.includes("bucket") || message.includes("storage")) return "schema" as const;
  if (message.includes("ssl") || message.includes("connect") || message.includes("timeout") || message.includes("network") || message.includes("fetch")) return "connection" as const;
  return "unknown" as const;
}

async function ensureBucket(client: SupabaseClient) {
  const existing = await client.storage.getBucket(BUCKET);
  if (!existing.error) return;
  const created = await client.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: "1048576",
    allowedMimeTypes: ["application/json"],
  });
  if (created.error && !created.error.message.toLowerCase().includes("already exists")) throw created.error;
}

async function getStore() {
  if (_client) return _client;
  if (!_initialization) {
    _initialization = (async () => {
      const url = resolveSupabaseUrl();
      const key = resolveSupabaseServerKey();
      if (!url || !key) {
        _readiness = "unconfigured";
        return null;
      }
      _readiness = "initializing";
      try {
        const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        await ensureBucket(client);
        _client = client;
        _readiness = "ready";
        _failureCategory = null;
        return client;
      } catch (error) {
        _readiness = "failed";
        _failureCategory = databaseFailureCategory(error);
        console.error("[SecureChatStorage] private storage initialization failed", error instanceof Error ? error.message : "unknown error");
        return null;
      }
    })().finally(() => {
      _initialization = null;
    });
  }
  return _initialization;
}

export async function getDatabaseReadiness() {
  await getStore();
  const configuration = getSupabaseStorageConfiguration();
  return {
    configured: configuration.urlConfigured && configuration.serverKeyConfigured,
    driver: "supabase-private-storage" as const,
    source: "storage-supabase" as const,
    configuredSources: ["storage-supabase"],
    attemptedSources: configuration.urlConfigured && configuration.serverKeyConfigured ? ["storage-supabase"] : [],
    status: _readiness,
    failureCategory: _failureCategory,
  };
}

function now() {
  return new Date().toISOString();
}

function asDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function subjectFromOpenId(openId: string) {
  return openId.startsWith("supabase:") ? openId.slice("supabase:".length) : openId;
}

function numericId(subject: string) {
  const hash = createHash("sha256").update(`securechat:user:${subject}`).digest();
  return Math.max(1, hash.readUInt32BE(0) & 0x7fffffff);
}

function directConversationId(firstSubject: string, secondSubject: string) {
  const pair = [firstSubject, secondSubject].sort().join(":");
  const hash = createHash("sha256").update(`securechat:conversation:${pair}`).digest();
  return Math.max(1, hash.readUInt32BE(0) & 0x7fffffff);
}

function profilePath(subject: string) {
  return `profiles/${subject}.json`;
}

function conversationInfoPath(conversationId: number) {
  return `conversations/${conversationId}/info.json`;
}

function conversationIndexPath(subject: string, conversationId: number) {
  return `inboxes/${subject}/conversations/${conversationId}.json`;
}

function messagePath(conversationId: number, messageId: number) {
  return `conversations/${conversationId}/messages/${messageId}.json`;
}

function messageIndexPath(subject: string, messageId: number) {
  return `inboxes/${subject}/messages/${messageId}.json`;
}

function notificationPath(subject: string, notificationId: number) {
  return `inboxes/${subject}/notifications/${notificationId}.json`;
}

async function readJson<T>(path: string): Promise<T | undefined> {
  const store = await getStore();
  if (!store) return undefined;
  const { data, error } = await store.storage.from(BUCKET).download(path);
  if (error) {
    if (error.message.toLowerCase().includes("not found") || error.message.toLowerCase().includes("object")) return undefined;
    throw error;
  }
  return JSON.parse(await data.text()) as T;
}

async function writeJson(path: string, value: unknown) {
  const store = await getStore();
  if (!store) throw new Error("SecureChat private storage is unavailable");
  const { error } = await store.storage.from(BUCKET).upload(path, JSON.stringify(value), {
    upsert: true,
    contentType: "application/json",
    cacheControl: "no-store",
  });
  if (error) throw error;
}

async function listJson<T>(prefix: string): Promise<T[]> {
  const store = await getStore();
  if (!store) return [];
  const { data, error } = await store.storage.from(BUCKET).list(prefix, { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  const files = (data ?? []).filter((item) => item.name.endsWith(".json"));
  const items = await Promise.all(files.map((item) => readJson<T>(`${prefix}/${item.name}`)));
  return items.reduce<T[]>((available, item) => {
    if (item !== undefined) available.push(item);
    return available;
  }, []);
}

function metadataString(user: SupabaseAuthUser, key: "name" | "matricNumber") {
  const value = user.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function profileFromAuthUser(user: SupabaseAuthUser, previous?: RemoteProfile): RemoteProfile | undefined {
  const matricNumber = previous?.matricNumber ?? metadataString(user, "matricNumber")?.toUpperCase();
  if (!matricNumber) return undefined;
  const timestamp = now();
  return {
    subject: user.id,
    name: previous?.name ?? metadataString(user, "name") ?? user.email ?? "University user",
    email: user.email ?? previous?.email ?? null,
    matricNumber,
    role: previous?.role ?? "user",
    publicKey: previous?.publicKey ?? null,
    lastSeenAt: previous?.lastSeenAt ?? null,
    isOnline: previous?.isOnline ?? false,
    createdAt: previous?.createdAt ?? user.created_at ?? timestamp,
    updatedAt: timestamp,
    lastSignedIn: timestamp,
  };
}

function profileToUser(profile: RemoteProfile): User {
  return {
    id: numericId(profile.subject),
    openId: `supabase:${profile.subject}`,
    name: profile.name,
    email: profile.email,
    universityEmail: profile.email,
    matricNumber: profile.matricNumber,
    passwordHash: null,
    loginMethod: "supabase-email",
    role: profile.role,
    publicKey: profile.publicKey,
    lastSeenAt: asDate(profile.lastSeenAt),
    isOnline: profile.isOnline,
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt),
    lastSignedIn: new Date(profile.lastSignedIn),
  };
}

async function listAuthUsers() {
  const store = await getStore();
  if (!store) return [];
  const { data, error } = await store.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users;
}

async function findSubjectByNumericId(id: number) {
  const users = await listAuthUsers();
  return users.find((user) => numericId(user.id) === id)?.id;
}

async function ensureProfile(input: { openId: string; email: string | null; name: string; matricNumber: string }) {
  const subject = subjectFromOpenId(input.openId);
  const previous = await readJson<RemoteProfile>(profilePath(subject));
  const timestamp = now();
  const profile: RemoteProfile = {
    subject,
    name: input.name,
    email: input.email,
    matricNumber: input.matricNumber.toUpperCase(),
    role: previous?.role ?? "user",
    publicKey: previous?.publicKey ?? null,
    lastSeenAt: previous?.lastSeenAt ?? null,
    isOnline: previous?.isOnline ?? false,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
    lastSignedIn: timestamp,
  };
  await writeJson(profilePath(subject), profile);
  return profile;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId || !user.matricNumber) throw new Error("SecureChat user identity is required");
  await ensureProfile({
    openId: user.openId,
    email: user.email ?? user.universityEmail ?? null,
    name: user.name ?? user.email ?? "University user",
    matricNumber: user.matricNumber,
  });
}

export async function getUserByOpenId(openId: string) {
  const profile = await readJson<RemoteProfile>(profilePath(subjectFromOpenId(openId)));
  return profile ? profileToUser(profile) : undefined;
}

export function selectSupabaseProfile<T>(byOpenId: T | undefined, byMatricNumber: T | undefined, byEmail: T | undefined) {
  return byOpenId ?? byMatricNumber ?? byEmail;
}

export async function getOrCreateSupabaseUser(input: { openId: string; email: string | null; name: string; matricNumber: string }) {
  return profileToUser(await ensureProfile(input));
}

export async function getUserById(id: number) {
  const subject = await findSubjectByNumericId(id);
  if (!subject) return undefined;
  const stored = await readJson<RemoteProfile>(profilePath(subject));
  if (stored) return profileToUser(stored);
  const authUser = (await listAuthUsers()).find((user) => user.id === subject);
  const profile = authUser ? profileFromAuthUser(authUser) : undefined;
  return profile ? profileToUser(profile) : undefined;
}

export async function getUserByMatricNumber(matricNumber: string) {
  const normalized = matricNumber.trim().toUpperCase();
  const users = await listAuthUsers();
  const authUser = users.find((user) => metadataString(user, "matricNumber")?.toUpperCase() === normalized);
  if (!authUser) return undefined;
  const stored = await readJson<RemoteProfile>(profilePath(authUser.id));
  const profile = stored ?? profileFromAuthUser(authUser);
  return profile ? profileToUser(profile) : undefined;
}

export async function getUserByUniversityEmail(email: string) {
  return getUserByEmail(email);
}

export async function getUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const users = await listAuthUsers();
  const authUser = users.find((user) => user.email?.toLowerCase() === normalized);
  if (!authUser) return undefined;
  const stored = await readJson<RemoteProfile>(profilePath(authUser.id));
  const profile = stored ?? profileFromAuthUser(authUser);
  return profile ? profileToUser(profile) : undefined;
}

export async function createLocalUser() {
  throw new Error("Local password profiles are not supported; SecureChat uses Supabase Auth.");
}

export async function searchUsers(currentUserId: number, query: string) {
  const needle = query.trim().toLowerCase();
  const authUsers = await listAuthUsers();
  const results: Array<User | undefined> = await Promise.all(authUsers.slice(0, 1000).map(async (authUser) => {
    const stored = await readJson<RemoteProfile>(profilePath(authUser.id));
    const profile = stored ?? profileFromAuthUser(authUser);
    return profile ? profileToUser(profile) : undefined;
  }));
  const profiles = results.filter((profile): profile is User => profile !== undefined);
  return profiles.filter((profile) => profile.id !== currentUserId)
    .filter((profile) => !needle || `${profile.name ?? ""} ${profile.email ?? ""} ${profile.matricNumber}`.toLowerCase().includes(needle))
    .slice(0, 30)
    .map((profile) => ({ id: profile.id, name: profile.name, email: profile.email, publicKey: profile.publicKey, isOnline: profile.isOnline, lastSeenAt: profile.lastSeenAt }));
}

async function updateProfileForUserId(userId: number, update: (profile: RemoteProfile) => RemoteProfile) {
  const subject = await findSubjectByNumericId(userId);
  if (!subject) throw new Error("SecureChat user profile was not found");
  const existing = await readJson<RemoteProfile>(profilePath(subject));
  if (!existing) throw new Error("SecureChat user profile is unavailable");
  const profile = update(existing);
  await writeJson(profilePath(subject), profile);
  return profile;
}

export async function setUserPresence(userId: number, online: boolean) {
  await updateProfileForUserId(userId, (profile) => ({ ...profile, isOnline: online, lastSeenAt: now(), updatedAt: now() }));
}

export async function setPublicKey(userId: number, publicKey: string) {
  await updateProfileForUserId(userId, (profile) => ({ ...profile, publicKey, updatedAt: now() }));
}

async function getConversationInfo(conversationId: number) {
  return readJson<ConversationInfo>(conversationInfoPath(conversationId));
}

async function subjectForUserId(userId: number) {
  const subject = await findSubjectByNumericId(userId);
  if (!subject) throw new Error("SecureChat user profile was not found");
  return subject;
}

export async function userIsParticipant(userId: number, conversationId: number) {
  const subject = await subjectForUserId(userId);
  const conversation = await getConversationInfo(conversationId);
  return Boolean(conversation?.participants.includes(subject));
}

async function assertParticipant(userId: number, conversationId: number) {
  if (!(await userIsParticipant(userId, conversationId))) throw new Error("Unauthorized conversation access");
}

async function writeConversationIndex(subject: string, index: ConversationIndex) {
  await writeJson(conversationIndexPath(subject, index.conversationId), index);
}

export async function getOrCreateDirectConversation(userId: number, otherUserId: number) {
  if (userId === otherUserId) throw new Error("You cannot start a conversation with yourself");
  const subject = await subjectForUserId(userId);
  const otherSubject = await subjectForUserId(otherUserId);
  const conversationId = directConversationId(subject, otherSubject);
  const existing = await getConversationInfo(conversationId);
  const timestamp = now();
  const conversation: ConversationInfo = existing ?? {
    id: conversationId,
    participants: [subject, otherSubject].sort() as [string, string],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  if (!existing) await writeJson(conversationInfoPath(conversationId), conversation);
  await Promise.all([
    writeConversationIndex(subject, { conversationId, peerSubject: otherSubject, createdAt: conversation.createdAt, updatedAt: timestamp, latestMessageAt: null }),
    writeConversationIndex(otherSubject, { conversationId, peerSubject: subject, createdAt: conversation.createdAt, updatedAt: timestamp, latestMessageAt: null }),
  ]);
  return conversationId;
}

export async function listConversations(userId: number) {
  const subject = await subjectForUserId(userId);
  const indexes = await listJson<ConversationIndex>(`inboxes/${subject}/conversations`);
  const items = await Promise.all(indexes.map(async (index) => ({
    conversationId: index.conversationId,
    peer: await getUserByOpenId(`supabase:${index.peerSubject}`),
    latestMessageAt: asDate(index.latestMessageAt),
  })));
  return items.filter((item) => Boolean(item.peer)).sort((a, b) => (b.latestMessageAt?.getTime() ?? 0) - (a.latestMessageAt?.getTime() ?? 0));
}

function materializeMessage(message: StoredMessage) {
  return {
    ...message,
    createdAt: new Date(message.createdAt),
    deliveredAt: asDate(message.deliveredAt),
    readAt: asDate(message.readAt),
  };
}

export async function listEncryptedMessages(userId: number, conversationId: number) {
  await assertParticipant(userId, conversationId);
  const messages = await listJson<StoredMessage>(`conversations/${conversationId}/messages`);
  return messages.sort((first, second) => first.createdAt.localeCompare(second.createdAt)).map(materializeMessage);
}

function messageId() {
  return Date.now() * 1000 + randomInt(0, 1000);
}

export async function createEncryptedMessage(input: { userId: number; conversationId: number; ciphertext: string; iv: string; keyVersion?: string }) {
  await assertParticipant(input.userId, input.conversationId);
  const senderSubject = await subjectForUserId(input.userId);
  const conversation = await getConversationInfo(input.conversationId);
  if (!conversation) throw new Error("Conversation was not found");
  const id = messageId();
  const timestamp = now();
  const message: StoredMessage = {
    id,
    conversationId: input.conversationId,
    senderId: input.userId,
    senderSubject,
    ciphertext: input.ciphertext,
    iv: input.iv,
    keyVersion: input.keyVersion ?? "v1",
    createdAt: timestamp,
    deliveredAt: null,
    readAt: null,
  };
  const recipients = conversation.participants.filter((subject) => subject !== senderSubject);
  await writeJson(messagePath(input.conversationId, id), message);
  await Promise.all(conversation.participants.map((subject) => writeJson(messageIndexPath(subject, id), { conversationId: input.conversationId })));
  await Promise.all(conversation.participants.map((subject) => writeConversationIndex(subject, {
    conversationId: input.conversationId,
    peerSubject: subject === senderSubject ? recipients[0] : senderSubject,
    createdAt: conversation.createdAt,
    updatedAt: timestamp,
    latestMessageAt: timestamp,
  })));
  await Promise.all(recipients.map(async (recipient) => {
    const notification = notificationFor("new-message");
    const value: StoredNotification = { id, userSubject: recipient, type: notification.type, title: notification.title, body: "A protected message is waiting in SecureChat.", conversationId: input.conversationId, isRead: false, createdAt: timestamp };
    await writeJson(notificationPath(recipient, id), value);
  }));
  return { messageId: id };
}

export async function updateMessageStatus(userId: number, messageIdValue: number, status: "delivered" | "read") {
  const subject = await subjectForUserId(userId);
  const index = await readJson<{ conversationId: number }>(messageIndexPath(subject, messageIdValue));
  if (!index) throw new Error("Message was not found");
  await assertParticipant(userId, index.conversationId);
  const message = await readJson<StoredMessage>(messagePath(index.conversationId, messageIdValue));
  if (!message) throw new Error("Message was not found");
  if (message.senderId === userId) return;
  const nextStatus = advanceMessageStatus(message.readAt ? "read" : message.deliveredAt ? "delivered" : "sent", status);
  const timestamp = now();
  const updated: StoredMessage = { ...message, deliveredAt: nextStatus === "delivered" || nextStatus === "read" ? timestamp : message.deliveredAt, readAt: nextStatus === "read" ? timestamp : message.readAt };
  await writeJson(messagePath(index.conversationId, messageIdValue), updated);
}

function materializeNotification(notification: StoredNotification) {
  return { ...notification, userId: numericId(notification.userSubject), createdAt: new Date(notification.createdAt) };
}

export async function listNotifications(userId: number) {
  const subject = await subjectForUserId(userId);
  const notifications = await listJson<StoredNotification>(`inboxes/${subject}/notifications`);
  return notifications.sort((first, second) => second.createdAt.localeCompare(first.createdAt)).slice(0, 30).map(materializeNotification);
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const subject = await subjectForUserId(userId);
  const notification = await readJson<StoredNotification>(notificationPath(subject, notificationId));
  if (!notification || notification.userSubject !== subject) return;
  await writeJson(notificationPath(subject, notificationId), { ...notification, isRead: true });
}
