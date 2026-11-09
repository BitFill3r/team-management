"use client";

import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/fields";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { displayDate, today } from "@/lib/client";
import { clampDate, firstDate, lastDate, monthDays, shiftDay, shiftMonth } from "@/lib/calendar";
import ActionIcon from "./action-icon";

const months = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1))));

export default function TrainingDatePicker({ value, trainingDates, disabled, onChange }: {
  value: string; trainingDates: string[]; disabled: boolean; onChange: (date: string) => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const focusPending = useRef(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(value);
  const [month, setMonth] = useState(value.slice(0, 7));
  const dates = new Set(trainingDates);
  const currentDay = today();
  const days = monthDays(month);

  useEffect(() => {
    if (open && focusPending.current) {
      dialog.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
      focusPending.current = false;
    }
  });
  useEffect(() => {
    if (disabled && dialog.current?.open) dialog.current.close();
  }, [disabled]);

  function moveFocus(date: string) {
    const next = clampDate(date);
    focusPending.current = true;
    setFocused(next); setMonth(next.slice(0, 7));
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const next = {
      ArrowLeft: () => shiftDay(date, -1), ArrowRight: () => shiftDay(date, 1),
      ArrowUp: () => shiftDay(date, -7), ArrowDown: () => shiftDay(date, 7),
      Home: () => shiftDay(date, -weekday), End: () => shiftDay(date, 6 - weekday),
      PageUp: () => shiftMonth(date, -1), PageDown: () => shiftMonth(date, 1),
    }[event.key];
    if (next) { event.preventDefault(); moveFocus(next()); }
  }
  function navigateMonth(next: string) {
    const date = clampDate(shiftMonth(focused, (Number(next.slice(0, 4)) - Number(month.slice(0, 4))) * 12
      + Number(next.slice(5)) - Number(month.slice(5))));
    setMonth(next); setFocused(date);
  }
  return <div className="min-w-0 max-w-[330px] [&_label]:text-muted [@media(width<=680px)]:w-full [@media(width<=680px)]:max-w-none">
    <Label htmlFor={`${id}-date`}>Trainingsdatum</Label>
    <div className="flex gap-2 [&_input]:min-w-0">
      <Input id={`${id}-date`} type="date" min={firstDate} max={lastDate} required value={value}
        disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      <Button variant="secondary" size="calendarToggle" type="button" disabled={disabled}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-calendar`}
        onClick={() => {
          setMonth(value.slice(0, 7)); setFocused(value); focusPending.current = true;
          dialog.current?.showModal(); setOpen(true);
        }}>Kalender</Button>
    </div>
    <dialog ref={dialog} id={`${id}-calendar`} className="fixed max-h-[calc(100dvh-16px)] w-[min(420px,calc(100%-16px))] max-w-none overflow-y-auto rounded-panel border border-control-border bg-surface p-5 text-ink [@media(width<=380px)]:px-1 [@media(width<=380px)]:py-2.5" aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-legend`} onClose={() => setOpen(false)}>
      <div className="mb-4 flex items-center justify-between gap-2 [&_h3]:m-0 [@media(width<=380px)]:mx-1">
        <h3 id={`${id}-title`}>Trainingsdatum wählen</h3>
        <Button variant="secondary" size="calendarClose" type="button" aria-label="Kalender schließen" onClick={() => dialog.current?.close()}><ActionIcon name="close" /></Button>
      </div>
      <div className="mb-3 flex items-center gap-1.5 [&>div]:min-w-0 [&>div]:flex-1 [&>div:first-of-type]:flex-[1.5] [&_select]:min-w-0 [&_select]:p-1 [@media(width<=380px)]:mx-1 [@media(width<=380px)]:gap-1">
        <Button variant="secondary" size="calendarArrow" type="button" aria-label="Vorheriger Monat" disabled={month === firstDate.slice(0, 7)}
          onClick={() => navigateMonth(shiftMonth(`${month}-01`, -1).slice(0, 7))}><ActionIcon name="left" /></Button>
        <div><Label className="sr-only" htmlFor={`${id}-month`}>Kalendermonat</Label>
          <Select id={`${id}-month`} value={month.slice(5)} onChange={(event) => navigateMonth(`${month.slice(0, 4)}-${event.target.value}`)}>
            {months.map((name, index) => <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>)}
          </Select></div>
        <div><Label className="sr-only" htmlFor={`${id}-year`}>Kalenderjahr</Label>
          <Select id={`${id}-year`} value={month.slice(0, 4)} onChange={(event) => navigateMonth(`${event.target.value}-${month.slice(5)}`)}>
            {Array.from({ length: 101 }, (_, index) => <option key={index} value={2000 + index}>{2000 + index}</option>)}
          </Select></div>
        <Button variant="secondary" size="calendarArrow" type="button" aria-label="Nächster Monat" disabled={month === lastDate.slice(0, 7)}
          onClick={() => navigateMonth(shiftMonth(`${month}-01`, 1).slice(0, 7))}><ActionIcon name="right" /></Button>
      </div>
      <p className="sr-only" aria-live="polite">{months[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</p>
      <table className="w-full table-fixed border-separate border-spacing-0 [&_th]:px-px [&_th]:pt-px [&_th]:pb-1.5 [&_th]:text-[.8rem] [&_th]:font-normal [&_th]:text-muted [&_td]:px-0 [&_td]:py-0.5 [&_td]:text-center" aria-label={`${months[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`}>
        <thead><tr>{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => <th scope="col" key={day}>{day}</th>)}</tr></thead>
        <tbody>{Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>
          {days.slice(week * 7, week * 7 + 7).map((date, index) => <td key={date ?? index}>
            {date && <Button variant="calendar" size="calendarDay" type="button" data-date={date} tabIndex={date === focused ? 0 : -1}
              className="relative flex flex-col items-center justify-center" data-today={date === currentDay}
              aria-current={date === currentDay ? "date" : undefined} aria-pressed={date === value}
              aria-label={`${displayDate(date)}${dates.has(date) ? ", Training angelegt" : ""}`}
              disabled={disabled} onFocus={() => setFocused(date)} onKeyDown={(event) => keyDown(event, date)}
              onClick={() => { dialog.current?.close(); onChange(date); }}>
              {Number(date.slice(8))}<span className="h-2.5 text-[.55rem] leading-[10px]" aria-hidden="true">{dates.has(date) ? "●" : ""}</span>
            </Button>}
          </td>)}
        </tr>)}</tbody>
      </table>
      <p id={`${id}-legend`} className="mt-3 mb-0 text-small text-muted [@media(width<=380px)]:mx-1"><span aria-hidden="true">●</span> Training angelegt · Rahmen: heute · Fläche: Auswahl</p>
      <p className="mt-3 mb-0 text-small text-muted [@media(width<=380px)]:mx-1">Freie Tage sind ebenfalls auswählbar. Trainings werden erst mit „Training anlegen“ erstellt.</p>
    </dialog>
  </div>;
}
