import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pool: null as pg.Pool | null, admin: false }));
vi.mock("@/lib/db", () => ({ db: () => state.pool! }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.admin ? { value: createSession() } : undefined }) }));
import { createSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import * as store from "@/lib/survey-store";
import { surveyAnswerSchema, surveyConfigSchema } from "@/lib/survey-validation";
import { createSurveySession, surveyCookie, surveyVisitor, validSurveySession } from "@/lib/survey-auth";
import { duplicateResponses, surveyCounts, surveyCsv } from "@/lib/survey-results";
import type { SurveyConfig, SurveyDetail } from "@/lib/survey-types";
import { GET, POST, PATCH, DELETE } from "@/app/api/[...path]/route";

let database: PGlite;
let socket: PGLiteSocketServer;
const config: SurveyConfig = {
  title: "Weihnachtstrikots", description: "Größen für die Bestellung",
  firstLabel: "Vorname des Kindes", firstPlaceholder: "z. B. Emil", firstRequired: true,
  secondLabel: "Trikotgröße", secondPlaceholder: "", secondRequired: true, secondType: "single_choice",
  warnDuplicates: true, options: ["116", "128", "140"],
};
const password = { mode: "manual" as const, password: "only-survey-test-password" };
beforeAll(async () => {
  vi.stubEnv("SESSION_SECRET", "survey-test-secret-at-least-32-characters");
  vi.stubEnv("TEAM_PASSWORD_HASH", hashPassword("test-team-password"));
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  database = await PGlite.create();
  for (const migration of ["001_initial.sql", "002_backfill_active_children.sql", "003_surveys.sql"])
    await database.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
  socket = new PGLiteSocketServer({ db: database, host: "127.0.0.1", port: 0 });
  await socket.start();
  state.pool = new pg.Pool({ connectionString: `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`, max: 1 });
});
beforeEach(async () => {
  state.admin = false;
  await state.pool!.query("TRUNCATE surveys, login_attempts CASCADE");
});
afterAll(async () => { await state.pool?.end(); await socket.stop(); await database.close(); vi.unstubAllEnvs(); });

async function request(path: string, method = "GET", data?: unknown, cookie?: string, origin = "http://localhost:3000") {
  const req = new NextRequest(`http://localhost:3000/api/${path}`, { method,
    headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data) });
  return ({ GET, POST, PATCH, DELETE })[method as "GET" | "POST" | "PATCH" | "DELETE"](req, { params: Promise.resolve({ path: path.split("/") }) });
}
async function open(overrides: Partial<SurveyConfig> = {}) {
  const created = await store.createSurvey(surveyConfigSchema.parse({ ...config, ...overrides }), password);
  return store.setSurveyStatus(created.survey.id, created.survey.version, "open");
}
const answer = (detail: SurveyDetail, firstValue = "Emil") => ({ firstValue, secondValue: null, optionId: detail.survey.options[0]?.id ?? null });
async function authCookie(detail: SurveyDetail) {
  const response = await request(`public-surveys/${detail.survey.token}/login`, "POST", { password: password.password });
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain(`Path=/api/public-surveys/${detail.survey.token}`);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
  return response.headers.get("set-cookie")!.split(";")[0];
}

