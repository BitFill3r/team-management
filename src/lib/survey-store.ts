import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "./db";
import { HttpError } from "./store";
import { hashPassword } from "./password";
import { surveyAnswerSchema, surveyPasswordSchema } from "./survey-validation";
import type { z } from "zod";
import type { PublicSurvey, Survey, SurveyConfig, SurveyDetail, SurveyResponse, SurveySummary } from "./survey-types";

type Credentials = { passwordHash: string; passwordVersion: number };
type StoredSurvey = Survey & Credentials;
const columns = `id, token, title, description, first_label AS "firstLabel", first_placeholder AS "firstPlaceholder",
  first_required AS "firstRequired", second_label AS "secondLabel", second_placeholder AS "secondPlaceholder",
  second_required AS "secondRequired", second_type AS "secondType", warn_duplicates AS "warnDuplicates",
  status, published, version, password_hash AS "passwordHash", password_version AS "passwordVersion"`;
const responseColumns = `id, first_value AS "firstValue", second_value AS "secondValue", option_id AS "optionId",
  version, created_at AS "createdAt"`;
const conflict = () => new HttpError(409, "Die Umfrage wurde inzwischen geändert. Bitte neu laden.");

async function transaction<T>(action: (client: PoolClient) => Promise<T>) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function readSurvey(client: Pick<PoolClient, "query">, id: string, byToken = false, lock = false): Promise<StoredSurvey> {
  const result = await client.query<Omit<StoredSurvey, "options">>(
    `SELECT ${columns} FROM surveys WHERE ${byToken ? "token" : "id"}=$1${lock ? " FOR UPDATE" : ""}`, [id]);
  if (!result.rows[0]) throw new HttpError(404, "Diese Umfrage ist nicht verfügbar.");
  const options = await client.query<{ id: string; label: string }>(
    "SELECT id, label FROM survey_options WHERE survey_id=$1 ORDER BY position", [result.rows[0].id]);
  return { ...result.rows[0], options: options.rows };
}
function withoutCredentials(survey: StoredSurvey): Survey {
  const { passwordHash, passwordVersion, ...safe } = survey;
  void passwordHash; void passwordVersion;
  return safe;
}
function password(input: z.infer<typeof surveyPasswordSchema>) {
  const generatedPassword = input.mode === "generated" ? randomBytes(24).toString("base64url") : undefined;
  return { hash: hashPassword(generatedPassword ?? (input.mode === "manual" ? input.password : "")), generatedPassword };
}
const configValues = (config: SurveyConfig) => [config.title, config.description, config.firstLabel, config.firstPlaceholder,
  config.firstRequired, config.secondLabel, config.secondPlaceholder, config.secondRequired, config.secondType, config.warnDuplicates];
async function insertOptions(client: PoolClient, id: string, options: string[]) {
  for (const [position, label] of options.entries())
    await client.query("INSERT INTO survey_options (survey_id, label, position) VALUES ($1,$2,$3)", [id, label, position]);
}
function checkVersion(survey: Survey, version: number) {
  if (survey.version !== version) throw conflict();
}

