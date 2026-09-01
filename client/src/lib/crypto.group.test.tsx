// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptAttachment, decryptGroupMessage, encryptAttachment, encryptGroupMessage, ensureIdentity, exportEncryptedRecoveryBundle, importEncryptedRecoveryBundle, prepareGroupKey, saveGroupKey } from "./crypto";

const identityKey = "securechat.identity.v1";

function currentIdentity() {
  const identity = localStorage.getItem(identityKey);
  if (!identity) throw new Error("Identity was not created");
  return identity;
}

describe("SecureChat group and attachment encryption", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it("encrypts a group message with a recipient-specific key envelope", async () => {
    const alicePublicKey = await ensureIdentity();
    const aliceIdentity = currentIdentity();
    localStorage.removeItem(identityKey);
    const bobPublicKey = await ensureIdentity();
    const bobIdentity = currentIdentity();

    localStorage.setItem(identityKey, aliceIdentity);
    const { encodedKey, envelopes } = await prepareGroupKey({ alice: alicePublicKey, bob: bobPublicKey });
    saveGroupKey(410, encodedKey);
    const encrypted = await encryptGroupMessage(410, "Meeting moved to 4 PM", envelopes.alice);

    localStorage.clear();
    localStorage.setItem(identityKey, bobIdentity);
    await expect(decryptGroupMessage(410, encrypted.ciphertext, encrypted.iv, envelopes.bob)).resolves.toBe("Meeting moved to 4 PM");
  });

  it("keeps earlier group messages unavailable to a member added after key rotation", async () => {
    const alicePublicKey = await ensureIdentity();
    const aliceIdentity = currentIdentity();
    localStorage.removeItem(identityKey);
    const bobPublicKey = await ensureIdentity();
    const bobIdentity = currentIdentity();
    localStorage.removeItem(identityKey);
    const chikaPublicKey = await ensureIdentity();
    const chikaIdentity = currentIdentity();

    localStorage.setItem(identityKey, aliceIdentity);
    const first = await prepareGroupKey({ alice: alicePublicKey, bob: bobPublicKey });
    saveGroupKey(411, first.encodedKey, "v1");
    const earlierMessage = await encryptGroupMessage(411, "Only original members can read this", first.envelopes.alice, "v1");
    const second = await prepareGroupKey({ alice: alicePublicKey, bob: bobPublicKey, chika: chikaPublicKey });
    saveGroupKey(411, second.encodedKey, "v2");
    const laterMessage = await encryptGroupMessage(411, "Welcome to the group", second.envelopes.alice, "v2");

    localStorage.clear();
    localStorage.setItem(identityKey, bobIdentity);
    await expect(decryptGroupMessage(411, earlierMessage.ciphertext, earlierMessage.iv, first.envelopes.bob, "v1")).resolves.toContain("original members");
    await expect(decryptGroupMessage(411, laterMessage.ciphertext, laterMessage.iv, second.envelopes.bob, "v2")).resolves.toContain("Welcome");

    localStorage.clear();
    localStorage.setItem(identityKey, chikaIdentity);
    await expect(decryptGroupMessage(411, earlierMessage.ciphertext, earlierMessage.iv, null, "v1")).rejects.toThrow("encrypted key");
    await expect(decryptGroupMessage(411, laterMessage.ciphertext, laterMessage.iv, second.envelopes.chika, "v2")).resolves.toContain("Welcome");
  });

  it("restores the same identity from a passphrase-wrapped recovery bundle", async () => {
    const originalPublicKey = await ensureIdentity();
    const recovery = await exportEncryptedRecoveryBundle("correct horse battery staple");
    expect(recovery).not.toContain(JSON.parse(currentIdentity()).privateKey.d);
    localStorage.clear();
    await expect(importEncryptedRecoveryBundle(recovery, "wrong passphrase here")).rejects.toThrow("incorrect");
    await expect(importEncryptedRecoveryBundle(recovery, "correct horse battery staple")).resolves.toBe(originalPublicKey);
    expect(await ensureIdentity()).toBe(originalPublicKey);
  });

  it("encrypts and decrypts attachment bytes with the direct conversation key", async () => {
    const alicePublicKey = await ensureIdentity();
    const aliceIdentity = currentIdentity();
    localStorage.removeItem(identityKey);
    const bobPublicKey = await ensureIdentity();
    const bobIdentity = currentIdentity();
    const original = new TextEncoder().encode("encrypted course outline");

    localStorage.setItem(identityKey, aliceIdentity);
    const encrypted = await encryptAttachment(420, bobPublicKey, original);
    localStorage.clear();
    localStorage.setItem(identityKey, bobIdentity);

    const recovered = await decryptAttachment(420, alicePublicKey, encrypted.ciphertext, encrypted.iv);
    expect(new TextDecoder().decode(recovered)).toBe("encrypted course outline");
  });
});