describe("Umfragen und Antworten", () => {
  it("prüft Konfiguration, Typen, Optionen und Grenzen", () => {
    expect(surveyConfigSchema.parse(config)).toEqual(config);
    for (const options of [["116"], ["116", " 116 "], Array(31).fill("a")])
      expect(surveyConfigSchema.safeParse({ ...config, options }).success).toBe(false);
    expect(surveyConfigSchema.safeParse({ ...config, secondType: "text" }).success).toBe(false);
    expect(surveyConfigSchema.safeParse({ ...config, secondPlaceholder: "nicht erlaubt" }).success).toBe(false);
    expect(surveyConfigSchema.safeParse({ ...config, firstLabel: "" }).success).toBe(false);
    expect(surveyAnswerSchema.safeParse({ firstValue: "a".repeat(201), secondValue: null, optionId: null }).success).toBe(false);
    expect(surveyAnswerSchema.safeParse({ firstValue: "a\nb", secondValue: null, optionId: null }).success).toBe(false);
    expect(surveyAnswerSchema.parse({ firstValue: "   ", secondValue: " a ", optionId: null })).toEqual({ firstValue: null, secondValue: "a", optionId: null });
  });
  it("erstellt Entwürfe mit einmaligem Passwort, typisiertem Zugriff und ohne geheime Daten in Details", async () => {
    const result = await store.createSurvey(config, { mode: "generated" });
    expect(result.generatedPassword).toHaveLength(32);
    expect(result.survey.status).toBe("draft");
    expect(result.survey.token).toMatch(/^[a-f0-9]{48}$/);
    expect(await store.listSurveys()).toHaveLength(1);
    expect(JSON.stringify(await store.surveyDetail(result.survey.id))).not.toContain("password");
    expect((await request(`public-surveys/${result.survey.token}`)).status).toBe(404);
    await expect(store.setSurveyStatus(result.survey.id, 0, "closed")).rejects.toMatchObject({ status: 400 });
  });
  it("erlaubt Typwechsel im Entwurf und sperrt alle Felddefinitionen nach Veröffentlichung", async () => {
    const created = await store.createSurvey(config, password);
    const text = { ...config, firstLabel: "Mannschaft", secondType: "text" as const, options: [], secondPlaceholder: "Wunsch" };
    const updated = await store.updateSurvey(created.survey.id, 0, text);
    expect(updated.survey.options).toEqual([]);
    const opened = await store.setSurveyStatus(created.survey.id, updated.survey.version, "open");
    for (const changed of [{ firstLabel: "Neu" }, { firstRequired: false }, { firstPlaceholder: "Neu" }, { secondLabel: "Neu" },
      { secondRequired: false }, { secondPlaceholder: "Neu" }, { secondType: "single_choice" as const, options: ["a", "b"], secondPlaceholder: "" }])
      await expect(store.updateSurvey(created.survey.id, opened.survey.version, { ...text, ...changed })).rejects.toMatchObject({ status: 409 });
    const safe = await store.updateSurvey(created.survey.id, opened.survey.version, { ...text, title: "Neu", warnDuplicates: false });
    expect(safe.survey.title).toBe("Neu");
    await expect(store.updateSurvey(created.survey.id, 0, text)).rejects.toMatchObject({ status: 409 });
  });
  it("speichert idempotent, erhält Doppelungen und bereinigt Summen durch Trainer", async () => {
    let detail = await open();
    const id = randomUUID();
    await store.submitSurvey(detail.survey.token, 0, id, answer(detail));
    await store.submitSurvey(detail.survey.token, 0, id, answer(detail));
    await expect(store.submitSurvey(detail.survey.token, 0, id, answer(detail, "Mila"))).rejects.toMatchObject({ status: 409 });
    await store.submitSurvey(detail.survey.token, 0, randomUUID(), answer(detail, "emil"));
    detail = await store.surveyDetail(detail.survey.id);
    expect(detail.responses).toHaveLength(2);
    expect(duplicateResponses(detail.survey, detail.responses).size).toBe(2);
    expect(duplicateResponses({ ...detail.survey, warnDuplicates: false }, detail.responses).size).toBe(0);
    expect(surveyCounts(detail.survey, detail.responses).map((option) => option.count)).toEqual([2, 0, 0]);
    const response = detail.responses[0];
    detail = await store.changeSurveyResponse(detail.survey.id, response.id, response.version, { firstValue: "Mila", secondValue: null, optionId: detail.survey.options[1].id });
    expect(duplicateResponses(detail.survey, detail.responses).size).toBe(0);
    await expect(store.changeSurveyResponse(detail.survey.id, response.id, 0, null)).rejects.toMatchObject({ status: 409 });
    detail = await store.changeSurveyResponse(detail.survey.id, response.id, 1, null);
    expect(detail.responses).toHaveLength(1);
    await store.deleteSurvey(detail.survey.id, detail.survey.version);
    for (const table of ["survey_options", "survey_responses", "survey_limits"])
      expect((await state.pool!.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
  });
  it.each(["text", "single_choice"] as const)("validiert Pflichtstatus und leere Antworten bei %s", async (secondType) => {
    for (const firstRequired of [false, true]) for (const secondRequired of [false, true]) {
      const detail = await open({ firstRequired, secondRequired, secondType, options: secondType === "text" ? [] : config.options });
      const second = secondType === "text" ? { secondValue: "Wunsch", optionId: null } : { secondValue: null, optionId: detail.survey.options[0].id };
      await expect(store.submitSurvey(detail.survey.token, 0, randomUUID(), { firstValue: null, secondValue: null, optionId: null })).rejects.toMatchObject({ status: 400 });
      const firstOnly = store.submitSurvey(detail.survey.token, 0, randomUUID(), { firstValue: "a", secondValue: null, optionId: null });
      if (secondRequired) await expect(firstOnly).rejects.toMatchObject({ status: 400 }); else await firstOnly;
      const secondOnly = store.submitSurvey(detail.survey.token, 0, randomUUID(), { firstValue: null, ...second });
      if (firstRequired) await expect(secondOnly).rejects.toMatchObject({ status: 400 }); else await secondOnly;
      await store.submitSurvey(detail.survey.token, 0, randomUUID(), { firstValue: "a".repeat(200), ...second });
    }
  });
  it("verhindert fremde Optionen, falsche Typen und Einsenden nach Schließen", async () => {
    let first = await open();
    const second = await open();
    await expect(store.submitSurvey(first.survey.token, 0, randomUUID(), answer(second))).rejects.toMatchObject({ status: 400 });
    await expect(store.submitSurvey(first.survey.token, 0, randomUUID(), { ...answer(first), secondValue: "x" })).rejects.toMatchObject({ status: 400 });
    first = await store.setSurveyStatus(first.survey.id, first.survey.version, "closed");
    await expect(store.submitSurvey(first.survey.token, 0, randomUUID(), answer(first))).rejects.toMatchObject({ status: 409 });
    first = await store.setSurveyStatus(first.survey.id, first.survey.version, "open");
    await store.submitSurvey(first.survey.token, 0, randomUUID(), answer(first));
  });
  it("berücksichtigt leere optionale Werte bei Doppelungen und Stückzahlen und schützt neue Einsendungen vor veralteter Löschung", async () => {
    let detail = await open({ firstRequired: false, secondRequired: false });
    const oldVersion = detail.survey.version;
    for (let i = 0; i < 2; i++) await store.submitSurvey(detail.survey.token, 0, randomUUID(), { firstValue: null, secondValue: null, optionId: detail.survey.options[0].id });
    await store.submitSurvey(detail.survey.token, 0, randomUUID(), { firstValue: "Nur Text", secondValue: null, optionId: null });
    await expect(store.deleteSurvey(detail.survey.id, oldVersion)).rejects.toMatchObject({ status: 409 });
    detail = await store.surveyDetail(detail.survey.id);
    expect(duplicateResponses(detail.survey, detail.responses).size).toBe(0);
    const counts = surveyCounts(detail.survey, detail.responses);
    const missing = detail.responses.filter((response) => response.optionId === null).length;
    expect(counts.reduce((sum, option) => sum + option.count, missing)).toBe(detail.responses.length);
    expect(missing).toBe(1);
    const text = await open({ secondType: "text", secondRequired: false, options: [] });
    await expect(store.submitSurvey(text.survey.token, 0, randomUUID(), { firstValue: "a", secondValue: null, optionId: detail.survey.options[0].id })).rejects.toMatchObject({ status: 400 });
  });
  it("exportiert dynamische Spalten, leere Zellen, Umlaute und Formeln sicher", async () => {
    let detail = await open({ firstLabel: "=GEFAHR", secondType: "text", secondRequired: false, options: [] });
    await store.submitSurvey(detail.survey.token, 0, randomUUID(), { firstValue: 'Änne;"Test"', secondValue: null, optionId: null });
    await store.submitSurvey(detail.survey.token, 0, randomUUID(), { firstValue: "@SUMME(1)", secondValue: "+1", optionId: null });
    detail = await store.surveyDetail(detail.survey.id);
    const csv = surveyCsv(detail.survey, detail.responses);
    expect(csv).toContain('"\'=GEFAHR"');
    expect(csv).toContain('"Änne;""Test""";""');
    expect(csv).toContain('"\'@SUMME(1)";"\'+1"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});

describe("Umfragezugang und APIs", () => {
  it("trennt Trainer und Teilnehmende, schützt Exporte und veröffentlicht keine Antworten", async () => {
    const detail = await open();
    expect((await request("surveys")).status).toBe(401);
    expect((await request(`surveys/${detail.survey.id}/export`)).status).toBe(401);
    expect((await request(`public-surveys/${detail.survey.token}`)).status).toBe(401);
    state.admin = true;
    expect((await request(`public-surveys/${detail.survey.token}`)).status).toBe(401);
    const cookie = await authCookie(detail);
    state.admin = false;
    const response = await request(`public-surveys/${detail.survey.token}`, "GET", undefined, cookie);
    expect(response.status).toBe(200);
    const form = await response.json();
    expect(Object.keys(form)).not.toContain("responses");
    expect(Object.keys(form)).not.toContain("passwordHash");
    expect((await request(`public-surveys/${detail.survey.token}/responses`, "GET", undefined, cookie)).status).toBe(404);
    const second = await open();
    expect((await request(`public-surveys/${second.survey.token}`, "GET", undefined, cookie)).status).toBe(401);
    expect((await request(`public-surveys/${detail.survey.token}/login`, "POST", { password: password.password }, undefined, "https://evil.example")).status).toBe(403);
  });
  it("entwertet Sessions bei Passwortwechsel und prüft Signatur und Ablauf", async () => {
    const detail = await open();
    const cookie = await authCookie(detail);
    const changed = await store.replaceSurveyPassword(detail.survey.id, detail.survey.version, { mode: "generated" });
    expect(changed.generatedPassword).toHaveLength(32);
    expect((await request(`public-surveys/${detail.survey.token}`, "GET", undefined, cookie)).status).toBe(401);
    await expect(store.submitSurvey(detail.survey.token, 0, randomUUID(), answer(detail))).rejects.toMatchObject({ status: 401 });
    const now = Date.now();
    const token = createSurveySession(detail.survey.id, 1, now);
    expect(validSurveySession(token, detail.survey.id, 1, now)).toBe(true);
    expect(validSurveySession(token, detail.survey.id, 2, now)).toBe(false);
    expect(validSurveySession(token, randomUUID(), 1, now)).toBe(false);
    expect(validSurveySession(token, detail.survey.id, 1, now + 13 * 3600000)).toBe(false);
    expect(validSurveySession(token.slice(0, -1) + "z", detail.survey.id, 1, now)).toBe(false);
  });
  it("begrenzt Passwortversuche persistent, atomar und getrennt vom Team-Login", async () => {
    const detail = await open();
    for (let i = 0; i < 10; i++) expect((await request(`public-surveys/${detail.survey.token}/login`, "POST", { password: "wrong" })).status).toBe(401);
    const blocked = await request(`public-surveys/${detail.survey.token}/login`, "POST", { password: password.password });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("900");
    expect((await state.pool!.query("SELECT * FROM login_attempts")).rows).toEqual([]);
    await state.pool!.query("UPDATE survey_limits SET window_start=now()-interval '16 minutes'");
    expect((await request(`public-surveys/${detail.survey.token}/login`, "POST", { password: password.password })).status).toBe(200);
    await state.pool!.query("UPDATE survey_limits SET attempts=100 WHERE key='login:global'");
    await expect(store.claimSurveyLimit(detail.survey.id, "different-visitor", "login")).rejects.toMatchObject({ status: 429 });
    expect((await state.pool!.query("SELECT * FROM survey_limits WHERE key='login:different-visitor'")).rows).toEqual([]);
  });
  it("begrenzt Einsendungen und verwendet keine beliebigen Forwarded-Header", async () => {
    const detail = await open();
    for (let i = 0; i < 30; i++) await store.claimSurveyLimit(detail.survey.id, "visitor", "submit");
    await expect(store.claimSurveyLimit(detail.survey.id, "visitor", "submit")).rejects.toMatchObject({ status: 429 });
    const a = surveyVisitor(new NextRequest("http://localhost", { headers: { "x-forwarded-for": "1.1.1.1" } }));
    const b = surveyVisitor(new NextRequest("http://localhost", { headers: { "x-forwarded-for": "2.2.2.2" } }));
    expect(a).toBe(b);
  });
  it("verwendet unter Netlify nur die Plattform-IP und hasht sie", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalNetlify = process.env.NETLIFY;
    try {
      vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NETLIFY", "true");
      const request = (ip: string, forwarded: string) => new NextRequest("https://example.netlify.app", {
        headers: { "x-nf-client-connection-ip": ip, "x-forwarded-for": forwarded },
      });
      const first = surveyVisitor(request("192.0.2.1", "203.0.113.1"));
      expect(first).toMatch(/^[a-f0-9]{64}$/);
      expect(first).toBe(surveyVisitor(request("192.0.2.1", "203.0.113.2")));
      expect(first).not.toBe(surveyVisitor(request("192.0.2.2", "203.0.113.1")));
    } finally {
      vi.stubEnv("NODE_ENV", originalNodeEnv);
      vi.stubEnv("NETLIFY", originalNetlify);
    }
  });
  it("führt den API-Lebenszyklus einschließlich Bodylimit, Antworten und Export aus", async () => {
    state.admin = true;
    expect((await request("surveys", "POST", { config: { ...config, description: "a".repeat(17000) }, password })).status).toBe(413);
    const createdResponse = await request("surveys", "POST", { config, password });
    expect(createdResponse.status).toBe(200);
    const created = await createdResponse.json() as SurveyDetail;
    const opened = await (await request(`surveys/${created.survey.id}/status`, "PATCH", { version: 0, status: "open" })).json() as SurveyDetail;
    const cookie = await authCookie(opened);
    const payload = { submissionId: randomUUID(), answer: answer(opened) };
    for (let i = 0; i < 2; i++) expect((await request(`public-surveys/${opened.survey.token}/responses`, "POST", payload, cookie)).status).toBe(200);
    const detail = await store.surveyDetail(opened.survey.id);
    expect(detail.responses).toHaveLength(1);
    const exported = await request(`surveys/${opened.survey.id}/export`);
    expect(exported.headers.get("content-type")).toContain("text/csv");
    expect(exported.headers.get("cache-control")).toBe("no-store");
    expect(await exported.text()).toContain("Emil");
    expect((await request(`surveys/${opened.survey.id}`, "DELETE", { version: 0 })).status).toBe(400);
    expect((await request(`surveys/${opened.survey.id}`, "DELETE", { version: detail.survey.version, confirmed: true })).status).toBe(200);
    expect((await request(`public-surveys/${opened.survey.token}`, "GET", undefined, cookie)).status).toBe(404);
    expect(surveyCookie(opened.survey.token)).toContain(opened.survey.token);
  });
});
