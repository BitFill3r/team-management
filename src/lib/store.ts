import { db } from "./db";
import type { Child, HistoryEntry, MonthlyOverview, OverviewTraining, Snapshot, Training } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const conflict = () => new HttpError(409, "Die Daten wurden inzwischen geändert. Bitte neu laden und erneut versuchen.");

const childrenQuery = "SELECT id, name, archived, version FROM children ORDER BY archived, lower(name), created_at";
const trainingQuery = `
  SELECT t.id, to_char(t.date, 'YYYY-MM-DD') AS date,
    COALESCE((
      SELECT json_agg(p) FROM (
        SELECT c.id, c.name, c.archived, c.version, a.present, a.version AS "attendanceVersion"
        FROM attendance a JOIN children c ON c.id=a.child_id
        WHERE a.training_id=t.id ORDER BY lower(c.name), c.created_at
      ) p
    ), '[]'::json) AS participants
  FROM trainings t WHERE t.date=$1`;
const historyQuery = `
  SELECT t.id, to_char(t.date, 'YYYY-MM-DD') AS date, count(a.child_id)::int AS total,
    count(a.child_id) FILTER (WHERE a.present)::int AS present
  FROM trainings t LEFT JOIN attendance a ON a.training_id=t.id
  GROUP BY t.id ORDER BY t.date DESC`;

export async function getSnapshot(date: string): Promise<Snapshot> {
  const result = await db().query<Snapshot>(`
    SELECT
      (SELECT row_to_json(t) FROM (${trainingQuery}) t) AS training,
      COALESCE((SELECT json_agg(c) FROM (${childrenQuery}) c), '[]'::json) AS children,
      COALESCE((SELECT json_agg(h) FROM (${historyQuery}) h), '[]'::json) AS history
  `, [date]);
  return result.rows[0];
}

export async function listChildren() {
  const result = await db().query<Child>(childrenQuery);
  return result.rows;
}

export async function createChild(name: string) {
  const result = await db().query<Child>(`
    WITH created AS (
      INSERT INTO children (name) VALUES ($1) RETURNING id, name, archived, version
    ), participants AS (
      INSERT INTO attendance (training_id, child_id)
      SELECT trainings.id, created.id FROM trainings CROSS JOIN created
    )
    SELECT id, name, archived, version FROM created`, [name]);
  return result.rows[0];
}

export async function updateChild(child: Child) {
  const result = await db().query<Child>(
    "UPDATE children SET name=$1, archived=$2, version=version+1 WHERE id=$3 AND version=$4 RETURNING id, name, archived, version",
    [child.name, child.archived, child.id, child.version],
  );
  if (!result.rows[0]) throw conflict();
  return result.rows[0];
}

export async function deleteChild(id: string, version: number) {
  const result = await db().query("DELETE FROM children WHERE id=$1 AND version=$2 RETURNING id", [id, version]);
  if (!result.rowCount) throw conflict();
}

export async function getTraining(date: string): Promise<Training | null> {
  const result = await db().query<Training>(trainingQuery, [date]);
  return result.rows[0] ?? null;
}

export async function createTraining(date: string) {
  // One statement keeps the participant snapshot atomic with creation.
  const result = await db().query(`
    WITH created AS (
      INSERT INTO trainings (date) VALUES ($1) ON CONFLICT (date) DO NOTHING RETURNING id
    ), participants AS (
      INSERT INTO attendance (training_id, child_id)
      SELECT created.id, children.id FROM created CROSS JOIN children WHERE NOT children.archived
    )
    SELECT id FROM created`, [date]);
  if (!result.rows.length) throw new HttpError(409, "Für dieses Datum existiert bereits ein Training. Bitte neu laden.");
  return getTraining(date);
}

export async function setAttendance(input: { trainingId: string; childId: string; present: boolean; version: number }) {
  const result = await db().query<{ present: boolean; version: number }>(`
    UPDATE attendance SET present=$1, version=version+1
    WHERE training_id=$2 AND child_id=$3 AND version=$4 RETURNING present, version`,
  [input.present, input.trainingId, input.childId, input.version]);
  if (!result.rows[0]) throw conflict();
  return result.rows[0];
}

export async function history() {
  const result = await db().query<HistoryEntry>(historyQuery);
  return result.rows;
}

export async function getMonthlyOverview(month: string): Promise<MonthlyOverview> {
  const result = await db().query<OverviewTraining>(`
    SELECT t.id, to_char(t.date, 'YYYY-MM-DD') AS date,
      COALESCE((
        SELECT json_agg(p) FROM (
          SELECT c.id, c.name, c.archived, a.present
          FROM attendance a JOIN children c ON c.id=a.child_id
          WHERE a.training_id=t.id ORDER BY lower(c.name), c.created_at, c.id
        ) p
      ), '[]'::json) AS participants
    FROM trainings t
    WHERE t.date >= $1::date AND t.date < $1::date + interval '1 month'
    ORDER BY t.date`, [`${month}-01`]);
  return { month, trainings: result.rows };
}

export async function claimLoginAttempt() {
  const result = await db().query<{ attempts: number }>(`
    INSERT INTO login_attempts (key, attempts) VALUES ('team', 1)
    ON CONFLICT (key) DO UPDATE SET
      attempts=CASE WHEN login_attempts.window_start < now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
      window_start=CASE WHEN login_attempts.window_start < now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END
    RETURNING attempts`);
  if (result.rows[0].attempts > 20) throw new HttpError(429, "Zu viele Anmeldeversuche. Bitte nach 15 Minuten erneut versuchen.");
}
