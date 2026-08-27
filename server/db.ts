import { createHash, randomInt } from "node:crypto";
import { createClient, type SupabaseClient, type User as SupabaseAuthUser } from "@supabase/supabase-js";
import type { InsertUser, User } from "../drizzle/schema.js";
import { advanceMessageStatus, notificationFor } from "../shared/message-lifecycle.js";

const BUCKET = "securechat-private-v1";
const MAX_ENCRYPTED_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_PROFILE_IMAGE_BYTES = 512 * 1024;

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
  username: string;
  email: string | null;
  matricNumber: string;
  role: "user" | "admin";
  publicKey: string | null;
  readReceiptsEnabled: boolean;
  avatarStyle: "ink" | "mint" | "rose" | "violet";
  profileImagePath: string | null;
  profileImageType: "image/jpeg" | "image/png" | "image/webp" | null;
  lastSeenAt: string | null;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
};

type ConversationInfo = {
  id: number;
  kind: "direct" | "group";
  title: string | null;
  participants: string[];
  ownerSubject: string;
  groupKeyVersion: string;
  groupKeyEnvelopes: Record<string, { ciphertext: string; iv: string; ownerPublicKey: string }>;
  groupKeyEnvelopesByVersion: Record<string, Record<string, { ciphertext: string; iv: string; ownerPublicKey: string }>>;
  createdAt: string;
  updatedAt: string;
};

type ConversationIndex = {
  conversationId: number;
  peerSubject: string;
  kind: "direct" | "group";
  title: string | null;
  createdAt: string;
  updatedAt: string;
  latestMessageAt: string | null;
  pinned: boolean;
  muted: boolean;
  hidden: boolean;
};

type StoredMessageRequest = {
  id: number;
  senderSubject: string;
  recipientSubject: string;
  createdAt: string;
  status: "pending" | "accepted" | "declined" | "blocked";
};

