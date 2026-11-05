import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticated } from "./auth";
import { HttpError } from "./store";
import * as store from "./survey-store";
import { matchesPassword } from "./password";
import { createSurveySession, surveyCookie, surveyVisitor, SURVEY_SECONDS, validSurveySession } from "./survey-auth";
import { surveyAnswerSchema, surveyConfigSchema, surveyPasswordSchema, surveyTokenSchema, surveyVersionSchema } from "./survey-validation";
import { surveyCsv } from "./survey-results";

export async function surveyApi(request: NextRequest, parts: string[], body: (request: NextRequest, limit?: number) => Promise<unknown>) {
  const method = request.method;
  if (parts[0] === "public-surveys") {
    const token = surveyTokenSchema.parse(parts[1]);
    const action = parts[2];
    if (parts.length > 3) throw new HttpError(404, "Diese Funktion wurde nicht gefunden.");
    if (action === "logout" && method === "POST") {
      const response = NextResponse.json({ ok: true });
      response.cookies.set(surveyCookie(token), "", cookieOptions(token, 0));
      return response;
    }
    const credentials = await store.surveyCredentials(token);
    if (action === "login" && method === "POST") {
      const { password } = z.object({ password: z.string().min(1).max(128) }).strict().parse(await body(request));
      await store.claimSurveyLimit(credentials.id, surveyVisitor(request), "login");
      if (!matchesPassword(password, credentials.passwordHash)) throw new HttpError(401, "Das Umfrage-Passwort ist nicht richtig.");
      const response = NextResponse.json({ ok: true });
      response.cookies.set(surveyCookie(token), createSurveySession(credentials.id, credentials.passwordVersion), cookieOptions(token, SURVEY_SECONDS));
      return response;
    }
    if (!validSurveySession(request.cookies.get(surveyCookie(token))?.value, credentials.id, credentials.passwordVersion))
      throw new HttpError(401, "Bitte mit dem Umfrage-Passwort anmelden.");
    if (!action && method === "GET") return NextResponse.json(await store.publicSurvey(token));
    if (action === "responses" && method === "POST") {
      const input = z.object({ submissionId: z.uuid(), answer: surveyAnswerSchema }).strict().parse(await body(request));
      await store.claimSurveyLimit(credentials.id, surveyVisitor(request), "submit");
      await store.submitSurvey(token, credentials.passwordVersion, input.submissionId, input.answer);
      return NextResponse.json({ ok: true });
    }
    throw new HttpError(404, "Diese Funktion wurde nicht gefunden.");
  }
  if (!(await authenticated())) throw new HttpError(401, "Bitte erneut anmelden.");
  if (parts.length === 1) {
    if (method === "GET") return NextResponse.json(await store.listSurveys());
    if (method === "POST") {
      const input = z.object({ config: surveyConfigSchema, password: surveyPasswordSchema }).strict().parse(await body(request, 16384));
      return NextResponse.json(await store.createSurvey(input.config, input.password));
    }
  }
  const id = z.uuid().parse(parts[1]);
  const action = parts[2];
  if (parts.length > 3) throw new HttpError(404, "Diese Funktion wurde nicht gefunden.");
  if (!action && method === "GET") return NextResponse.json(await store.surveyDetail(id));
  if (action === "export" && method === "GET") {
    const detail = await store.surveyDetail(id);
    return new NextResponse(surveyCsv(detail.survey, detail.responses), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="umfrage.csv"',
    } });
  }
  if (!action && method === "PATCH") {
    const input = z.object({ version: surveyVersionSchema, config: surveyConfigSchema }).strict().parse(await body(request, 16384));
    return NextResponse.json(await store.updateSurvey(id, input.version, input.config));
  }
  if (!action && method === "DELETE") {
    const input = z.object({ version: surveyVersionSchema, confirmed: z.literal(true) }).strict().parse(await body(request));
    await store.deleteSurvey(id, input.version);
    return NextResponse.json({ ok: true });
  }
  if (action === "status" && method === "PATCH") {
    const input = z.object({ version: surveyVersionSchema, status: z.enum(["open", "closed"]) }).strict().parse(await body(request));
    return NextResponse.json(await store.setSurveyStatus(id, input.version, input.status));
  }
  if (action === "password" && method === "PATCH") {
    const input = z.object({ version: surveyVersionSchema, password: surveyPasswordSchema }).strict().parse(await body(request));
    return NextResponse.json(await store.replaceSurveyPassword(id, input.version, input.password));
  }
  if (action === "responses" && (method === "PATCH" || method === "DELETE")) {
    if (method === "PATCH") {
      const input = z.object({ responseId: z.uuid(), version: surveyVersionSchema, answer: surveyAnswerSchema }).strict().parse(await body(request));
      return NextResponse.json(await store.changeSurveyResponse(id, input.responseId, input.version, input.answer));
    }
    const input = z.object({ responseId: z.uuid(), version: surveyVersionSchema, confirmed: z.literal(true) }).strict().parse(await body(request));
    return NextResponse.json(await store.changeSurveyResponse(id, input.responseId, input.version, null));
  }
  throw new HttpError(404, "Diese Funktion wurde nicht gefunden.");
}
function cookieOptions(token: string, maxAge: number) {
  // The page loads its protected content through this API; no session cookie is needed on the page itself.
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: `/api/public-surveys/${token}`, maxAge };
}