export async function listSurveys(): Promise<SurveySummary[]> {
  return (await db().query<SurveySummary>(`SELECT s.id, s.title, s.status,
    (SELECT count(*)::int FROM survey_responses r WHERE r.survey_id=s.id) AS count
    FROM surveys s ORDER BY s.created_at DESC, s.id`)).rows;
}
export async function surveyDetail(id: string): Promise<SurveyDetail> {
  return transaction(async (client) => {
    const survey = await readSurvey(client, id, false, true);
    const responses = await client.query<SurveyResponse>(
      `SELECT ${responseColumns} FROM survey_responses WHERE survey_id=$1 ORDER BY created_at, id`, [id]);
    return { survey: withoutCredentials(survey), responses: responses.rows };
  });
}
export async function createSurvey(config: SurveyConfig, input: z.infer<typeof surveyPasswordSchema>) {
  const credential = password(input);
  const id = await transaction(async (client) => {
    const result = await client.query<{ id: string }>(`INSERT INTO surveys
      (title,description,first_label,first_placeholder,first_required,second_label,second_placeholder,second_required,second_type,warn_duplicates,token,password_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [...configValues(config), randomBytes(24).toString("hex"), credential.hash]);
    await insertOptions(client, result.rows[0].id, config.options);
    return result.rows[0].id;
  });
  return { ...(await surveyDetail(id)), generatedPassword: credential.generatedPassword };
}
export async function updateSurvey(id: string, version: number, config: SurveyConfig) {
  await transaction(async (client) => {
    const survey = await readSurvey(client, id, false, true);
    checkVersion(survey, version);
    if (survey.published) {
      const current: SurveyConfig = { ...survey, options: survey.options.map((option) => option.label) };
      for (const key of ["firstLabel", "firstPlaceholder", "firstRequired", "secondLabel", "secondPlaceholder", "secondRequired", "secondType", "options"] as const) {
        if (JSON.stringify(current[key]) !== JSON.stringify(config[key]))
          throw new HttpError(409, "Felddefinitionen sind nach der ersten Veröffentlichung gesperrt.");
      }
    } else {
      await client.query("DELETE FROM survey_options WHERE survey_id=$1", [id]);
      await insertOptions(client, id, config.options);
    }
    await client.query(`UPDATE surveys SET title=$1,description=$2,first_label=$3,first_placeholder=$4,first_required=$5,
      second_label=$6,second_placeholder=$7,second_required=$8,second_type=$9,warn_duplicates=$10,version=version+1 WHERE id=$11`,
    [...configValues(config), id]);
  });
  return surveyDetail(id);
}
export async function setSurveyStatus(id: string, version: number, status: "open" | "closed") {
  await transaction(async (client) => {
    const survey = await readSurvey(client, id, false, true);
    checkVersion(survey, version);
    if (survey.status === "draft" && status === "closed") throw new HttpError(400, "Einen Entwurf zuerst öffnen.");
    await client.query("UPDATE surveys SET status=$1,published=true,version=version+1 WHERE id=$2", [status, id]);
  });
  return surveyDetail(id);
}
export async function replaceSurveyPassword(id: string, version: number, input: z.infer<typeof surveyPasswordSchema>) {
  const credential = password(input);
  const result = await db().query("UPDATE surveys SET password_hash=$1,password_version=password_version+1,version=version+1 WHERE id=$2 AND version=$3 RETURNING id",
    [credential.hash, id, version]);
  if (!result.rowCount) throw conflict();
  return { ...(await surveyDetail(id)), generatedPassword: credential.generatedPassword };
}
export async function deleteSurvey(id: string, version: number) {
  const result = await db().query("DELETE FROM surveys WHERE id=$1 AND version=$2 RETURNING id", [id, version]);
  if (!result.rowCount) throw conflict();
}
export async function surveyCredentials(token: string) {
  const result = await db().query<{ id: string; status: Survey["status"] } & Credentials>(
    `SELECT id,status,password_hash AS "passwordHash",password_version AS "passwordVersion" FROM surveys WHERE token=$1`, [token]);
  if (!result.rows[0] || result.rows[0].status !== "open") throw new HttpError(404, "Diese Umfrage ist nicht verfügbar oder geschlossen.");
  return result.rows[0];
}
export async function publicSurvey(token: string): Promise<PublicSurvey> {
  const survey = await readSurvey(db(), token, true);
  if (survey.status !== "open") throw new HttpError(404, "Diese Umfrage ist nicht verfügbar oder geschlossen.");
  return {
    title: survey.title, description: survey.description, firstLabel: survey.firstLabel, firstPlaceholder: survey.firstPlaceholder,
    firstRequired: survey.firstRequired, secondLabel: survey.secondLabel, secondPlaceholder: survey.secondPlaceholder,
    secondRequired: survey.secondRequired, secondType: survey.secondType, options: survey.options,
  };
}
type Answer = z.infer<typeof surveyAnswerSchema>;
function validateAnswer(survey: Survey, answer: Answer) {
  if ((survey.firstRequired && !answer.firstValue) ||
      (survey.secondRequired && !(survey.secondType === "text" ? answer.secondValue : answer.optionId)))
    throw new HttpError(400, "Bitte alle Pflichtfelder ausfüllen.");
  if (!answer.firstValue && !answer.secondValue && !answer.optionId)
    throw new HttpError(400, "Bitte mindestens ein Feld ausfüllen.");
  if (survey.secondType === "text" ? answer.optionId !== null :
    answer.secondValue !== null || (answer.optionId !== null && !survey.options.some((option) => option.id === answer.optionId)))
    throw new HttpError(400, "Die Antwort passt nicht zu dieser Umfrage.");
}
export async function submitSurvey(token: string, passwordVersion: number, submissionId: string, answer: Answer) {
  return transaction(async (client) => {
    const survey = await readSurvey(client, token, true, true);
    if (survey.status !== "open") throw new HttpError(409, "Diese Umfrage ist geschlossen.");
    if (survey.passwordVersion !== passwordVersion) throw new HttpError(401, "Bitte mit dem aktuellen Umfrage-Passwort anmelden.");
    validateAnswer(survey, answer);
    const existing = await client.query<SurveyResponse>(`SELECT ${responseColumns} FROM survey_responses WHERE survey_id=$1 AND submission_id=$2`, [survey.id, submissionId]);
    if (existing.rows[0]) {
      const previous = existing.rows[0];
      if (previous.firstValue !== answer.firstValue || previous.secondValue !== answer.secondValue || previous.optionId !== answer.optionId)
        throw new HttpError(409, "Diese Einsendung wurde bereits gespeichert. Bitte einen neuen Eintrag beginnen.");
      return;
    }
    await client.query("INSERT INTO survey_responses (survey_id,first_value,second_value,option_id,submission_id) VALUES ($1,$2,$3,$4,$5)",
      [survey.id, answer.firstValue, answer.secondValue, answer.optionId, submissionId]);
    await client.query("UPDATE surveys SET version=version+1 WHERE id=$1", [survey.id]);
  });
}
export async function changeSurveyResponse(id: string, responseId: string, version: number, answer: Answer | null) {
  await transaction(async (client) => {
    const survey = await readSurvey(client, id, false, true);
    if (answer) validateAnswer(survey, answer);
    const result = answer
      ? await client.query(`UPDATE survey_responses SET first_value=$1,second_value=$2,option_id=$3,version=version+1
          WHERE survey_id=$4 AND id=$5 AND version=$6 RETURNING id`, [answer.firstValue, answer.secondValue, answer.optionId, id, responseId, version])
      : await client.query("DELETE FROM survey_responses WHERE survey_id=$1 AND id=$2 AND version=$3 RETURNING id", [id, responseId, version]);
    if (!result.rowCount) throw conflict();
    await client.query("UPDATE surveys SET version=version+1 WHERE id=$1", [id]);
  });
  return surveyDetail(id);
}

export async function claimSurveyLimit(surveyId: string, visitor: string, kind: "login" | "submit") {
  // The global row serializes reservations and bounds the visitor-key space per survey/window.
  const exceeded = await transaction(async (client) => {
    await client.query(`DELETE FROM survey_limits WHERE ctid IN
      (SELECT ctid FROM survey_limits WHERE window_start < now()-interval '15 minutes' LIMIT 100)`);
    const reserve = async (key: string) => {
      const result = await client.query<{ attempts: number }>(`INSERT INTO survey_limits (survey_id,key,attempts) VALUES ($1,$2,1)
        ON CONFLICT (survey_id,key) DO UPDATE SET
        attempts=CASE WHEN survey_limits.window_start <= now()-interval '15 minutes' THEN 1 ELSE least(survey_limits.attempts+1,10001) END,
        window_start=CASE WHEN survey_limits.window_start <= now()-interval '15 minutes' THEN now() ELSE survey_limits.window_start END
        RETURNING attempts`, [surveyId, key]);
      return result.rows[0].attempts;
    };
    if (await reserve(`${kind}:global`) > (kind === "login" ? 100 : 1000)) return true;
    return await reserve(`${kind}:${visitor}`) > (kind === "login" ? 10 : 30);
  });
  if (exceeded) throw new HttpError(429, "Zu viele Versuche für diese Umfrage. Bitte nach 15 Minuten erneut versuchen.");
}
