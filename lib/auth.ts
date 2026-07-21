import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

const COOKIE_NAME = "sl_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function sessionSecret() {
  // Reuse the token encryption key when a dedicated session secret is not set.
  return (env as { SESSION_SECRET?: string; TOKEN_ENCRYPTION_KEY?: string }).SESSION_SECRET
    ?? (env as { TOKEN_ENCRYPTION_KEY?: string }).TOKEN_ENCRYPTION_KEY
    ?? "dev-insecure-session-secret-change-me";
}

function b64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function hmacKey() {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Sign an email into a tamper-proof session token: base64url(email).base64url(hmac). */
export async function signSession(email: string) {
  const payload = b64url(new TextEncoder().encode(email.toLowerCase()));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payload));
  return `${payload}.${b64url(new Uint8Array(signature))}`;
}

export async function verifySession(token: string): Promise<string | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(signature), new TextEncoder().encode(payload));
    if (!valid) return null;
    return new TextDecoder().decode(fromB64url(payload));
  } catch {
    return null;
  }
}

/** The signed-in email from the session cookie, or null when signed out. */
export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function sessionCookie(token: string) {
  return { name: COOKIE_NAME, value: token, httpOnly: true, sameSite: "lax" as const, secure: true, path: "/", maxAge: MAX_AGE_SECONDS };
}

export function clearedSessionCookie() {
  return { name: COOKIE_NAME, value: "", httpOnly: true, sameSite: "lax" as const, secure: true, path: "/", maxAge: 0 };
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
}
