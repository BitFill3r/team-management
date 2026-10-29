import { readFile } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ cookie: undefined as string | undefined, queries: 0 }));
let database: PGlite;
vi.mock("@/lib/db", () => ({
  db: () => ({
    query: async (sql: string, values?: unknown[]) => {
      state.queries++;
      const result = await database.query(sql, values);
      return { rows: result.rows, rowCount: result.rows.length || result.affectedRows };
    },
  }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined }) }));

import * as store from "@/lib/store";
import { createSession, SESSION_SECONDS, validSession, verifyPassword } from "@/lib/auth";
import { attendanceSchema, dateSchema, nameSchema } from "@/lib/validation";
import { today } from "@/lib/client";
import { GET, POST, PATCH, DELETE } from "@/app/api/[...path]/route";

beforeAll(async () => {
  const salt = randomBytes(16).toString("hex");
  vi.stubEnv("TEAM_PASSWORD_HASH", `scrypt:${salt}:${scryptSync("test-password-only", salt, 64).toString("hex")}`);
  vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  database = new PGlite();
  await database.exec(await readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8"));
});
beforeEach(async () => {
  await database.exec("TRUNCATE children, trainings, attendance, login_attempts CASCADE");
  state.cookie = undefined;
});
afterAll(async () => { await database.close(); vi.unstubAllEnvs(); });

function request(path: string, method = "GET", data?: unknown, origin = "http://localhost:3000") {
  const request = new NextRequest(`http://localhost:3000/api/${path}`, {
    method,
    headers: { origin, "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const context = { params: Promise.resolve({ path: path.split("?")[0].split("/") }) };
  const handlers = { GET, POST, PATCH, DELETE };
  return handlers[method as keyof typeof handlers](request, context);
}

describe("Eingaben", () => {
  it("prüft echte Kalenderdaten, Jahresgrenzen und Schaltjahre", () => {
    for (const date of ["2026-02-29", "2026-02-30", "2026-13-01", "1999-12-31", "2101-01-01", "abc"]) {
      expect(dateSchema.safeParse(date).success).toBe(false);
    }
    expect(dateSchema.parse("2028-02-29")).toBe("2028-02-29");
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-28T23:30:00Z"));
      expect(today()).toBe("2026-10-29");
    } finally { vi.useRealTimers(); }
  });
  it("trimmt Namen und verhindert leere, zu lange und Steuerzeichen", () => {
    expect(nameSchema.parse("  Emil  ")).toBe("Emil");
    for (const name of [" ", "a".repeat(61), "Em\nil"]) expect(nameSchema.safeParse(name).success).toBe(false);
  });
  it("akzeptiert keine ungültigen IDs oder Zustände", () => {
    expect(attendanceSchema.safeParse({ trainingId: "bad", childId: "bad", version: -1, present: "yes" }).success).toBe(false);
  });
});

describe("Zugang", () => {
  it("prüft das Passwort ohne Klartextspeicherung", () => {
    expect(verifyPassword("test-password-only")).toBe(true);
    expect(verifyPassword("wrong")).toBe(false);
  });
  it("prüft Signatur und Ablauf", () => {
    const now = Date.now();
    const token = createSession(now);
    expect(validSession(token, now)).toBe(true);
    expect(validSession(token, now + SESSION_SECONDS * 1000)).toBe(false);
    expect(validSession(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), now)).toBe(false);
    expect(validSession(undefined)).toBe(false);
    expect(validSession("invalid")).toBe(false);
  });
  it("widerruft Sitzungen bei geändertem Passwort oder Signaturschlüssel", () => {
    const token = createSession();
    const original = process.env.SESSION_SECRET!;
    process.env.SESSION_SECRET = randomBytes(32).toString("hex");
    expect(validSession(token)).toBe(false);
    process.env.SESSION_SECRET = original;
    const originalHash = process.env.TEAM_PASSWORD_HASH!;
    const salt = randomBytes(16).toString("hex");
    process.env.TEAM_PASSWORD_HASH = `scrypt:${salt}:${scryptSync("new-password", salt, 64).toString("hex")}`;
    expect(validSession(token)).toBe(false);
    process.env.TEAM_PASSWORD_HASH = originalHash;
  });
  it("begrenzt Logins gemeinsam und gibt nach Ablauf das Fenster frei", async () => {
    for (let i = 0; i < 20; i++) await store.claimLoginAttempt();
    await expect(store.claimLoginAttempt()).rejects.toMatchObject({ status: 429 });
    await database.exec("UPDATE login_attempts SET window_start=now()-interval '16 minutes'");
    await expect(store.claimLoginAttempt()).resolves.toBeUndefined();
  });
});

describe("Persistenz und Historie", () => {
  it("lädt Training, Kinder und Verlauf als einen konsistenten Datenstand", async () => {
    expect(await store.getSnapshot("2026-10-29")).toEqual({ training: null, children: [], history: [] });
    const child = await store.createChild("Emil");
    const training = (await store.createTraining("2026-10-29"))!;
    await store.setAttendance({ trainingId: training.id, childId: child.id, present: true, version: 0 });
    const queriesBefore = state.queries;
    const snapshot = await store.getSnapshot("2026-10-29");
    expect(state.queries - queriesBefore).toBe(1);
    expect(snapshot.children).toEqual(await store.listChildren());
    expect(snapshot.training).toEqual(await store.getTraining("2026-10-29"));
    expect(snapshot.history).toEqual(await store.history());
    expect(snapshot.training?.participants[0]).toMatchObject({ present: true, attendanceVersion: 1 });
    expect((await store.getSnapshot("2026-10-30")).training).toBeNull();
    await store.deleteChild(child.id, 0);
    expect((await store.getSnapshot("2026-10-29")).training?.participants).toEqual([]);
  });
  it("speichert einzelne Änderungen und Rückgängig mit Versionsschutz", async () => {
    const child = await store.createChild("Emil");
    const training = (await store.createTraining("2026-10-29"))!;
    expect(training.participants).toHaveLength(1);
    expect(training.participants[0].present).toBe(false);
    const saved = await store.setAttendance({ trainingId: training.id, childId: child.id, present: true, version: 0 });
    expect(saved).toEqual({ present: true, version: 1 });
    expect((await store.getTraining(training.date))?.participants[0].present).toBe(true);
    await expect(store.setAttendance({ trainingId: training.id, childId: child.id, present: false, version: 0 })).rejects.toMatchObject({ status: 409 });
    await store.setAttendance({ trainingId: training.id, childId: child.id, present: false, version: 1 });
    expect((await store.history())[0]).toMatchObject({ total: 1, present: 0 });
  });
  it("verhindert das Überschreiben durch eine veraltete Rückgängig-Aktion", async () => {
    const child = await store.createChild("Emil");
    const training = (await store.createTraining("2026-10-29"))!;
    await store.setAttendance({ trainingId: training.id, childId: child.id, present: true, version: 0 });
    await store.setAttendance({ trainingId: training.id, childId: child.id, present: true, version: 1 });
    await expect(store.setAttendance({ trainingId: training.id, childId: child.id, present: false, version: 1 })).rejects.toMatchObject({ status: 409 });
    expect((await store.getTraining(training.date))?.participants[0].present).toBe(true);
  });
  it("erstellt Teilnehmer-Snapshots und erhält archivierte Kinder in alten Trainings", async () => {
    const child = await store.createChild("Emil");
    await store.createTraining("2026-10-29");
    const archived = await store.updateChild({ ...child, archived: true });
    const newer = (await store.createTraining("2026-10-30"))!;
    expect(newer.participants).toHaveLength(0);
    await store.createChild("Mila");
    expect((await store.getTraining("2026-10-29"))?.participants).toHaveLength(1);
    expect((await store.getTraining("2026-10-29"))?.participants[0].archived).toBe(true);
    await store.updateChild({ ...archived, name: "Emilio", archived: false });
    expect((await store.getTraining("2026-10-29"))?.participants[0].name).toBe("Emilio");
    expect((await store.createTraining("2026-10-31"))?.participants).toHaveLength(2);
  });
  it("löscht Kind und Anwesenheit, aber nicht die Trainingstage", async () => {
    const child = await store.createChild("Emil");
    await store.createTraining("2026-10-29");
    await store.deleteChild(child.id, child.version);
    expect(await store.listChildren()).toHaveLength(0);
    expect((await store.getTraining("2026-10-29"))?.participants).toHaveLength(0);
    expect(await store.history()).toHaveLength(1);
  });
  it("unterscheidet gleiche Namen und verhindert doppelte Trainings", async () => {
    const first = await store.createChild("Emil");
    const second = await store.createChild("Emil");
    expect(first.id).not.toBe(second.id);
    await store.createTraining("2026-10-29");
    await expect(store.createTraining("2026-10-29")).rejects.toMatchObject({ status: 409 });
    expect((await store.getTraining("2026-10-29"))?.participants).toHaveLength(2);
    expect(await store.getTraining("2026-10-30")).toBeNull();
    expect(await store.history()).toHaveLength(1);
  });
  it("schützt auch Umbenennen und Löschen gegen veraltete Versionen", async () => {
    const child = await store.createChild("Emil");
    await store.updateChild({ ...child, name: "Emilio" });
    await expect(store.updateChild({ ...child, archived: true })).rejects.toMatchObject({ status: 409 });
    await expect(store.deleteChild(child.id, 0)).rejects.toMatchObject({ status: 409 });
  });
});

describe("HTTP-Schnittstelle", () => {
  it("schützt jeden Daten-Endpunkt und liefert keine gecachten Kinderdaten", async () => {
    for (const [path, method, data] of [
      ["children", "GET", undefined], ["children", "POST", { name: "Emil" }],
      ["children", "PATCH", {}], ["children", "DELETE", {}],
      ["training?date=2026-10-29", "GET", undefined], ["training", "POST", {}],
      ["attendance", "PATCH", {}], ["history", "GET", undefined],
      ["dashboard?date=2026-10-29", "GET", undefined],
    ] as const) {
      const response = await request(path, method, data);
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });
  it("meldet falsche Passwörter und setzt eine geschützte Sitzung bei Erfolg", async () => {
    expect((await request("login", "POST", { password: "wrong" })).status).toBe(401);
    const response = await request("login", "POST", { password: "test-password-only" });
    expect(response.status).toBe(200);
    const cookie = response.cookies.get("team-session")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("strict");
    state.cookie = cookie.value;
    expect((await request("children")).status).toBe(200);
    const logout = await request("logout", "POST", {});
    expect(logout.cookies.get("team-session")?.maxAge).toBe(0);
  });
  it("verhindert fremde Origins und ungültige Daten", async () => {
    state.cookie = createSession();
    expect((await request("children", "POST", { name: "Emil" }, "https://foreign.example")).status).toBe(403);
    expect((await request("children", "POST", { name: " " })).status).toBe(400);
    expect((await request("training?date=2026-02-30")).status).toBe(400);
    expect((await request("dashboard?date=2026-02-30")).status).toBe(400);
    const dashboard = await request("dashboard?date=2026-10-29");
    expect(dashboard.status).toBe(200);
    expect(dashboard.headers.get("cache-control")).toBe("no-store");
    expect(await dashboard.json()).toEqual({ training: null, children: [], history: [] });
    const child = await store.createChild("Emil");
    expect((await request("children", "DELETE", { id: child.id, version: 0 })).status).toBe(400);
    expect(await store.listChildren()).toHaveLength(1);
  });
  it("liefert Datenbankfehler ausdrücklich als Fehler", async () => {
    state.cookie = createSession();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await database.exec("ALTER TABLE children RENAME TO children_unavailable");
    try {
      const response = await request("children");
      expect(response.status).toBe(500);
      expect(await response.json()).toHaveProperty("error");
      expect(log).toHaveBeenCalled();
    } finally {
      await database.exec("ALTER TABLE children_unavailable RENAME TO children");
      log.mockRestore();
    }
  });
});
