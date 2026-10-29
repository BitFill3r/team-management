import { execFileSync, spawnSync } from "node:child_process";
import { scryptSync } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const script = fileURLToPath(new URL("../scripts/generate-password.mjs", import.meta.url));

it("erzeugt ein verborgenes Passwort, erhält die Konfiguration und verhindert Überschreiben", async () => {
  const directory = await mkdtemp(join(tmpdir(), "team-password-test-"));
  try {
    const original = "DATABASE_URL=postgresql://test-only\nTEAM_PASSWORD_HASH=\n";
    await writeFile(join(directory, ".env.local"), original);
    const output = execFileSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
    const password = (await readFile(join(directory, ".team-password.local"), "utf8")).trim();
    const env = await readFile(join(directory, ".env.local"), "utf8");
    const hash = env.match(/^TEAM_PASSWORD_HASH=(.+)$/m)![1];
    const [, salt, digest] = hash.split(":");
    expect(password).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(scryptSync(password, salt, 64).toString("hex")).toBe(digest);
    expect(output).not.toContain(password);
    expect(output).not.toContain(hash);
    expect(env).toContain("DATABASE_URL=postgresql://test-only\n");
    expect((await stat(join(directory, ".env.local"))).mode & 0o777).toBe(0o600);
    expect((await stat(join(directory, ".team-password.local"))).mode & 0o777).toBe(0o600);
    const second = spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
    expect(second.status).not.toBe(0);
    expect(await readFile(join(directory, ".env.local"), "utf8")).toBe(env);
    expect((await readFile(join(directory, ".team-password.local"), "utf8")).trim()).toBe(password);
  } finally { await rm(directory, { recursive: true }); }
});
