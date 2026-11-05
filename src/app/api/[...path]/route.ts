import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { authenticated, createSession, SESSION_COOKIE, SESSION_SECONDS, verifyPassword } from "@/lib/auth";
import * as store from "@/lib/store";
import { attendanceSchema, childCreateSchema, childDeleteSchema, childUpdateSchema, dateSchema, monthSchema } from "@/lib/validation";
import { surveyApi } from "@/lib/survey-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: Context) {
  try {
    const path = (await context.params).path.join("/");
    const method = request.method;
    if (method !== "GET") {
      const origin = process.env.APP_ORIGIN;
      if (!origin || new URL(origin).origin !== origin) throw new Error("APP_ORIGIN muss die vollständige App-Origin ohne abschließenden Schrägstrich enthalten.");
      if (request.headers.get("origin") !== origin) throw new store.HttpError(403, "Ungültige Anfrage. Bitte die App neu öffnen.");
      if (!request.headers.get("content-type")?.startsWith("application/json")) throw new store.HttpError(415, "JSON-Anfrage erforderlich.");
    }
    if (path.split("/")[0] === "surveys" || path.split("/")[0] === "public-surveys")
      return await surveyApi(request, path.split("/"), body);
    if (path === "login" && method === "POST") {
      await store.claimLoginAttempt();
      const { password } = z.object({ password: z.string().min(1).max(256) }).parse(await body(request));
      if (!verifyPassword(password)) throw new store.HttpError(401, "Das Passwort ist nicht richtig.");
      const response = NextResponse.json({ ok: true });
      response.cookies.set(SESSION_COOKIE, createSession(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
      return response;
    }
    if (!(await authenticated())) throw new store.HttpError(401, "Bitte erneut anmelden.");
    if (path === "overview" && method === "GET") return NextResponse.json(await store.getMonthlyOverview(monthSchema.parse(request.nextUrl.searchParams.get("month"))));
    if (path === "dashboard" && method === "GET") return NextResponse.json(await store.getSnapshot(dateSchema.parse(request.nextUrl.searchParams.get("date"))));
    if (path === "logout" && method === "POST") {
      const response = NextResponse.json({ ok: true });
      response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
      return response;
    }
    if (path === "children") {
      if (method === "GET") return NextResponse.json(await store.listChildren());
      if (method === "POST") return NextResponse.json(await store.createChild(childCreateSchema.parse(await body(request)).name));
      if (method === "PATCH") return NextResponse.json(await store.updateChild(childUpdateSchema.parse(await body(request))));
      if (method === "DELETE") {
        const input = childDeleteSchema.parse(await body(request));
        await store.deleteChild(input.id, input.version);
        return NextResponse.json({ ok: true });
      }
    }
    if (path === "training") {
      if (method === "GET") return NextResponse.json(await store.getTraining(dateSchema.parse(request.nextUrl.searchParams.get("date"))));
      if (method === "POST") return NextResponse.json(await store.createTraining(z.object({ date: dateSchema }).parse(await body(request)).date));
    }
    if (path === "attendance" && method === "PATCH") return NextResponse.json(await store.setAttendance(attendanceSchema.parse(await body(request))));
    if (path === "history" && method === "GET") return NextResponse.json(await store.history());
    throw new store.HttpError(404, "Diese Funktion wurde nicht gefunden.");
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Bitte die Eingaben prüfen: Pflichtfelder, erlaubte Textlängen und gültige Auswahl beachten." }, { status: 400 });
    if (error instanceof store.HttpError) return NextResponse.json({ error: error.message }, { status: error.status, headers: error.status === 429 ? { "Retry-After": "900" } : undefined });
    console.error("API-Anfrage fehlgeschlagen", error);
    return NextResponse.json({ error: "Die Anfrage konnte nicht gespeichert oder geladen werden. Bitte erneut versuchen." }, { status: 500 });
  }
}

async function body(request: NextRequest, limit = 4096): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new store.HttpError(400, "Die Anfrage enthält keine Daten.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new store.HttpError(413, "Die Anfrage ist zu groß."); }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(text); }
  catch { throw new store.HttpError(400, "Die Anfrage enthält ungültige Daten."); }
}

async function dispatch(request: NextRequest, context: Context) {
  const response = await handle(request, context);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
export { dispatch as GET, dispatch as POST, dispatch as PATCH, dispatch as DELETE };
