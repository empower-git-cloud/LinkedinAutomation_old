import { env } from "cloudflare:workers";

async function encryptionKey() {
  if (!env.TOKEN_ENCRYPTION_KEY || env.TOKEN_ENCRYPTION_KEY.length < 24) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be configured with at least 24 characters");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.TOKEN_ENCRYPTION_KEY));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export async function encryptToken(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptToken(value: string) {
  const [iv, ciphertext] = value.split(".");
  if (!iv || !ciphertext) throw new Error("Invalid encrypted token");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await encryptionKey(), fromBase64(ciphertext));
  return new TextDecoder().decode(plain);
}
