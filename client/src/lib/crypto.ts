const IDENTITY_KEY = "securechat.identity.v1";
const CONVERSATION_KEY_PREFIX = "securechat.conversation-key.";

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

export function isEncryptedPayload(value: string) {
  try { return fromBase64(value).length > 16; } catch { return false; }
}
