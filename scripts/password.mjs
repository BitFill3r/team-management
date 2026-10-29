import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

if (!process.stdin.isTTY) throw new Error("Bitte in einem interaktiven Terminal starten.");
let hidden = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk, encoding);
    callback();
  },
});
const readline = createInterface({ input: process.stdin, output, terminal: true });
process.stdout.write("Neues Team-Passwort (mindestens 12 Zeichen, Eingabe verborgen): ");
hidden = true;
try {
  const password = await readline.question("");
  if (password.length < 12 || password.length > 256) throw new Error("Bitte 12 bis 256 Zeichen verwenden.");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  process.stdout.write(`\nTEAM_PASSWORD_HASH=scrypt:${salt}:${hash}\n`);
} finally {
  readline.close();
}
