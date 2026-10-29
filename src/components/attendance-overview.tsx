"use client";

import { useEffect, useState } from "react";
import { api, displayDate, errorMessage } from "@/lib/client";
import { monthSchema } from "@/lib/validation";
import type { MonthlyOverview, OverviewParticipant } from "@/lib/types";

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T12:00:00Z`));
}

function adjacentMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export default function AttendanceOverview({ month, onMonthChange, onOpenTraining }: {
  month: string; onMonthChange: (month: string) => void; onOpenTraining: (date: string) => void;
}) {
  const [view, setView] = useState<"table" | "days">("table");
  const [result, setResult] = useState<MonthlyOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api<MonthlyOverview>(`overview?month=${month}`, "GET", undefined, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setResult(data); setLoading(false);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setError(errorMessage(error)); setLoading(false);
    });
    return () => controller.abort();
  }, [month, refresh]);

  function chooseMonth(value: string) {
    if (!monthSchema.safeParse(value).success) {
      setError("Bitte einen Monat zwischen Januar 2000 und Dezember 2100 wählen.");
      return;
    }
    if (value === month) return;
    setLoading(true); setError(""); setResult(null); onMonthChange(value);
  }
  const data = result?.month === month ? result : null;
  const children = [...new Map(data?.trainings.flatMap((training) => training.participants)
    .map((child) => [child.id, child])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id));
  const attendance = data?.trainings.map((training) =>
    new Map<string, OverviewParticipant>(training.participants.map((child) => [child.id, child])));

  return <section className="card">
    <div className="section-heading"><div><p className="eyebrow">UNSERE TRAININGSTAGE</p><h2>Trainingsverlauf</h2></div>
      <button className="secondary" disabled={loading} onClick={() => {
        setLoading(true); setError(""); setResult(null); setRefresh((value) => value + 1);
      }}>Aktualisieren</button>
    </div>
    <p className="muted">Wer war wann dabei? Zum Korrigieren einen Trainingstag öffnen.</p>
    <div className="month-navigation">
      <button className="secondary" aria-label="Vorheriger Monat" disabled={month === "2000-01"}
        onClick={() => chooseMonth(adjacentMonth(month, -1))}>←</button>
      <div><label htmlFor="overview-month">Monat</label>
        <input id="overview-month" type="month" min="2000-01" max="2100-12" value={month}
          onChange={(event) => { if (event.target.value) chooseMonth(event.target.value); }} /></div>
      <button className="secondary" aria-label="Nächster Monat" disabled={month === "2100-12"}
        onClick={() => chooseMonth(adjacentMonth(month, 1))}>→</button>
    </div>
    <div className="tabs overview-tabs" role="group" aria-label="Darstellung">
      <button aria-pressed={view === "table"} className={view === "table" ? "active" : ""} onClick={() => setView("table")}>Tabelle</button>
      <button aria-pressed={view === "days"} className={view === "days" ? "active" : ""} onClick={() => setView("days")}>Tagesliste</button>
    </div>
    <h3>{monthLabel(month)}</h3>
    {error && <div className="error" role="alert"><p>{error}</p><button className="secondary" disabled={loading} onClick={() => {
      setLoading(true); setError(""); setResult(null); setRefresh((value) => value + 1);
    }}>Erneut versuchen</button></div>}
    {loading || (!data && !error) ? <p role="status">Die Monatsübersicht wird geladen …</p> : data && (
      data.trainings.length === 0 ? <p className="empty">Keine Trainings in diesem Monat gespeichert.</p> : view === "table" ? <>
        <p className="overview-legend">✓ Anwesend · × Nicht anwesend · — Nicht in der damaligen Teilnehmerliste</p>
        <div className="overview-scroll" tabIndex={0} role="region" aria-label={`Anwesenheitstabelle ${monthLabel(month)}, horizontal scrollbar`}>
          <table className="overview-table">
            <caption className="sr-only">Anwesenheit im {monthLabel(month)}</caption>
            <thead><tr><th scope="col">Vorname</th>{data.trainings.map((training) =>
              <th scope="col" key={training.id}><button className="text-button" aria-label={`Training öffnen: ${displayDate(training.date)}`}
                onClick={() => onOpenTraining(training.date)}>{displayDate(training.date)}</button></th>)}</tr></thead>
            <tbody>{children.map((child) => <tr key={child.id}>
              <th scope="row">{child.name}{child.archived && <small className="archived-label">Archiviert</small>}</th>
              {data.trainings.map((training, index) => {
                const participant = attendance?.[index].get(child.id);
                const label = !participant ? "Nicht in der damaligen Teilnehmerliste" : participant.present ? "Anwesend" : "Nicht anwesend";
                return <td key={training.id} className={participant?.present ? "overview-present" : ""}>
                  <span aria-hidden="true">{!participant ? "—" : participant.present ? "✓" : "×"}</span><span className="sr-only">{label}</span>
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
        {children.length === 0 && <p className="muted">In diesen Trainings sind keine Kinder mehr eingetragen.</p>}
      </> : <ul className="overview-days">{[...data.trainings].reverse().map((training) => {
        const present = training.participants.filter((child) => child.present);
        return <li key={training.id}><div className="section-heading"><h3>{displayDate(training.date)}</h3>
          <span className="pill">{present.length} / {training.participants.length} dabei</span></div>
          {present.length ? <ul className="present-names" aria-label="Anwesende Kinder">{present.map((child) =>
            <li key={child.id}>{child.name}{child.archived && <small className="archived-label">Archiviert</small>}</li>)}</ul>
            : <p className="muted">Niemand anwesend.</p>}
          <button className="secondary" aria-label={`Training öffnen: ${displayDate(training.date)}`}
            onClick={() => onOpenTraining(training.date)}>Training öffnen</button>
        </li>;
      })}</ul>
    )}
  </section>;
}
