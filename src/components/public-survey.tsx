"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage, RequestError } from "@/lib/client";
import type { PublicSurvey as Survey } from "@/lib/survey-types";
import SurveyFields, { answerPayload, emptySurveyAnswers } from "./survey-fields";

export default function PublicSurvey({ token }: { token: string }) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [password, setPassword] = useState("");
  const [answers, setAnswers] = useState(emptySurveyAnswers);
  const [sent, setSent] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const submissionId = useRef<string | null>(null);
  const submitting = useRef(false);
  const path = `public-surveys/${token}`;
  const firstInput = useRef<HTMLDivElement>(null);

  function failure(error: unknown) {
    if (error instanceof RequestError && error.status === 401) setSurvey(null);
    if (error instanceof RequestError && (error.status === 404 || error.status === 409)) setUnavailable(true);
    setError(errorMessage(error));
  }
  useEffect(() => {
    const controller = new AbortController();
    api<Survey>(path, "GET", undefined, controller.signal).then(setSurvey).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof RequestError && error.status === 401) return;
      failure(error);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path]);

  return <main className="survey-public">
    <div className="card">
      {loading ? <p role="status">Umfrage wird geladen …</p> : <>
        <h1>{survey && !unavailable ? survey.title : unavailable ? "Umfrage nicht verfügbar" : "An Umfrage teilnehmen"}</h1>
        <p className="context-note">AM BALL · UMFRAGE</p>
        {error && <p className="error" role="alert">{error}</p>}
        {!survey && !unavailable && <form onSubmit={async (event) => {
          event.preventDefault(); if (submitting.current) return;
          submitting.current = true; setBusy(true); setError("");
          try {
            await api(`${path}/login`, "POST", { password });
            setPassword(""); setSurvey(await api<Survey>(path));
          } catch (error) { failure(error); }
          finally { submitting.current = false; setBusy(false); }
        }}>
          <label htmlFor="survey-password">Umfrage-Passwort</label>
          <input id="survey-password" type="password" autoComplete="current-password" required maxLength={128}
            value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} />
          <button className="full" disabled={busy}>{busy ? "Wird geprüft …" : "Umfrage öffnen"}</button>
        </form>}
        {survey && !unavailable && <>
          <p className="survey-description">{survey.description}</p>
          {sent ? <div role="status"><h2>Vielen Dank!</h2><p>Dein Eintrag wurde gespeichert.</p>
            <button onClick={() => {
              setSent(false); setAnswers(emptySurveyAnswers); setUncertain(false); submissionId.current = null;
              requestAnimationFrame(() => firstInput.current?.querySelector("input")?.focus());
            }}>Weiteren Eintrag erfassen</button></div>
            : <form onSubmit={async (event) => {
              event.preventDefault(); if (submitting.current) return;
              const answer = answerPayload(answers);
              if (!answer.firstValue && !answer.secondValue && !answer.optionId) { setError("Bitte mindestens ein Feld ausfüllen."); return; }
              submitting.current = true; setBusy(true); setError("");
              submissionId.current ??= crypto.randomUUID();
              try {
                await api(`${path}/responses`, "POST", { submissionId: submissionId.current, answer });
                setSent(true);
              } catch (error) {
                if (!(error instanceof RequestError)) setUncertain(true);
                failure(error);
              }
              finally { submitting.current = false; setBusy(false); }
            }}>
              <div ref={firstInput}><SurveyFields survey={survey} value={answers} onChange={setAnswers} disabled={busy || uncertain} /></div>
              {uncertain && <p>Die Speicherbestätigung fehlt. Bitte diesen unveränderten Eintrag erneut absenden; er wird nicht doppelt gespeichert. Die Seite dabei nicht neu laden.</p>}
              <p className="muted">Mindestens ein Feld ausfüllen. Freitext: höchstens 200 Zeichen pro Feld.</p>
              <button disabled={busy}>{busy ? "Wird gespeichert …" : "Eintrag absenden"}</button>
            </form>}
          <p className="privacy-note">Deine Angaben werden für den oben beschriebenen Zweck erfasst. Nur der Trainerbereich kann Antworten einsehen und korrigieren. Bitte bei Korrekturen die verantwortlichen Trainer kontaktieren. Diese können die Daten nach Abschluss löschen.</p>
          <button className="text-button" disabled={busy} onClick={async () => {
            setBusy(true); setError("");
            try { await api(`${path}/logout`, "POST", {}); setSurvey(null); setSent(false); setUncertain(false); setAnswers(emptySurveyAnswers); submissionId.current = null; }
            catch (error) { failure(error); } finally { setBusy(false); }
          }}>Umfrage verlassen</button>
        </>}
        {!survey && error && !unavailable && <button className="secondary" disabled={busy} onClick={() => window.location.reload()}>Erneut laden</button>}
      </>}
    </div>
  </main>;
}
