import { randomBytes, scryptSync } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";

const envPath = ".env.local";
const passwordPath = ".team-password.local";
const env = await readFile(envPath, "utf8");
if (/^\s*(?:export\s+)?TEAM_PASSWORD_HASH\s*=\s*["']?scrypt:/m.test(env)) {
  throw new Error("Ein Passwort-Hash ist bereits eingerichtet. Kein Passwort wurde geändert.");
}
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const entry = `TEAM_PASSWORD_HASH=${hash}`;
const nextEnv = /^\s*(?:export\s+)?TEAM_PASSWORD_HASH\s*=/m.test(env)
  ? env.replace(/^[ \t]*(?:export[ \t]+)?TEAM_PASSWORD_HASH[ \t]*=.*$/m, entry)
  : `${env}${env.endsWith("\n") ? "" : "\n"}${entry}\n`;

await writeFile(passwordPath, `${password}\n`, { flag: "wx", mode: 0o600 });
await chmod(envPath, 0o600);
await writeFile(envPath, nextEnv, { mode: 0o600 });
console.log("Passwort erzeugt. Hash in .env.local gespeichert.");
console.log("Das Passwort steht ausschließlich in .team-password.local. Bitte im Passwortmanager sichern und die Datei danach löschen.");
