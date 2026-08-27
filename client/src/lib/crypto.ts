const IDENTITY_KEY = "securechat.identity.v1";
const CONVERSATION_KEY_PREFIX = "securechat.conversation-key.";
const GROUP_KEY_PREFIX = "securechat.group-key.";

type Identity = { publicKey: JsonWebKey; privateKey: JsonWebKey };

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function getIdentity(): Promise<Identity> {
  const existing = localStorage.getItem(IDENTITY_KEY);
  if (existing) return JSON.parse(existing) as Identity;
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const identity = {
    publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey),
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export async function ensureIdentity() {
  const identity = await getIdentity();
  return JSON.stringify(identity.publicKey);
}

export async function prepareGroupKey(peerPublicKeys: Record<string, string>) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  const encodedKey = toBase64(raw);
  const ownerPublicKey = await ensureIdentity();
  const envelopes = await Promise.all(Object.entries(peerPublicKeys).map(async ([subject, publicKey]) => {
    const peerKey = await conversationKey(0, publicKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, peerKey, raw);
    return [subject, { ciphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv), ownerPublicKey }] as const;
  }));
  // `key` confirms the raw group secret is a valid AES-GCM key before any envelope is sent.
  await crypto.subtle.exportKey("raw", key);
  return { encodedKey, envelopes: Object.fromEntries(envelopes) };
}

export function saveGroupKey(conversationId: number, encodedKey: string, keyVersion = "v1") {
  localStorage.setItem(`${GROUP_KEY_PREFIX}${conversationId}.${keyVersion}`, encodedKey);
}

async function groupConversationKey(conversationId: number, keyVersion: string, envelope?: { ciphertext: string; iv: string; ownerPublicKey: string } | null) {
  const storageKey = `${GROUP_KEY_PREFIX}${conversationId}.${keyVersion}`;
  const cached = localStorage.getItem(storageKey);
  if (cached) return crypto.subtle.importKey("raw", fromBase64(cached), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  if (!envelope) throw new Error("This device does not have the encrypted key for this group");
  const peerKey = await conversationKey(0, envelope.ownerPublicKey);
  const raw = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv) }, peerKey, fromBase64(envelope.ciphertext)));
  localStorage.setItem(storageKey, toBase64(raw));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptBytesWithKey(key: CryptoKey, bytes: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = Uint8Array.from(bytes);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  return { ciphertext: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}

async function decryptBytesWithKey(key: CryptoKey, ciphertext: string, iv: string) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(ciphertext)));
}

async function conversationKey(conversationId: number, peerPublicKey: string) {
  const storageKey = `${CONVERSATION_KEY_PREFIX}${conversationId}.${btoa(peerPublicKey).replaceAll("/", "_")}`;
  const cached = localStorage.getItem(storageKey);
  if (cached) return crypto.subtle.importKey("raw", fromBase64(cached), "AES-GCM", false, ["encrypt", "decrypt"]);

  const identity = await getIdentity();
  const privateKey = await crypto.subtle.importKey("jwk", identity.privateKey, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  const publicKey = await crypto.subtle.importKey("jwk", JSON.parse(peerPublicKey) as JsonWebKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const key = await crypto.subtle.deriveKey({ name: "ECDH", public: publicKey }, privateKey, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  localStorage.setItem(storageKey, toBase64(raw));
  return key;
}

export async function encryptMessage(conversationId: number, peerPublicKey: string, plaintext: string) {
  const key = await conversationKey(conversationId, peerPublicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { ciphertext: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}

export async function decryptMessage(conversationId: number, peerPublicKey: string, ciphertext: string, iv: string) {
  const key = await conversationKey(conversationId, peerPublicKey);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(ciphertext));
  return new TextDecoder().decode(decrypted);
}

export async function encryptGroupMessage(conversationId: number, plaintext: string, envelope?: { ciphertext: string; iv: string; ownerPublicKey: string } | null, keyVersion = "v1") {
  const key = await groupConversationKey(conversationId, keyVersion, envelope);
  return encryptBytesWithKey(key, new TextEncoder().encode(plaintext));
}

export async function decryptGroupMessage(conversationId: number, ciphertext: string, iv: string, envelope?: { ciphertext: string; iv: string; ownerPublicKey: string } | null, keyVersion = "v1") {
  const key = await groupConversationKey(conversationId, keyVersion, envelope);
  return new TextDecoder().decode(await decryptBytesWithKey(key, ciphertext, iv));
}

export async function encryptAttachment(conversationId: number, peerPublicKey: string, bytes: Uint8Array, groupEnvelope?: { ciphertext: string; iv: string; ownerPublicKey: string } | null, groupKeyVersion = "v1") {
  const key = groupEnvelope ? await groupConversationKey(conversationId, groupKeyVersion, groupEnvelope) : await conversationKey(conversationId, peerPublicKey);
  return encryptBytesWithKey(key, bytes);
}

export async function decryptAttachment(conversationId: number, peerPublicKey: string, ciphertext: string, iv: string, groupEnvelope?: { ciphertext: string; iv: string; ownerPublicKey: string } | null, groupKeyVersion = "v1") {
  const key = groupEnvelope ? await groupConversationKey(conversationId, groupKeyVersion, groupEnvelope) : await conversationKey(conversationId, peerPublicKey);
  return decryptBytesWithKey(key, ciphertext, iv);
}

export function isEncryptedPayload(value: string) {
  try { return fromBase64(value).length > 16; } catch { return false; }
}