type BlockRecord = {
  subject: string;
  blockedSubject: string;
  createdAt: string;
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
  attachment: {
    id: number;
    name: string;
    mediaType: string;
    size: number;
    ciphertextPath: string;
    iv: string;
    kind: "file" | "voice";
  } | null;
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
  const options = {
    public: false,
    fileSizeLimit: String(MAX_ENCRYPTED_ATTACHMENT_BYTES),
    allowedMimeTypes: ["application/json", "application/octet-stream", "image/jpeg", "image/png", "image/webp"],
  };
  if (!existing.error) {
    const updated = await client.storage.updateBucket(BUCKET, options);
    if (updated.error) throw updated.error;
    return;
  }
  const created = await client.storage.createBucket(BUCKET, options);
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

function attachmentPath(conversationId: number, attachmentId: number) {
  return `attachments/${conversationId}/${attachmentId}.bin`;
}

function profileImagePath(subject: string, imageId: number) {
  return `profile-images/${subject}/${imageId}.bin`;
}

function messageIndexPath(subject: string, messageId: number) {
  return `inboxes/${subject}/messages/${messageId}.json`;
}

function notificationPath(subject: string, notificationId: number) {
  return `inboxes/${subject}/notifications/${notificationId}.json`;
}

function messageRequestPath(subject: string, requestId: number) {
  return `inboxes/${subject}/requests/${requestId}.json`;
}

function blockPath(subject: string, blockedSubject: string) {
  return `inboxes/${subject}/blocks/${blockedSubject}.json`;
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

async function writeBinary(path: string, bytes: Uint8Array, contentType = "application/octet-stream") {
  const store = await getStore();
  if (!store) throw new Error("SecureChat private storage is unavailable");
  const { error } = await store.storage.from(BUCKET).upload(path, bytes, {
    upsert: false,
    contentType,
    cacheControl: "no-store",
  });
  if (error) throw error;
}

async function readBinary(path: string) {
  const store = await getStore();
  if (!store) throw new Error("SecureChat private storage is unavailable");
  const { data, error } = await store.storage.from(BUCKET).download(path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
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

function metadataString(user: SupabaseAuthUser, key: "name" | "username" | "matricNumber") {
  const value = user.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedUsername(value: string | null | undefined, subject: string) {
  const cleaned = (value ?? "").trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 24);
  if (cleaned.length >= 3) return cleaned;
  return `user${createHash("sha256").update(subject).digest("hex").slice(0, 6)}`;
}

function profileFromAuthUser(user: SupabaseAuthUser, previous?: RemoteProfile): RemoteProfile | undefined {
  const matricNumber = previous?.matricNumber ?? metadataString(user, "matricNumber")?.toUpperCase();
  if (!matricNumber) return undefined;
  const timestamp = now();
  return {
    subject: user.id,
    name: previous?.name ?? metadataString(user, "name") ?? user.email ?? "University user",
    username: previous?.username ?? normalizedUsername(metadataString(user, "username"), user.id),
    email: user.email ?? previous?.email ?? null,
    matricNumber,
    role: previous?.role ?? "user",
    publicKey: previous?.publicKey ?? null,
    readReceiptsEnabled: previous?.readReceiptsEnabled ?? true,
    avatarStyle: previous?.avatarStyle ?? "mint",
    profileImagePath: previous?.profileImagePath ?? null,
    profileImageType: previous?.profileImageType ?? null,
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
    username: profile.username ?? normalizedUsername(profile.name, profile.subject),
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

async function ensureProfile(input: { openId: string; email: string | null; name: string; username?: string | null; matricNumber: string }) {
  const subject = subjectFromOpenId(input.openId);
  const previous = await readJson<RemoteProfile>(profilePath(subject));
  const timestamp = now();
  const profile: RemoteProfile = {
    subject,
    name: previous?.name ?? input.name,
    username: previous?.username ?? normalizedUsername(input.username, subject),
    email: input.email,
    matricNumber: input.matricNumber.toUpperCase(),
    role: previous?.role ?? "user",
    publicKey: previous?.publicKey ?? null,
    readReceiptsEnabled: previous?.readReceiptsEnabled ?? true,
    avatarStyle: previous?.avatarStyle ?? "mint",
    profileImagePath: previous?.profileImagePath ?? null,
    profileImageType: previous?.profileImageType ?? null,
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
    username: user.username,
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

export async function getOrCreateSupabaseUser(input: { openId: string; email: string | null; name: string; username?: string | null; matricNumber: string }) {
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
  const currentSubject = await findSubjectByNumericId(currentUserId);
  const authUsers = await listAuthUsers();
  const results: Array<User | undefined> = await Promise.all(authUsers.slice(0, 1000).map(async (authUser) => {
    const stored = await readJson<RemoteProfile>(profilePath(authUser.id));
    const profile = stored ?? profileFromAuthUser(authUser);
    return profile ? profileToUser(profile) : undefined;
  }));
  const profiles = results.filter((profile): profile is User => profile !== undefined);
  const discoverableProfiles = profiles.filter((profile) => isDiscoverableProfile(profile, currentUserId, needle)).slice(0, 30);
  return Promise.all(discoverableProfiles.map(async (profile) => {
    const subject = subjectFromOpenId(profile.openId);
    const request = currentSubject ? await readJson<StoredMessageRequest>(messageRequestPath(subject, directConversationId(currentSubject, subject))) : undefined;
    const friendRequestStatus = currentSubject && request?.senderSubject === currentSubject ? request.status : null;
    const storedProfile = await readJson<RemoteProfile>(profilePath(subject));
    return { id: profile.id, subject, name: profile.name, username: profile.username ?? normalizedUsername(profile.name, subject), avatarStyle: storedProfile?.avatarStyle ?? "mint", publicKey: profile.publicKey, isOnline: profile.isOnline, lastSeenAt: profile.lastSeenAt, friendRequestStatus };
  }));
}

export function isDiscoverableProfile(profile: Pick<User, "id" | "name" | "username" | "email" | "matricNumber">, currentUserId: number, query: string) {
  const needle = query.trim().toLowerCase().replace(/^@+/, "");
  if (profile.id === currentUserId) return false;
  return !needle || `${profile.name ?? ""} ${profile.username ?? ""} ${profile.email ?? ""} ${profile.matricNumber}`.toLowerCase().includes(needle);
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

export async function getProfileSettings(userId: number) {
  const subject = await subjectForUserId(userId);
  const profile = await readJson<RemoteProfile>(profilePath(subject));
  if (!profile) throw new Error("SecureChat profile is unavailable");
  const store = await getStore();
  const image = profile.profileImagePath && store ? await store.storage.from(BUCKET).createSignedUrl(profile.profileImagePath, 60 * 15) : null;
  return {
    name: profile.name,
    username: profile.username ?? normalizedUsername(profile.name, profile.subject),
    email: profile.email,
    matricNumber: profile.matricNumber,
    readReceiptsEnabled: profile.readReceiptsEnabled ?? true,
    avatarStyle: profile.avatarStyle ?? "mint",
    profileImageUrl: image?.error ? null : image?.data?.signedUrl ?? null,
  };
}

export async function updateProfileSettings(userId: number, input: { name: string; username?: string; avatarStyle: RemoteProfile["avatarStyle"]; imageData?: string | null; imageType?: NonNullable<RemoteProfile["profileImageType"]> | null; clearImage?: boolean }) {
  let imagePath: string | null | undefined;
  let imageType: RemoteProfile["profileImageType"] | undefined;
  if (input.imageData) {
    if (!input.imageType) throw new Error("Profile image type is required");
    const bytes = Buffer.from(input.imageData, "base64");
    if (!bytes.byteLength || bytes.byteLength > MAX_PROFILE_IMAGE_BYTES) throw new Error("Profile image must be 512 KB or smaller");
    const subject = await subjectForUserId(userId);
    imagePath = profileImagePath(subject, Date.now());
    await writeBinary(imagePath, bytes, input.imageType);
    imageType = input.imageType;
  } else if (input.clearImage) {
    imagePath = null;
    imageType = null;
  }
  const profile = await updateProfileForUserId(userId, (current) => ({
    ...current,
    name: input.name.trim(),
    username: normalizedUsername(input.username ?? current.username, current.subject),
    avatarStyle: input.avatarStyle,
    profileImagePath: imagePath === undefined ? current.profileImagePath : imagePath,
    profileImageType: imageType === undefined ? current.profileImageType : imageType,
    updatedAt: now(),
  }));
  return { name: profile.name, username: profile.username, avatarStyle: profile.avatarStyle, profileImageUpdated: imagePath !== undefined };
}

export async function getFriendProfile(userId: number, otherUserId: number) {
  if (userId === otherUserId) throw new Error("This profile is unavailable");
  await assertDirectContactAllowed(userId, otherUserId);
  const [viewerSubject, profile] = await Promise.all([subjectForUserId(userId), getUserById(otherUserId)]);
  if (!profile) throw new Error("This profile is unavailable");
  const subject = subjectFromOpenId(profile.openId);
  const conversationId = directConversationId(viewerSubject, subject);
  const [conversation, request, storedProfile] = await Promise.all([
    getConversationInfo(conversationId),
    readJson<StoredMessageRequest>(messageRequestPath(subject, conversationId)),
    readJson<RemoteProfile>(profilePath(subject)),
  ]);
  const relationship = conversation?.kind === "direct" && conversation.participants.includes(viewerSubject) ? "friends" as const : request?.senderSubject === viewerSubject && request.status === "pending" ? "pending" as const : "none" as const;
  return { id: profile.id, name: profile.name, username: profile.username ?? normalizedUsername(profile.name, subject), avatarStyle: storedProfile?.avatarStyle ?? "mint", isOnline: profile.isOnline, lastSeenAt: profile.lastSeenAt, relationship };
}

export async function updatePrivacySettings(userId: number, input: { readReceiptsEnabled: boolean }) {
  const profile = await updateProfileForUserId(userId, (current) => ({
    ...current,
    readReceiptsEnabled: input.readReceiptsEnabled,
    updatedAt: now(),
  }));
  return { readReceiptsEnabled: profile.readReceiptsEnabled };
}

async function isBlocked(subject: string, blockedSubject: string) {
  const record = await readJson<BlockRecord>(blockPath(subject, blockedSubject));
  return record?.subject === subject && record.blockedSubject === blockedSubject;
}

export async function isDirectContactBlocked(firstUserId: number, secondUserId: number) {
  const [firstSubject, secondSubject] = await Promise.all([subjectForUserId(firstUserId), subjectForUserId(secondUserId)]);
  return (await isBlocked(firstSubject, secondSubject)) || (await isBlocked(secondSubject, firstSubject));
}

async function assertDirectContactAllowed(firstUserId: number, secondUserId: number) {
  if (await isDirectContactBlocked(firstUserId, secondUserId)) throw new Error("This contact is unavailable");
}

export async function listMessageRequests(userId: number) {
  const recipientSubject = await subjectForUserId(userId);
  const requests = await listJson<StoredMessageRequest>(`inboxes/${recipientSubject}/requests`);
  const pending = requests.filter((request) => request.status === "pending").sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  return Promise.all(pending.map(async (request) => ({
    id: request.id,
    createdAt: new Date(request.createdAt),
    sender: await getUserByOpenId(`supabase:${request.senderSubject}`),
  }))).then((items) => items.filter((item): item is { id: number; createdAt: Date; sender: User } => Boolean(item.sender)));
}

export function friendRequestResult(existingStatus?: StoredMessageRequest["status"]) {
  return { status: "pending" as const, alreadyPending: existingStatus === "pending" };
}

export async function createMessageRequest(userId: number, otherUserId: number) {
  if (userId === otherUserId) throw new Error("You cannot message yourself");
  await assertDirectContactAllowed(userId, otherUserId);
  const [senderSubject, recipientSubject] = await Promise.all([subjectForUserId(userId), subjectForUserId(otherUserId)]);
  const id = directConversationId(senderSubject, recipientSubject);
  const existing = await readJson<StoredMessageRequest>(messageRequestPath(recipientSubject, id));
  if (existing?.status === "pending") return { requestId: id, ...friendRequestResult(existing.status) };
  const request: StoredMessageRequest = { id, senderSubject, recipientSubject, createdAt: now(), status: "pending" };
  await writeJson(messageRequestPath(recipientSubject, id), request);
  return { requestId: id, ...friendRequestResult() };
}

export async function respondToMessageRequest(userId: number, requestId: number, action: "accept" | "decline") {
  const recipientSubject = await subjectForUserId(userId);
  const request = await readJson<StoredMessageRequest>(messageRequestPath(recipientSubject, requestId));
  if (!request || request.recipientSubject !== recipientSubject || request.status !== "pending") throw new Error("Friend request is unavailable");
  const nextStatus = action === "accept" ? "accepted" : "declined";
  await writeJson(messageRequestPath(recipientSubject, requestId), { ...request, status: nextStatus });
  if (action === "decline") return { conversationId: null };
  const senderId = numericId(request.senderSubject);
  return { conversationId: await getOrCreateDirectConversation(userId, senderId) };
}

export async function blockUser(userId: number, otherUserId: number) {
  if (userId === otherUserId) throw new Error("You cannot block yourself");
  const [subject, blockedSubject] = await Promise.all([subjectForUserId(userId), subjectForUserId(otherUserId)]);
  await writeJson(blockPath(subject, blockedSubject), { subject, blockedSubject, createdAt: now() } satisfies BlockRecord);
}

export async function unblockUser(userId: number, otherUserId: number) {
  const [subject, blockedSubject] = await Promise.all([subjectForUserId(userId), subjectForUserId(otherUserId)]);
  const current = await readJson<BlockRecord>(blockPath(subject, blockedSubject));
  if (current) await writeJson(blockPath(subject, blockedSubject), { ...current, blockedSubject: "released", subject: "released" });
}

export async function listBlockedUsers(userId: number) {
  const subject = await subjectForUserId(userId);
  const records = await listJson<BlockRecord>(`inboxes/${subject}/blocks`);
  return Promise.all(records.filter((record) => record.subject === subject && record.blockedSubject !== "released").map(async (record) => getUserByOpenId(`supabase:${record.blockedSubject}`))).then((profiles) => profiles.filter((profile): profile is User => Boolean(profile)));
}

export async function setConversationPreference(userId: number, conversationId: number, preference: "pinned" | "muted" | "hidden", value: boolean) {
  const subject = await subjectForUserId(userId);
  const current = await readJson<ConversationIndex>(conversationIndexPath(subject, conversationId));
  if (!current) throw new Error("Conversation is unavailable");
  await writeConversationIndex(subject, { ...current, [preference]: value, updatedAt: now() });
}

async function getConversationInfo(conversationId: number) {
  const conversation = await readJson<ConversationInfo>(conversationInfoPath(conversationId));
  if (!conversation) return undefined;
  return {
    ...conversation,
    kind: conversation.kind ?? "direct",
    title: conversation.title ?? null,
    ownerSubject: conversation.ownerSubject ?? conversation.participants[0] ?? "",
    groupKeyVersion: conversation.groupKeyVersion ?? "v1",
    groupKeyEnvelopes: conversation.groupKeyEnvelopes ?? {},
    groupKeyEnvelopesByVersion: conversation.groupKeyEnvelopesByVersion ?? { [conversation.groupKeyVersion ?? "v1"]: conversation.groupKeyEnvelopes ?? {} },
  };
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

async function upsertConversationIndex(subject: string, index: Omit<ConversationIndex, "pinned" | "muted" | "hidden"> & Partial<Pick<ConversationIndex, "pinned" | "muted" | "hidden">>) {
  const existing = await readJson<ConversationIndex>(conversationIndexPath(subject, index.conversationId));
  await writeConversationIndex(subject, {
    ...index,
    pinned: index.pinned ?? existing?.pinned ?? false,
    muted: index.muted ?? existing?.muted ?? false,
    hidden: index.hidden ?? false,
  });
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
    kind: "direct",
    title: null,
    participants: [subject, otherSubject].sort(),
    ownerSubject: subject,
    groupKeyVersion: "v1",
    groupKeyEnvelopes: {},
    groupKeyEnvelopesByVersion: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  if (!existing) await writeJson(conversationInfoPath(conversationId), conversation);
  await Promise.all([
    upsertConversationIndex(subject, { conversationId, peerSubject: otherSubject, kind: "direct", title: null, createdAt: conversation.createdAt, updatedAt: timestamp, latestMessageAt: null, hidden: false }),
    upsertConversationIndex(otherSubject, { conversationId, peerSubject: subject, kind: "direct", title: null, createdAt: conversation.createdAt, updatedAt: timestamp, latestMessageAt: null, hidden: false }),
  ]);
  return conversationId;
}

export async function getAcceptedDirectConversation(userId: number, otherUserId: number) {
  await assertDirectContactAllowed(userId, otherUserId);
  const [subject, otherSubject] = await Promise.all([subjectForUserId(userId), subjectForUserId(otherUserId)]);
  const conversationId = directConversationId(subject, otherSubject);
  const conversation = await getConversationInfo(conversationId);
  if (!conversation || conversation.kind !== "direct" || !conversation.participants.includes(subject) || !conversation.participants.includes(otherSubject)) throw new Error("Accept the friend request before messaging");
  return conversationId;
}

export async function createGroupConversation(userId: number, input: { title: string; participantIds: number[]; groupKeyEnvelopes: Record<string, { ciphertext: string; iv: string; ownerPublicKey: string }> }) {
  const ownerSubject = await subjectForUserId(userId);
  const participantSubjects = Array.from(new Set([ownerSubject, ...(await Promise.all(input.participantIds.map(subjectForUserId)))]));
  if (participantSubjects.length < 3) throw new Error("A group needs at least three members");
  if (participantSubjects.length > 20) throw new Error("Groups are limited to 20 members");
  if (!input.title.trim()) throw new Error("Group name is required");
  if (participantSubjects.some((subject) => !input.groupKeyEnvelopes[subject])) throw new Error("Each group member needs an encrypted key envelope");
  const id = messageId();
  const timestamp = now();
  const conversation: ConversationInfo = {
    id,
    kind: "group",
    title: input.title.trim().slice(0, 80),
    participants: participantSubjects,
    ownerSubject,
    groupKeyVersion: "v1",
    groupKeyEnvelopes: input.groupKeyEnvelopes,
    groupKeyEnvelopesByVersion: { v1: input.groupKeyEnvelopes },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await writeJson(conversationInfoPath(id), conversation);
  await Promise.all(participantSubjects.map((subject) => upsertConversationIndex(subject, {
    conversationId: id,
    peerSubject: ownerSubject,
    kind: "group",
    title: conversation.title,
    createdAt: timestamp,
    updatedAt: timestamp,
    latestMessageAt: null,
    hidden: false,
  })));
  return id;
}

export async function addGroupParticipant(userId: number, input: { conversationId: number; userId: number; groupKeyEnvelopes: Record<string, { ciphertext: string; iv: string; ownerPublicKey: string }> }) {
  const subject = await subjectForUserId(userId);
  const newSubject = await subjectForUserId(input.userId);
  const conversation = await getConversationInfo(input.conversationId);
  if (!conversation || conversation.kind !== "group") throw new Error("Group conversation was not found");
  if (conversation.ownerSubject !== subject) throw new Error("Only the group creator can add members");
  if (conversation.participants.includes(newSubject)) return;
  const participants = [...conversation.participants, newSubject];
  if (participants.length > 20) throw new Error("Groups are limited to 20 members");
  if (participants.some((participant) => !input.groupKeyEnvelopes[participant])) throw new Error("Adding a member requires fresh encrypted key envelopes");
  const nextVersion = `v${Number(conversation.groupKeyVersion?.slice(1) ?? "1") + 1}`;
  const updated: ConversationInfo = { ...conversation, participants, groupKeyVersion: nextVersion, groupKeyEnvelopes: input.groupKeyEnvelopes, groupKeyEnvelopesByVersion: { ...(conversation.groupKeyEnvelopesByVersion ?? { [conversation.groupKeyVersion ?? "v1"]: conversation.groupKeyEnvelopes }), [nextVersion]: input.groupKeyEnvelopes }, updatedAt: now() };
  await writeJson(conversationInfoPath(input.conversationId), updated);
  await upsertConversationIndex(newSubject, {
    conversationId: input.conversationId,
    peerSubject: conversation.ownerSubject,
    kind: "group",
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: updated.updatedAt,
    latestMessageAt: null,
    hidden: false,
  });
  return { keyVersion: nextVersion };
}

export async function listGroupParticipants(userId: number, conversationId: number) {
  await assertParticipant(userId, conversationId);
  const conversation = await getConversationInfo(conversationId);
  if (!conversation || conversation.kind !== "group") throw new Error("Group conversation was not found");
  const profiles = await Promise.all(conversation.participants.map((subject) => getUserByOpenId(`supabase:${subject}`)));
  return profiles.filter((profile): profile is User => Boolean(profile)).map((profile) => ({
    id: profile.id,
    subject: subjectFromOpenId(profile.openId),
    name: profile.name,
    email: profile.email,
    publicKey: profile.publicKey,
    isOwner: subjectFromOpenId(profile.openId) === conversation.ownerSubject,
  }));
}

export async function listConversations(userId: number) {
  const subject = await subjectForUserId(userId);
  const indexes = await listJson<ConversationIndex>(`inboxes/${subject}/conversations`);
  const items = await Promise.all(indexes.filter((index) => !index.hidden).map(async (index) => ({
    conversationId: index.conversationId,
    kind: index.kind ?? "direct",
    title: index.title ?? null,
    pinned: index.pinned ?? false,
    muted: index.muted ?? false,
    peer: index.kind === "direct" ? await getUserByOpenId(`supabase:${index.peerSubject}`) : await getUserByOpenId(`supabase:${index.peerSubject}`),
    groupKeyVersion: (await getConversationInfo(index.conversationId))?.groupKeyVersion ?? "v1",
    groupKeyEnvelope: (await getConversationInfo(index.conversationId))?.groupKeyEnvelopes[subject] ?? null,
    groupKeyEnvelopes: Object.fromEntries(Object.entries((await getConversationInfo(index.conversationId))?.groupKeyEnvelopesByVersion ?? {}).map(([version, envelopes]) => [version, envelopes[subject] ?? null])),
    latestMessageAt: asDate(index.latestMessageAt),
  })));
  return items.filter((item) => Boolean(item.peer)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.latestMessageAt?.getTime() ?? 0) - (a.latestMessageAt?.getTime() ?? 0));
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

export async function uploadEncryptedAttachment(userId: number, input: { conversationId: number; ciphertext: string; iv: string; name: string; mediaType: string; size: number; kind: "file" | "voice" }) {
  await assertParticipant(userId, input.conversationId);
  const bytes = Buffer.from(input.ciphertext, "base64");
  if (!bytes.length || bytes.length > MAX_ENCRYPTED_ATTACHMENT_BYTES) throw new Error("Encrypted attachment must be smaller than 3 MB");
  if (input.size < 1 || input.size > MAX_ENCRYPTED_ATTACHMENT_BYTES) throw new Error("Attachment size is invalid");
  const id = messageId();
  const ciphertextPath = attachmentPath(input.conversationId, id);
  await writeBinary(ciphertextPath, bytes);
  return {
    id,
    name: input.name.trim().slice(0, 120) || (input.kind === "voice" ? "Voice note" : "Attachment"),
    mediaType: input.mediaType.trim().slice(0, 120) || "application/octet-stream",
    size: input.size,
    ciphertextPath,
    iv: input.iv,
    kind: input.kind,
  } satisfies NonNullable<StoredMessage["attachment"]>;
}

export async function downloadEncryptedAttachment(userId: number, input: { conversationId: number; attachmentId: number }) {
  await assertParticipant(userId, input.conversationId);
  const messages = await listJson<StoredMessage>(`conversations/${input.conversationId}/messages`);
  const attachment = messages.find((message) => message.attachment?.id === input.attachmentId)?.attachment;
  if (!attachment) throw new Error("Attachment was not found");
  const bytes = await readBinary(attachment.ciphertextPath);
  return {
    attachment,
    ciphertext: Buffer.from(bytes).toString("base64"),
  };
}

function messageId() {
  return Date.now() * 1000 + randomInt(0, 1000);
}

export async function createEncryptedMessage(input: { userId: number; conversationId: number; ciphertext: string; iv: string; keyVersion?: string; attachment?: NonNullable<StoredMessage["attachment"]> | null }) {
  await assertParticipant(input.userId, input.conversationId);
  const senderSubject = await subjectForUserId(input.userId);
  const conversation = await getConversationInfo(input.conversationId);
  if (!conversation) throw new Error("Conversation was not found");
  if (conversation.kind === "direct") {
    const recipientSubject = conversation.participants.find((subject) => subject !== senderSubject);
    if (!recipientSubject) throw new Error("Conversation recipient was not found");
    await assertDirectContactAllowed(input.userId, numericId(recipientSubject));
  }
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
    attachment: input.attachment ?? null,
  };
  const recipients = conversation.participants.filter((subject) => subject !== senderSubject);
  await writeJson(messagePath(input.conversationId, id), message);
  await Promise.all(conversation.participants.map((subject) => writeJson(messageIndexPath(subject, id), { conversationId: input.conversationId })));
  await Promise.all(conversation.participants.map((subject) => upsertConversationIndex(subject, {
    conversationId: input.conversationId,
    peerSubject: subject === senderSubject ? recipients[0] : senderSubject,
    kind: conversation.kind,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: timestamp,
    latestMessageAt: timestamp,
  })));
  await Promise.all(recipients.map(async (recipient) => {
    const recipientIndex = await readJson<ConversationIndex>(conversationIndexPath(recipient, input.conversationId));
    if (recipientIndex?.muted) return;
    const notification = notificationFor("new-message");
    const value: StoredNotification = { id, userSubject: recipient, type: notification.type, title: notification.title, body: "A protected message is waiting in SecureChat.", conversationId: input.conversationId, isRead: false, createdAt: timestamp };
    await writeJson(notificationPath(recipient, id), value);
  }));
  return { messageId: id };
}

export async function updateMessageStatus(userId: number, messageIdValue: number, status: "delivered" | "read") {
  const subject = await subjectForUserId(userId);
  const profile = await readJson<RemoteProfile>(profilePath(subject));
  if (profile?.readReceiptsEnabled === false) return;
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
