"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { displayDate, today } from "@/lib/client";
import { clampDate, firstDate, lastDate, monthDays, shiftDay, shiftMonth } from "@/lib/calendar";

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
  return <div className="date-field">
    <label htmlFor={`${id}-date`}>Trainingsdatum</label>
    <div className="date-controls">
      <input id={`${id}-date`} type="date" min={firstDate} max={lastDate} required value={value}
        disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      <button className="secondary calendar-toggle" type="button" disabled={disabled}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-calendar`}
        onClick={() => {
          setMonth(value.slice(0, 7)); setFocused(value); focusPending.current = true;
          dialog.current?.showModal(); setOpen(true);
        }}>Kalender</button>
    </div>
    <dialog ref={dialog} id={`${id}-calendar`} className="training-calendar" aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-legend`} onClose={() => setOpen(false)}>
      <div className="calendar-heading">
        <h3 id={`${id}-title`}>Trainingsdatum wählen</h3>
        <button type="button" className="secondary" aria-label="Kalender schließen" onClick={() => dialog.current?.close()}>×</button>
      </div>
      <div className="calendar-navigation">
        <button type="button" className="secondary" aria-label="Vorheriger Monat" disabled={month === firstDate.slice(0, 7)}
          onClick={() => navigateMonth(shiftMonth(`${month}-01`, -1).slice(0, 7))}>‹</button>
        <div><label className="sr-only" htmlFor={`${id}-month`}>Kalendermonat</label>
          <select id={`${id}-month`} value={month.slice(5)} onChange={(event) => navigateMonth(`${month.slice(0, 4)}-${event.target.value}`)}>
            {months.map((name, index) => <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>)}
          </select></div>
        <div><label className="sr-only" htmlFor={`${id}-year`}>Kalenderjahr</label>
          <select id={`${id}-year`} value={month.slice(0, 4)} onChange={(event) => navigateMonth(`${event.target.value}-${month.slice(5)}`)}>
            {Array.from({ length: 101 }, (_, index) => <option key={index} value={2000 + index}>{2000 + index}</option>)}
          </select></div>
        <button type="button" className="secondary" aria-label="Nächster Monat" disabled={month === lastDate.slice(0, 7)}
          onClick={() => navigateMonth(shiftMonth(`${month}-01`, 1).slice(0, 7))}>›</button>
      </div>
      <p className="sr-only" aria-live="polite">{months[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</p>
      <table className="calendar-grid" aria-label={`${months[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`}>
        <thead><tr>{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => <th scope="col" key={day}>{day}</th>)}</tr></thead>
        <tbody>{Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>
          {days.slice(week * 7, week * 7 + 7).map((date, index) => <td key={date ?? index}>
            {date && <button type="button" data-date={date} tabIndex={date === focused ? 0 : -1}
              className={`calendar-day${date === value ? " selected" : ""}${date === currentDay ? " today" : ""}`}
              aria-current={date === currentDay ? "date" : undefined} aria-pressed={date === value}
              aria-label={`${displayDate(date)}${dates.has(date) ? ", Training angelegt" : ""}`}
              disabled={disabled} onFocus={() => setFocused(date)} onKeyDown={(event) => keyDown(event, date)}
              onClick={() => { dialog.current?.close(); onChange(date); }}>
              {Number(date.slice(8))}<span className="calendar-marker" aria-hidden="true">{dates.has(date) ? "●" : ""}</span>
            </button>}
          </td>)}
        </tr>)}</tbody>
      </table>
      <p id={`${id}-legend`} className="calendar-legend"><span aria-hidden="true">●</span> Training angelegt · Rahmen: heute · Fläche: Auswahl</p>
      <p className="calendar-help">Freie Tage sind ebenfalls auswählbar. Trainings werden erst mit „Training anlegen“ erstellt.</p>
    </dialog>
  </div>;
}
