"use client";

import { Button, NavigationButton } from "@/components/ui/button";
import { Input, Label, Checkbox } from "@/components/ui/fields";
import { Panel, SectionHeading, NavigationGroup } from "@/components/ui/panel";
import { ErrorMessage } from "@/components/ui/feedback";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, displayDate, errorMessage, today } from "@/lib/client";
import type { Child, Participant, Snapshot, Training } from "@/lib/types";
import { dateSchema } from "@/lib/validation";
import AttendanceOverview from "./attendance-overview";
import TrainingDatePicker from "./training-date-picker";
import SurveyManager from "./survey-manager";

type View = "training" | "history" | "admin" | "surveys";
type Undo = { childId: string; present: boolean; version: number };

export default function Dashboard() {
  const router = useRouter();
  const [view, setView] = useState<View>("training");
  const [date, setDate] = useState(today);
  const [overviewMonth, setOverviewMonth] = useState(() => today().slice(0, 7));
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mutating, setBusy] = useState(false);
  const [pendingChildren, setPendingChildren] = useState<string[]>([]);
  const pending = useRef(new Set<string>());
  const failed = useRef(false);
  const busy = mutating || pendingChildren.length > 0;
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (!pendingChildren.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingChildren.length]);

  useEffect(() => {
    const controller = new AbortController();
    api<Snapshot>(`dashboard?date=${date}`, "GET", undefined, controller.signal).then((snapshot) => {
      if (controller.signal.aborted) return;
      setSnapshot(snapshot);
      failed.current = false;
      setLoading(false); setNeedsReload(false);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setError(errorMessage(error)); setLoading(false); setNeedsReload(true);
    });
    return () => controller.abort();
  }, [date, refresh]);

  function reload() {
    setError(""); setStatus(""); setUndo(null); setLoading(true);
    setRefresh((value) => value + 1);
  }
  function chooseDate(value: string) {
    if (!value) return;
    if (!dateSchema.safeParse(value).success) {
      setError("Bitte ein gültiges Trainingsdatum zwischen 2000 und 2100 wählen.");
      return;
    }
    setView("training");
    if (value === date) return;
    setLoading(true); setError(""); setStatus(""); setUndo(null); setDate(value);
  }
  async function mutate(action: () => Promise<void>, message: string) {
    if (lock.current || pending.current.size) return false;
    lock.current = true; setBusy(true); setError(""); setStatus("Wird gespeichert …");
    try {
      await action();
      setStatus(message);
      return true;
    } catch (error) {
      setError(errorMessage(error)); setStatus(""); setNeedsReload(true); setUndo(null);
      return false;
    } finally {
      lock.current = false; setBusy(false);
    }
  }
  const training = snapshot?.training;
  const disabled = busy || loading || needsReload;

  function showAttendance(childId: string, present: boolean, version?: number) {
    setSnapshot((previous) => {
      if (!previous?.training) return previous;
      const child = previous.training.participants.find((entry) => entry.id === childId);
      if (!child) return previous;
      return {
        ...previous,
        training: { ...previous.training, participants: previous.training.participants.map((entry) => entry.id === childId
          ? { ...entry, present, attendanceVersion: version ?? entry.attendanceVersion } : entry) },
        history: previous.history.map((entry) => entry.id === previous.training?.id
          ? { ...entry, present: entry.present + Number(present) - Number(child.present) } : entry),
      };
    });
  }

  async function changeAttendance(child: Participant, present: boolean, version = child.attendanceVersion, isUndo = false) {
    if (!training || lock.current || loading || needsReload || failed.current || pending.current.has(child.id)) return;
    pending.current.add(child.id);
    setPendingChildren([...pending.current]);
    setUndo(null); setError(""); setStatus("Wird gespeichert …");
    showAttendance(child.id, present);
    try {
      const saved = await api<{ present: boolean; version: number }>("attendance", "PATCH", {
        trainingId: training.id, childId: child.id, present, version,
      });
      showAttendance(child.id, saved.present, saved.version);
      if (!failed.current) {
        setUndo(isUndo ? null : { childId: child.id, present: child.present, version: saved.version });
        setStatus(isUndo ? "Letzte Änderung rückgängig gemacht." : "Anwesenheit gespeichert.");
      }
    } catch (error) {
      failed.current = true;
      showAttendance(child.id, child.present, child.attendanceVersion);
      setError(errorMessage(error)); setNeedsReload(true); setUndo(null); setStatus("");
    } finally {
      pending.current.delete(child.id);
      setPendingChildren([...pending.current]);
      if (pending.current.size && !failed.current) setStatus("Wird gespeichert …");
    }
  }

  return <div className="mx-auto w-full max-w-[1040px] flex-1 px-8 [@media(width<=680px)]:px-4">
    <header className="flex items-center justify-between border-b border-line py-3">
      <Link className="flex items-center gap-2 text-[1.4rem] font-extrabold tracking-[-.02em] text-ink no-underline [&_.text-green]:-ml-[7px]" href="/" aria-label="Am Ball – Startseite" aria-disabled={busy}
        onClick={(event) => { if (busy) event.preventDefault(); }}><span className="mr-1 grid size-9 place-items-center rounded-control bg-green text-[.9rem] font-extrabold tracking-[-.02em] text-lime" aria-hidden="true">AB</span>Am Ball<span className="text-green">.</span></Link>
      <Button variant="text" size="text" disabled={busy} onClick={() => void mutate(async () => {
        await api("logout", "POST", {}); router.replace("/login"); router.refresh();
      }, "Abgemeldet.")}>Abmelden</Button>
    </header>
    <main>
      <div className="flex items-center justify-between gap-4 pt-6 pb-5 [&_h1]:m-0 [@media(width<=680px)]:pt-5 [@media(width<=680px)]:pb-4"><div><h1>Kleine Kicker.<br />Großes Team.</h1><p className="mt-2 mb-0 text-small text-muted">G-JUGEND · TRAINERBEREICH</p></div><div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-control border border-line bg-surface text-[1.75rem] leading-none font-bold text-green [&_span]:mt-2 [&_span]:text-xs [&_span]:tracking-[.06em] [@media(width<=680px)]:h-16 [@media(width<=680px)]:w-14 [@media(width<=680px)]:text-2xl [@media(width<=680px)]:[&_span]:text-[.6875rem]">G<span>JUGEND</span></div></div>
      <NavigationGroup as="nav" aria-label="Hauptnavigation">
        {([["training", "Training"], ["history", "Verlauf"], ["admin", "Kinder verwalten"], ["surveys", "Umfragen"]] as const).map(([key, label]) =>
          <NavigationButton key={key} active={view === key} aria-current={view === key ? "page" : undefined}
            disabled={busy} onClick={() => setView(key)}>{label}</NavigationButton>)}
      </NavigationGroup>
      <div className="min-h-9 px-[3px] py-1.5 text-small text-green" aria-live={view === "surveys" ? undefined : "polite"} role={view === "surveys" ? undefined : "status"}>{view !== "surveys" && status}</div>
      {error && <ErrorMessage className="mb-[18px] [&_p]:mb-2" role="alert"><p>{error}</p><Button variant="secondary" disabled={busy || loading} onClick={reload}>Gespeicherten Stand neu laden</Button> <Link href="/login">Zur Anmeldung</Link></ErrorMessage>}
      {loading ? <Panel><p role="status">Die Teamliste wird geladen …</p></Panel> : snapshot && <>
        {view === "training" && <Panel>
          <SectionHeading><div><h2>Wer ist dabei?</h2><p className="mt-2 mb-0 text-small text-muted">AB AUF DEN PLATZ</p></div>
            <TrainingDatePicker value={date} trainingDates={snapshot.history.map((entry) => entry.date)} disabled={busy || needsReload} onChange={chooseDate} />
          </SectionHeading>
          {!training ? <div className="px-2.5 py-[35px] text-center text-muted [&_h3]:text-ink">
            <h3>Noch kein Training an diesem Tag</h3>
            <p>Lege das Training für den {displayDate(date)} an. Alle aktuell aktiven Kinder werden aufgenommen.</p>
            {snapshot.children.every((child) => child.archived) && <p>Deine Teamliste ist noch leer. Füge am besten zuerst Kinder in der Verwaltung hinzu.</p>}
            <Button disabled={disabled || snapshot.children.every((child) => child.archived)} onClick={() => void mutate(async () => {
              const created = await api<Training>("training", "POST", { date });
              setSnapshot((previous) => previous ? { ...previous, training: created, history: [{ id: created.id, date: created.date, total: created.participants.length, present: 0 }, ...previous.history].sort((a, b) => b.date.localeCompare(a.date)) } : previous);
            }, "Training angelegt.")}>Training anlegen</Button>
          </div> : <>
            <div className="flex items-center justify-between gap-3 tabular-nums [&_strong]:text-[2rem] [&_span]:text-muted [@media(width<=680px)]:flex-wrap"><div><strong>{training.participants.filter((child) => child.present).length}</strong><span> / {training.participants.length} dabei</span></div><span className="text-small">Wird direkt gespeichert</span></div>
            <progress aria-label="Anwesende Kinder" value={training.participants.filter((child) => child.present).length} max={Math.max(1, training.participants.length)} />
            <div className="grid grid-cols-2 gap-x-6 [@media(width<=680px)]:grid-cols-1">
              {training.participants.map((child) => <label data-ui="participant" data-present={child.present}
                className="group m-0 flex min-h-[76px] cursor-pointer items-center gap-3 border-b border-line px-3 py-4 font-bold transition-[background] duration-150 data-[present=true]:bg-surface-present motion-reduce:transition-none motion-reduce:duration-0 [@media(width<=680px)]:min-h-[74px]" key={child.id}>
                <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-subtle text-base text-muted group-data-[present=true]:bg-green group-data-[present=true]:text-surface" aria-hidden="true">{child.name.slice(0, 1).toLocaleUpperCase("de")}</span>
                <span className="flex-1 text-base [overflow-wrap:anywhere] [&_small]:block [&_small]:text-small [&_small]:font-normal [&_small]:text-muted">{child.name}{child.archived && <small>Archiviert</small>}</span>
                <Checkbox size="attendance" checked={child.present} disabled={loading || needsReload}
                  aria-disabled={mutating || pendingChildren.includes(child.id)} aria-busy={pendingChildren.includes(child.id)}
                  onChange={(event) => void changeAttendance(child, event.target.checked)} aria-label={`${child.name}: anwesend`} />
              </label>)}
            </div>
            {training.participants.length === 0 && <p className="text-muted">Dieses Training enthält keine Kinder mehr.</p>}
            <div className="mt-[26px] flex items-center justify-between gap-[15px] border-t border-line pt-5 [&_p]:m-0 [&_p]:text-small [&_button]:shrink-0 [&_button]:text-small [@media(width<=680px)]:flex-col [@media(width<=680px)]:items-start"><p className="text-muted">Falsch getippt? Einfach das Häkchen wieder ändern.</p><Button variant="secondary" disabled={disabled || !undo} onClick={() => {
              const child = training.participants.find((entry) => entry.id === undo?.childId);
              if (child && undo) void changeAttendance(child, undo.present, undo.version, true);
            }}>Letzte Änderung rückgängig</Button></div>
          </>}
        </Panel>}
        {view === "history" && <AttendanceOverview month={overviewMonth} onMonthChange={setOverviewMonth} onOpenTraining={chooseDate} />}
        {view === "surveys" && <SurveyManager onBusy={setBusy} />}
        {view === "admin" && <Panel>
          <SectionHeading><div><h2>Kinder verwalten</h2><p className="mt-2 mb-0 text-small text-muted">DAS SIND WIR</p></div><span className="whitespace-nowrap rounded-control bg-surface-subtle px-3 py-1.5 text-small">{snapshot.children.filter((child) => !child.archived).length} aktiv</span></SectionHeading>
          <p className="text-muted">Nur Vornamen, keine weiteren Kinderdaten. Neue Kinder werden auch in allen bereits angelegten Trainings ergänzt, zunächst als nicht anwesend.</p>
          <AddChild disabled={disabled} onAdd={async (name) => {
            return mutate(async () => {
              const child = await api<Child>("children", "POST", { name });
              setSnapshot((previous) => previous ? {
                ...previous,
                children: [...previous.children, child],
                training: previous.training ? {
                  ...previous.training,
                  participants: [...previous.training.participants, { ...child, present: false, attendanceVersion: 0 }]
                    .sort((a, b) => a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id)),
                } : null,
                history: previous.history.map((entry) => ({ ...entry, total: entry.total + 1 })),
              } : previous);
            }, "Kind hinzugefügt.");
          }} />
          {snapshot.children.length === 0 && <p className="px-2.5 py-[35px] text-center text-muted [&_h3]:text-ink">Noch keine Kinder eingetragen. Mit dem ersten Vornamen geht es los.</p>}
          {(["active", "archived"] as const).map((group) => {
            const children = snapshot.children.filter((child) => child.archived === (group === "archived"));
            if (!children.length) return null;
            return <div className="mt-[25px]" key={group}><h3>{group === "active" ? "Aktive Kinder" : "Archivierte Kinder"}</h3>
              {children.map((child) => <ChildEditor key={`${child.id}:${child.version}`} child={child} disabled={disabled}
                duplicate={snapshot.children.filter((other) => other.name.toLocaleLowerCase("de") === child.name.toLocaleLowerCase("de")).length > 1}
                onSave={(name, archived) => mutate(async () => {
                  const saved = await api<Child>("children", "PATCH", { ...child, name, archived });
                  setSnapshot((previous) => previous ? {
                    ...previous, children: previous.children.map((entry) => entry.id === child.id ? saved : entry),
                    training: previous.training ? { ...previous.training, participants: previous.training.participants.map((entry) => entry.id === child.id ? { ...entry, ...saved } : entry) } : null,
                  } : previous);
                }, "Namensliste gespeichert.")}
                onDelete={() => mutate(async () => {
                  await api("children", "DELETE", { id: child.id, version: child.version, confirmed: true });
                  reload();
                }, "Kind und zugehörige Anwesenheitsdaten endgültig gelöscht.")} />)}
            </div>;
          })}
          <p className="mt-6 mb-0 text-small text-muted">Archivieren bewahrt vergangene Trainingslisten. Endgültiges Löschen entfernt das Kind auch aus allen vergangenen Trainings.</p>
        </Panel>}
      </>}
      <div className="py-8 text-center text-small text-muted">Am Ball · Gemeinsam auf dem Platz.<br /><span>Ein Teamzugang für Anwesenheit und Verwaltung.</span></div>
    </main>
  </div>;
}

