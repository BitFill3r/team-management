"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage, RequestError } from "@/lib/client";
import type { Survey, SurveyConfig, SurveyDetail, SurveyResponse, SurveySummary } from "@/lib/survey-types";
import { duplicateResponses, surveyCounts } from "@/lib/survey-results";
import SurveyEditor, { initialSurveyConfig, PasswordFields, type PasswordChoice } from "./survey-editor";
import SurveyFields, { answerPayload } from "./survey-fields";

const statusNames = { draft: "Entwurf", open: "Offen", closed: "Geschlossen" };
type Result = SurveyDetail & { generatedPassword?: string };
const configuration = (survey: Survey): SurveyConfig => ({
  title: survey.title, description: survey.description, firstLabel: survey.firstLabel,
  firstPlaceholder: survey.firstPlaceholder, firstRequired: survey.firstRequired,
  secondLabel: survey.secondLabel, secondPlaceholder: survey.secondPlaceholder, secondRequired: survey.secondRequired,
  secondType: survey.secondType, warnDuplicates: survey.warnDuplicates, options: survey.options.map((option) => option.label),
});

export default function SurveyManager({ onBusy }: { onBusy: (busy: boolean) => void }) {
  const [list, setList] = useState<SurveySummary[]>([]);
  const [detail, setDetail] = useState<SurveyDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [generated, setGenerated] = useState("");
  const [password, setPassword] = useState<PasswordChoice>({ mode: "generated" });
  const [editing, setEditing] = useState<string | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    api<SurveySummary[]>("surveys", "GET", undefined, controller.signal).then(setList).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(error));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  function accept(result: Result) {
    setDetail(result); setCreating(false); setGenerated(result.generatedPassword ?? ""); setEditing(null);
    setList((previous) => [{ id: result.survey.id, title: result.survey.title, status: result.survey.status, count: result.responses.length },
      ...previous.filter((survey) => survey.id !== result.survey.id)]);
  }
  async function run(action: () => Promise<void>, message: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusy(true); setError(""); setStatus("");
    try { await action(); setStatus(message); }
    catch (error) { setError(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  const survey = detail?.survey;
  const duplicates = detail ? duplicateResponses(detail.survey, detail.responses) : new Set<string>();
  const counts = detail ? surveyCounts(detail.survey, detail.responses) : [];
  return <section className="card survey-manager">
    <div className="section-heading"><h2>Umfragen</h2>
      <button disabled={busy} onClick={() => { setCreating(true); setDetail(null); setGenerated(""); setError(""); setStatus(""); }}>Neue Umfrage</button></div>
    {status && <p role="status">{status}</p>}
    {error && <div className="error" role="alert"><p>{error}</p>
      <button className="secondary" disabled={busy} onClick={() => void run(async () => {
        if (survey) accept(await api<Result>(`surveys/${survey.id}`));
        else { setList(await api<SurveySummary[]>("surveys")); setLoading(false); }
      }, "Gespeicherten Stand geladen.")}>Gespeicherten Stand laden</button></div>}
    {generated && <div className="survey-secret" role="status"><strong>Passwort jetzt sichern</strong>
      <p>Es wird nur jetzt angezeigt und kann später nicht erneut abgerufen werden. Link und Passwort getrennt weitergeben.</p>
      <label htmlFor="generated-survey-password">Generiertes Umfrage-Passwort</label>
      <input id="generated-survey-password" readOnly value={generated} onFocus={(event) => event.target.select()} />
      <button className="secondary" onClick={() => setGenerated("")}>Passwort gesichert, ausblenden</button></div>}
    {creating && <SurveyEditor initial={initialSurveyConfig} published={false} busy={busy} creating
      onSave={(config, password) => run(async () => accept(await api<Result>("surveys", "POST", { config, password })), "Entwurf erstellt.")} />}
    {survey && detail && <>
      <div className="survey-toolbar"><strong>{statusNames[survey.status]}</strong>
        <button disabled={busy} onClick={() => void run(async () => accept(await api<Result>(`surveys/${survey.id}/status`, "PATCH", {
          version: survey.version, status: survey.status === "open" ? "closed" : "open",
        })), survey.status === "open" ? "Umfrage geschlossen." : "Umfrage geöffnet.")}>{survey.status === "open" ? "Umfrage schließen" : "Umfrage öffnen"}</button>
        <button className="secondary" disabled={busy} onClick={() => void run(async () => accept(await api<Result>(`surveys/${survey.id}`)), "Gespeicherten Stand geladen.")}>Aktualisieren</button>
      </div>
      <label htmlFor="survey-link">Teilnahmelink</label><input id="survey-link" readOnly value={`${typeof window === "undefined" ? "" : window.location.origin}/umfrage/${survey.token}`} onFocus={(event) => event.target.select()} />
      <button className="secondary" disabled={busy} onClick={() => void run(async () => {
        if (!navigator.clipboard) throw new RequestError(400, "Bitte den Link im Feld markieren und kopieren.");
        await navigator.clipboard.writeText(`${window.location.origin}/umfrage/${survey.token}`);
      }, "Link kopiert. Passwort bitte separat weitergeben.")}>Link kopieren</button>
      <p className="muted">Alternativ den Link im Feld markieren und kopieren.</p>
      <details><summary>Umfrage bearbeiten</summary>
        <SurveyEditor key={`${survey.id}-${survey.version}`} initial={configuration(survey)} published={survey.published} busy={busy} creating={false}
          onSave={(config) => run(async () => accept(await api<Result>(`surveys/${survey.id}`, "PATCH", { version: survey.version, config })), "Umfrage gespeichert.")} />
      </details>
      <details><summary>Passwort ersetzen</summary><form onSubmit={(event) => {
        event.preventDefault();
        if (!window.confirm("Neues Passwort setzen? Alle bisherigen Umfrage-Anmeldungen werden ungültig.")) return;
        void run(async () => { accept(await api<Result>(`surveys/${survey.id}/password`, "PATCH", { version: survey.version, password })); setPassword({ mode: "generated" }); }, "Passwort ersetzt.");
      }}><PasswordFields disabled={busy} value={password} onChange={setPassword} /><button disabled={busy}>Passwort ersetzen</button></form></details>
      <h3>Auswertung · {detail.responses.length} Einträge</h3>
      {survey.secondType === "single_choice" && <ul className="survey-counts">
        {counts.map((option) => <li key={option.id}>{option.label}: <strong>{option.count}</strong></li>)}
        <li>Keine Angabe: <strong>{detail.responses.filter((response) => !response.optionId).length}</strong></li>
      </ul>}
      <button className="secondary" disabled={busy} onClick={() => void run(async () => {
        const response = await fetch(`/api/surveys/${survey.id}/export`, { cache: "no-store" });
        if (!response.ok) {
          const result: { error?: string } = await response.json();
          throw new RequestError(response.status, result.error ?? "Der Export konnte nicht geladen werden.");
        }
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a"); link.href = url; link.download = "umfrage.csv"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "CSV heruntergeladen.")}>CSV exportieren</button>
      {detail.responses.length === 0 && <p>Noch keine Antworten.</p>}
      <div className="survey-response-list">{detail.responses.map((response) => <article className="survey-response" key={response.id}>
        {editing === response.id ? <ResponseEditor response={response} survey={survey} busy={busy}
          onCancel={() => setEditing(null)} onSave={(answer) => run(async () => accept(await api<Result>(`surveys/${survey.id}/responses`, "PATCH", {
            responseId: response.id, version: response.version, answer,
          })), "Antwort gespeichert.")} />
          : <><dl><div><dt>{survey.firstLabel}</dt><dd>{response.firstValue ?? "Keine Angabe"}</dd></div>
            <div><dt>{survey.secondLabel}</dt><dd>{survey.secondType === "text" ? response.secondValue ?? "Keine Angabe" : survey.options.find((option) => option.id === response.optionId)?.label ?? "Keine Angabe"}</dd></div></dl>
            <p className="muted">{new Date(response.createdAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</p>
            {duplicates.has(response.id) && <p className="survey-duplicate">Mögliche Doppelung im ersten Feld – bitte prüfen. Wird regulär mitgezählt.</p>}
            <div className="survey-toolbar"><button className="secondary" disabled={busy} onClick={() => setEditing(response.id)}>Antwort bearbeiten</button>
              <button className="secondary danger" disabled={busy} onClick={() => {
                if (window.confirm("Diese Antwort endgültig löschen?")) void run(async () => accept(await api<Result>(`surveys/${survey.id}/responses`, "DELETE", {
                  responseId: response.id, version: response.version, confirmed: true,
                })), "Antwort gelöscht.");
              }}>Antwort löschen</button></div></>}
      </article>)}</div>
      <button className="danger-button" disabled={busy} onClick={() => {
        if (!window.confirm(`Umfrage „${survey.title}“ und alle ${detail.responses.length} Antworten endgültig löschen?`)) return;
        void run(async () => {
          await api(`surveys/${survey.id}`, "DELETE", { version: survey.version, confirmed: true });
          setDetail(null); setGenerated(""); setList((previous) => previous.filter((entry) => entry.id !== survey.id));
        }, "Umfrage und Antworten gelöscht.");
      }}>Umfrage endgültig löschen</button>
    </>}
    {!creating && !detail && (loading ? <p role="status">Umfragen werden geladen …</p> : list.length === 0 && !error ? <p>Noch keine Umfragen angelegt.</p> : null)}
    <ul className="history-list">{list.map((entry) => <li key={entry.id}><button className="history-entry" disabled={busy}
      onClick={() => void run(async () => accept(await api<Result>(`surveys/${entry.id}`)), "Umfrage geladen.")}>
      {entry.title}<span>{statusNames[entry.status]} · {entry.count} Einträge</span></button></li>)}</ul>
  </section>;
}

function ResponseEditor({ response, survey, busy, onCancel, onSave }: {
  response: SurveyResponse; survey: Survey; busy: boolean; onCancel: () => void;
  onSave: (answer: ReturnType<typeof answerPayload>) => Promise<void>;
}) {
  const [value, setValue] = useState({ firstValue: response.firstValue ?? "", secondValue: response.secondValue ?? "", optionId: response.optionId ?? "" });
  return <form onSubmit={(event) => { event.preventDefault(); void onSave(answerPayload(value)); }}>
    <SurveyFields survey={survey} value={value} onChange={setValue} disabled={busy} />
    <div className="survey-toolbar"><button disabled={busy}>Antwort speichern</button><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Abbrechen</button></div>
  </form>;
}
