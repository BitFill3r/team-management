"use client";

import { Button, NavigationButton } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { Panel, SectionHeading, NavigationGroup } from "@/components/ui/panel";
import { ErrorMessage } from "@/components/ui/feedback";

import { useEffect, useState } from "react";
import { api, displayDate, errorMessage } from "@/lib/client";
import { monthSchema } from "@/lib/validation";
import type { MonthlyOverview, OverviewParticipant } from "@/lib/types";
import ActionIcon from "./action-icon";

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

  return <Panel>
    <SectionHeading><div><h2>Trainingsverlauf</h2><p className="mt-2 mb-0 text-small text-muted">UNSERE TRAININGSTAGE</p></div>
      <Button variant="secondary" disabled={loading} onClick={() => {
        setLoading(true); setError(""); setResult(null); setRefresh((value) => value + 1);
      }}>Aktualisieren</Button>
    </SectionHeading>
    <p className="text-muted">Wer war wann dabei? Zum Korrigieren einen Trainingstag öffnen.</p>
    <div className="mt-6 mb-[18px] flex items-end gap-2.5 [&>div]:min-w-0 [&>div]:max-w-[240px] [&>div]:flex-1 [&_input]:min-w-0 [@media(width<=380px)]:flex-wrap [@media(width<=380px)]:[&>div]:order-first [@media(width<=380px)]:[&>div]:max-w-none [@media(width<=380px)]:[&>div]:flex-[1_0_100%] [@media(width<=380px)]:[&_button]:flex-1">
      <Button variant="secondary" aria-label="Vorheriger Monat" disabled={month === "2000-01"}
        onClick={() => chooseMonth(adjacentMonth(month, -1))}><ActionIcon name="left" /></Button>
      <div><Label htmlFor="overview-month">Monat</Label>
        <Input id="overview-month" type="month" min="2000-01" max="2100-12" value={month}
          onChange={(event) => { if (event.target.value) chooseMonth(event.target.value); }} /></div>
      <Button variant="secondary" aria-label="Nächster Monat" disabled={month === "2100-12"}
        onClick={() => chooseMonth(adjacentMonth(month, 1))}><ActionIcon name="right" /></Button>
    </div>
    <NavigationGroup className="mb-[22px]" role="group" aria-label="Darstellung">
      <NavigationButton aria-pressed={view === "table"} active={view === "table"} onClick={() => setView("table")}>Tabelle</NavigationButton>
      <NavigationButton aria-pressed={view === "days"} active={view === "days"} onClick={() => setView("days")}>Tagesliste</NavigationButton>
    </NavigationGroup>
    <h3>{monthLabel(month)}</h3>
    {error && <ErrorMessage  role="alert"><p>{error}</p><Button variant="secondary" disabled={loading} onClick={() => {
      setLoading(true); setError(""); setResult(null); setRefresh((value) => value + 1);
    }}>Erneut versuchen</Button></ErrorMessage>}
    {loading || (!data && !error) ? <p role="status">Die Monatsübersicht wird geladen …</p> : data && (
      data.trainings.length === 0 ? <p className="px-2.5 py-[35px] text-center text-muted [&_h3]:text-ink">Keine Trainings in diesem Monat gespeichert.</p> : view === "table" ? <>
        <p className="text-small text-muted">✓ Anwesend · × Nicht anwesend · — Nicht in der damaligen Teilnehmerliste</p>
        <div className="relative max-w-full overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label={`Anwesenheitstabelle ${monthLabel(month)}, horizontal scrollbar`}>
          <table className="w-full border-separate border-spacing-0 text-[.9rem] tabular-nums [&_th]:min-w-[140px] [&_th]:border-b [&_th]:border-line [&_th]:p-3.5 [&_th]:text-center [&_td]:min-w-[140px] [&_td]:border-b [&_td]:border-line [&_td]:p-3.5 [&_td]:text-center [&_tr:last-child>*]:border-b-0 [&_tr>th:first-child]:sticky [&_tr>th:first-child]:left-0 [&_tr>th:first-child]:z-1 [&_tr>th:first-child]:min-w-[135px] [&_tr>th:first-child]:max-w-[180px] [&_tr>th:first-child]:bg-surface-subtle [&_tr>th:first-child]:text-left [&_tr>th:first-child]:[overflow-wrap:anywhere] [&_thead_th]:bg-surface-subtle [&_th_button]:whitespace-nowrap [&_th_button]:p-1.5">
            <caption className="sr-only">Anwesenheit im {monthLabel(month)}</caption>
            <thead><tr><th scope="col">Vorname</th>{data.trainings.map((training) =>
              <th scope="col" key={training.id}><Button variant="text" size="text" aria-label={`Training öffnen: ${displayDate(training.date)}`}
                onClick={() => onOpenTraining(training.date)}>{displayDate(training.date)}</Button></th>)}</tr></thead>
            <tbody>{children.map((child) => <tr key={child.id}>
              <th scope="row">{child.name}{child.archived && <small className="block text-small font-normal text-muted">Archiviert</small>}</th>
              {data.trainings.map((training, index) => {
                const participant = attendance?.[index].get(child.id);
                const label = !participant ? "Nicht in der damaligen Teilnehmerliste" : participant.present ? "Anwesend" : "Nicht anwesend";
                return <td key={training.id} className={participant?.present ? "bg-surface-present font-bold text-green" : ""}>
                  <span aria-hidden="true">{!participant ? "—" : participant.present ? "✓" : "×"}</span><span className="sr-only">{label}</span>
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
        {children.length === 0 && <p className="text-muted">In diesen Trainings sind keine Kinder mehr eingetragen.</p>}
      </> : <ul className="m-0 list-none p-0 [&>li]:border-t [&>li]:border-line [&>li]:py-[22px] [&_h3]:mb-0">{[...data.trainings].reverse().map((training) => {
        const present = training.participants.filter((child) => child.present);
        return <li key={training.id}><div className="mb-3 flex items-center justify-between gap-5 [@media(width<=680px)]:flex-wrap [@media(width<=680px)]:items-start [@media(width<=680px)]:gap-4"><h3>{displayDate(training.date)}</h3>
          <span className="whitespace-nowrap rounded-control bg-surface-subtle px-3 py-1.5 text-small">{present.length} / {training.participants.length} dabei</span></div>
          {present.length ? <ul data-ui="present-names" className="mt-0 mb-4 flex list-none flex-wrap gap-2 p-0 [&_li]:rounded-control [&_li]:bg-surface-present [&_li]:px-3 [&_li]:py-1.5" aria-label="Anwesende Kinder">{present.map((child) =>
            <li key={child.id}>{child.name}{child.archived && <small className="block text-small font-normal text-muted">Archiviert</small>}</li>)}</ul>
            : <p className="text-muted">Niemand anwesend.</p>}
          <Button variant="secondary" aria-label={`Training öffnen: ${displayDate(training.date)}`}
            onClick={() => onOpenTraining(training.date)}>Training öffnen</Button>
        </li>;
      })}</ul>
    )}
  </Panel>;
}