function AddChild({ disabled, onAdd }: { disabled: boolean; onAdd: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  return <form className="mt-[22px] mb-7 flex items-end gap-3 rounded-control bg-surface-subtle p-5 [&>div]:flex-1 [&_button]:mb-px [@media(width<=680px)]:flex-col [@media(width<=680px)]:items-stretch [@media(width<=680px)]:p-4" onSubmit={(event) => {
    event.preventDefault();
    void onAdd(name).then((saved) => { if (saved) setName(""); });
  }}>
    <div><Label htmlFor="new-child">Neuer Vorname</Label><Input id="new-child" placeholder="z. B. Emil" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} disabled={disabled} /></div>
    <Button type="submit" disabled={disabled || !name.trim()}>+ Kind hinzufügen</Button>
  </form>;
}

function ChildEditor({ child, disabled, duplicate, onSave, onDelete }: {
  child: Child; disabled: boolean; duplicate: boolean;
  onSave: (name: string, archived: boolean) => Promise<boolean>; onDelete: () => Promise<boolean>;
}) {
  const [name, setName] = useState(child.name);
  const [confirming, setConfirming] = useState(false);
  return <div data-ui="child-editor" className="border-t border-line py-[18px] [&_form]:flex [&_form]:items-end [&_form]:gap-3 [@media(width<=680px)]:[&_form]:flex-col [@media(width<=680px)]:[&_form]:items-stretch">
    <form onSubmit={(event) => { event.preventDefault(); void onSave(name, child.archived); }}>
      <div className="min-w-0 flex-1 [&_label]:text-muted"><Label htmlFor={`name-${child.id}`}>Vorname</Label><Input id={`name-${child.id}`} value={name} required maxLength={60} disabled={disabled} onChange={(event) => setName(event.target.value)} />
        {duplicate && <small className="block pt-[5px] text-[#83550a]">Gleicher Vorname mehrfach vorhanden. Zur Unterscheidung ggf. einen kurzen Zusatz verwenden.</small>}</div>
      <div className="flex flex-wrap gap-2 [&_button]:px-3 [&_button]:text-small">
        <Button variant="secondary" type="submit" disabled={disabled || !name.trim() || name.trim() === child.name}>Umbenennen</Button>
        <Button variant="secondary" type="button" disabled={disabled} onClick={() => void onSave(child.name, !child.archived)}>{child.archived ? "Reaktivieren" : "Archivieren"}</Button>
        <Button variant="danger-text" size="text" type="button" disabled={disabled} onClick={() => setConfirming(true)}>Löschen</Button>
      </div>
    </form>
    {confirming && <div className="mt-3.5 rounded-control bg-error-bg p-4 text-[.9375rem]" role="group" aria-label={`${child.name} endgültig löschen`}>
      <p><strong>{child.name} endgültig löschen?</strong> Dabei werden alle zugehörigen Anwesenheitsdaten aus allen Trainings entfernt. Das kann nicht rückgängig gemacht werden.</p>
      <div className="flex flex-wrap gap-2 [&_button]:px-3 [&_button]:text-small"><Button variant="danger" disabled={disabled} onClick={() => void onDelete()}>Ja, endgültig löschen</Button><Button variant="secondary" disabled={disabled} onClick={() => setConfirming(false)}>Abbrechen</Button></div>
    </div>}
  </div>;
}
