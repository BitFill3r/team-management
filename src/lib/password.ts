import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function matchesPassword(password: string, hash: string) {
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash)) throw new Error("Ungültiges Passwort-Hashformat.");
  const [, salt, expected] = hash.split(":");
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(expected, "hex"));
}
