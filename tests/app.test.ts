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
import { attendanceSchema, dateSchema, nameSchema, monthSchema } from "@/lib/validation";
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
  it("prüft Monate und Grenzen", () => {
    for (const month of ["1999-12", "2101-01", "2026-00", "2026-13", "2026-1", "2026-01-01", ""]) {
      expect(monthSchema.safeParse(month).success).toBe(false);
    }
    for (const month of ["2000-01", "2100-12", "2028-02"]) expect(monthSchema.parse(month)).toBe(month);
  });
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
  it("trägt alte Lücken aktiver Kinder nach, erhält vorhandene Werte und ist wiederholbar", async () => {
    const active = await store.createChild("Emil");
    const archived = await store.createChild("Mila");
    const first = (await store.createTraining("2026-10-29"))!;
    const second = (await store.createTraining("2026-10-30"))!;
    const empty = (await store.createTraining("2026-11-01"))!;
    await store.updateChild({ ...archived, archived: true });
    await database.query("UPDATE attendance SET present=true, version=7 WHERE training_id=$1 AND child_id=$2", [first.id, active.id]);
    await database.query("UPDATE attendance SET version=4 WHERE training_id=$1 AND child_id=$2", [first.id, archived.id]);
    await database.query("DELETE FROM attendance WHERE training_id=$1 OR training_id=$2", [second.id, empty.id]);
    const before = (await database.query("SELECT * FROM attendance ORDER BY training_id, child_id")).rows;
    const migration = await readFile(new URL("../migrations/002_backfill_active_children.sql", import.meta.url), "utf8");
    await database.exec(migration);
    for (const training of [second, empty]) {
      expect((await store.getTraining(training.date))?.participants).toEqual([
        { ...active, present: false, attendanceVersion: 0 },
      ]);
    }
    const after = (await database.query("SELECT * FROM attendance ORDER BY training_id, child_id")).rows;
    expect(after).toHaveLength(before.length + 2);
    expect(after).toEqual(expect.arrayContaining(before));
    expect((await store.history()).find((day) => day.id === first.id)).toMatchObject({ total: 2, present: 1 });
    expect((await store.getMonthlyOverview("2026-10")).trainings[1].participants).toEqual([
      { id: active.id, name: active.name, archived: false, present: false },
    ]);
    await database.exec(migration);
    expect((await database.query("SELECT * FROM attendance ORDER BY training_id, child_id")).rows).toEqual(after);
  });
  it("führt das Nachtragen auch ohne Kinder oder Trainings sicher aus", async () => {
    const migration = await readFile(new URL("../migrations/002_backfill_active_children.sql", import.meta.url), "utf8");
    await database.exec(migration);
    await store.createChild("Emil");
    await database.exec(migration);
    expect((await database.query("SELECT * FROM attendance")).rows).toEqual([]);
    await database.exec("DELETE FROM children");
    await store.createTraining("2026-10-29");
    await database.exec(migration);
    expect((await database.query("SELECT * FROM attendance")).rows).toEqual([]);
  });
  it("ergänzt ein neues Kind in jedem bestehenden Termin, ohne Häkchen oder Versionen zu ändern", async () => {
    const existing = await store.createChild("Emil");
    const dates = ["2025-01-03", "2026-10-29", "2027-12-01"];
    for (const date of dates) {
      const training = (await store.createTraining(date))!;
      await store.setAttendance({ trainingId: training.id, childId: existing.id, present: true, version: 0 });
    }
    const added = await store.createChild("Mila");
    for (const date of dates) {
      const training = (await store.getTraining(date))!;
      expect(training.participants).toHaveLength(2);
      expect(training.participants.find((child) => child.id === added.id)).toMatchObject({ present: false, attendanceVersion: 0 });
      expect(training.participants.find((child) => child.id === existing.id)).toMatchObject({ present: true, attendanceVersion: 1 });
    }
    expect(await store.history()).toEqual(expect.arrayContaining(dates.map((date) => expect.objectContaining({ date, total: 2, present: 1 }))));
  });
  it("speichert bei fehlgeschlagenen Teilnahmezuordnungen auch kein halbfertiges Kind", async () => {
    await store.createTraining("2026-10-29");
    await database.exec(`
      CREATE FUNCTION reject_test_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Test: Zuordnung fehlgeschlagen'; END;
      $$;
      CREATE TRIGGER reject_test_attendance BEFORE INSERT ON attendance
        FOR EACH ROW EXECUTE FUNCTION reject_test_attendance();
    `);
    try {
      await expect(store.createChild("Mila")).rejects.toThrow("Test: Zuordnung fehlgeschlagen");
      expect(await store.listChildren()).toEqual([]);
      expect((await store.getTraining("2026-10-29"))?.participants).toEqual([]);
    } finally {
      await database.exec("DROP TRIGGER reject_test_attendance ON attendance; DROP FUNCTION reject_test_attendance()");
    }
  });
  it("lädt Monatsdaten mit genau einer Abfrage und schlanken Teilnehmerdaten", async () => {
    expect(await store.getMonthlyOverview("2026-10")).toEqual({ month: "2026-10", trainings: [] });
    const first = await store.createChild("Emil");
    const training = (await store.createTraining("2026-10-29"))!;
    const second = await store.createChild("Emil");
    await store.setAttendance({ trainingId: training.id, childId: first.id, version: 0, present: true });
    await store.createTraining("2026-10-30");
    await store.createTraining("2026-11-01");
    await store.updateChild({ ...first, archived: true });
    const before = state.queries;
    const result = await store.getMonthlyOverview("2026-10");
    expect(state.queries - before).toBe(1);
    expect(result.trainings.map((day) => day.date)).toEqual(["2026-10-29", "2026-10-30"]);
    expect(result.trainings[0]).toEqual({
      id: training.id, date: training.date,
      participants: expect.arrayContaining([
        { id: first.id, name: "Emil", archived: true, present: true },
        { id: second.id, name: "Emil", archived: false, present: false },
      ]),
    });
    expect(result.trainings[1].participants).toHaveLength(2);
    expect(result.trainings[1].participants.find((child) => child.id === second.id)).toEqual({
      id: second.id, name: "Emil", archived: false, present: false,
    });
    await store.deleteChild(first.id, 1);
    expect((await store.getMonthlyOverview("2026-10")).trainings[0].participants).toEqual([
      { id: second.id, name: "Emil", archived: false, present: false },
    ]);
    expect((await store.getMonthlyOverview("2026-10")).trainings[1].participants).toHaveLength(1);
  });
  it("grenzt Monate über Jahreswechsel und Schaltjahre exakt ab", async () => {
    for (const date of ["2027-12-31", "2028-01-01", "2028-01-31", "2028-02-01", "2028-02-29", "2028-03-01", "2100-12-31"]) {
      await store.createTraining(date);
    }
    expect((await store.getMonthlyOverview("2028-01")).trainings.map((day) => day.date)).toEqual(["2028-01-01", "2028-01-31"]);
    expect((await store.getMonthlyOverview("2028-02")).trainings.map((day) => day.date)).toEqual(["2028-02-01", "2028-02-29"]);
    expect((await store.getMonthlyOverview("2027-12")).trainings.map((day) => day.date)).toEqual(["2027-12-31"]);
    expect((await store.getMonthlyOverview("2100-12")).trainings.map((day) => day.date)).toEqual(["2100-12-31"]);
  });
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
  it("ergänzt neue Kinder auch in bestehenden Trainings und erhält archivierte Kinder", async () => {
    const child = await store.createChild("Emil");
    await store.createTraining("2026-10-29");
    const archived = await store.updateChild({ ...child, archived: true });
    const newer = (await store.createTraining("2026-10-30"))!;
    expect(newer.participants).toHaveLength(0);
    await store.createChild("Mila");
    expect((await store.getTraining("2026-10-29"))?.participants).toHaveLength(2);
    expect((await store.getTraining("2026-10-30"))?.participants).toHaveLength(1);
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
      ["overview?month=2026-10", "GET", undefined],
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
    for (const path of ["overview", "overview?month=2026-13", "overview?month=1999-12"]) expect((await request(path)).status).toBe(400);
    const overview = await request("overview?month=2026-10");
    expect(overview.status).toBe(200);
    expect(overview.headers.get("cache-control")).toBe("no-store");
    expect(await overview.json()).toEqual({ month: "2026-10", trainings: [] });
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
