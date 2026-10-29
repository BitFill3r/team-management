import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "team-session";
export const SESSION_SECONDS = 60 * 60 * 12;

function config() {
  const secret = process.env.SESSION_SECRET;
  const passwordHash = process.env.TEAM_PASSWORD_HASH;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET muss mindestens 32 Zeichen haben.");
  if (!passwordHash || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash)) throw new Error("TEAM_PASSWORD_HASH ist nicht korrekt konfiguriert.");
  return { secret, passwordHash };
}

export function verifyPassword(password: string) {
  const { passwordHash } = config();
  const [, salt, expected] = passwordHash.split(":");
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(expected, "hex"));
}

function signature(payload: string) {
  const { secret, passwordHash } = config();
  return createHmac("sha256", secret).update(`${passwordHash}:${payload}`).digest("hex");
}

export function createSession(now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${signature(payload)}`;
}

export function validSession(token: string | undefined, now = Date.now()) {
  if (!token || !/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, nonce, supplied] = token.split(".");
  const remaining = Number(expires) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > SESSION_SECONDS) return false;
  return timingSafeEqual(Buffer.from(signature(`${expires}.${nonce}`), "hex"), Buffer.from(supplied, "hex"));
}

export async function authenticated() {
  return validSession((await cookies()).get(SESSION_COOKIE)?.value);
}
