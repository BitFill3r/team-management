"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, displayDate, errorMessage, today } from "@/lib/client";
import type { Child, Participant, Snapshot, Training } from "@/lib/types";
import { dateSchema } from "@/lib/validation";
import AttendanceOverview from "./attendance-overview";
import TrainingDatePicker from "./training-date-picker";

type View = "training" | "history" | "admin";
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

  return <div className="app-shell">
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Am Ball – Startseite" aria-disabled={busy}
        onClick={(event) => { if (busy) event.preventDefault(); }}><span className="brand-mark small" aria-hidden="true">AB</span>Am Ball<span className="accent">.</span></Link>
      <button className="text-button" disabled={busy} onClick={() => void mutate(async () => {
        await api("logout", "POST", {}); router.replace("/login"); router.refresh();
      }, "Abgemeldet.")}>Abmelden</button>
    </header>
    <main>
      <div className="page-heading"><div><p className="eyebrow">G-JUGEND · TRAINERBEREICH</p><h1>Kleine Kicker.<br />Großes Team.</h1></div><div className="team-badge">G<span>JUGEND</span></div></div>
      <nav className="tabs" aria-label="Hauptnavigation">
        {([["training", "Training"], ["history", "Verlauf"], ["admin", "Kinder verwalten"]] as const).map(([key, label]) =>
          <button key={key} className={view === key ? "active" : ""} aria-current={view === key ? "page" : undefined}
            disabled={busy} onClick={() => setView(key)}>{label}</button>)}
      </nav>
      <div className="feedback" aria-live="polite" role="status">{status}</div>
      {error && <div className="error error-panel" role="alert"><p>{error}</p><button className="secondary" disabled={busy || loading} onClick={reload}>Gespeicherten Stand neu laden</button> <Link href="/login">Zur Anmeldung</Link></div>}
      {loading ? <section className="card"><p role="status">Die Teamliste wird geladen …</p></section> : snapshot && <>
        {view === "training" && <section className="card">
          <div className="section-heading"><div><p className="eyebrow">AB AUF DEN PLATZ</p><h2>Wer ist dabei?</h2></div>
            <TrainingDatePicker value={date} trainingDates={snapshot.history.map((entry) => entry.date)} disabled={busy || needsReload} onChange={chooseDate} />
          </div>
          {!training ? <div className="empty">
            <div className="empty-icon" aria-hidden="true">+</div><h3>Noch kein Training an diesem Tag</h3>
            <p>Lege das Training für den {displayDate(date)} an. Alle aktuell aktiven Kinder werden aufgenommen.</p>
            {snapshot.children.every((child) => child.archived) && <p>Deine Teamliste ist noch leer. Füge am besten zuerst Kinder in der Verwaltung hinzu.</p>}
            <button disabled={disabled || snapshot.children.every((child) => child.archived)} onClick={() => void mutate(async () => {
              const created = await api<Training>("training", "POST", { date });
              setSnapshot((previous) => previous ? { ...previous, training: created, history: [{ id: created.id, date: created.date, total: created.participants.length, present: 0 }, ...previous.history].sort((a, b) => b.date.localeCompare(a.date)) } : previous);
            }, "Training angelegt.")}>Training anlegen</button>
          </div> : <>
            <div className="attendance-summary"><div><strong>{training.participants.filter((child) => child.present).length}</strong><span> / {training.participants.length} dabei</span></div><span className="save-hint">Wird direkt gespeichert</span></div>
            <progress aria-label="Anwesende Kinder" value={training.participants.filter((child) => child.present).length} max={Math.max(1, training.participants.length)} />
            <div className="participants">
              {training.participants.map((child) => <label className={`participant ${child.present ? "present" : ""}`} key={child.id}>
                <span className="avatar" aria-hidden="true">{child.name.slice(0, 1).toLocaleUpperCase("de")}</span>
                <span className="participant-name">{child.name}{child.archived && <small>Archiviert</small>}</span>
                <input type="checkbox" checked={child.present} disabled={loading || needsReload}
                  aria-disabled={mutating || pendingChildren.includes(child.id)} aria-busy={pendingChildren.includes(child.id)}
                  onChange={(event) => void changeAttendance(child, event.target.checked)} aria-label={`${child.name}: anwesend`} />
              </label>)}
            </div>
            {training.participants.length === 0 && <p className="muted">Dieses Training enthält keine Kinder mehr.</p>}
            <div className="card-footer"><p className="muted">Falsch getippt? Einfach das Häkchen wieder ändern.</p><button className="secondary" disabled={disabled || !undo} onClick={() => {
              const child = training.participants.find((entry) => entry.id === undo?.childId);
              if (child && undo) void changeAttendance(child, undo.present, undo.version, true);
            }}>Letzte Änderung rückgängig</button></div>
          </>}
        </section>}
        {view === "history" && <AttendanceOverview month={overviewMonth} onMonthChange={setOverviewMonth} onOpenTraining={chooseDate} />}
        {view === "admin" && <section className="card">
          <div className="section-heading"><div><p className="eyebrow">DAS SIND WIR</p><h2>Kinder verwalten</h2></div><span className="pill">{snapshot.children.filter((child) => !child.archived).length} aktiv</span></div>
          <p className="muted">Nur Vornamen, keine weiteren Kinderdaten. Neue Kinder werden auch in allen bereits angelegten Trainings ergänzt, zunächst als nicht anwesend.</p>
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
          {snapshot.children.length === 0 && <p className="empty">Noch keine Kinder eingetragen. Mit dem ersten Vornamen geht es los.</p>}
          {(["active", "archived"] as const).map((group) => {
            const children = snapshot.children.filter((child) => child.archived === (group === "archived"));
            if (!children.length) return null;
            return <div className="roster-group" key={group}><h3>{group === "active" ? "Aktive Kinder" : "Archivierte Kinder"}</h3>
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
          <p className="privacy-note">Archivieren bewahrt vergangene Trainingslisten. Endgültiges Löschen entfernt das Kind auch aus allen vergangenen Trainings.</p>
        </section>}
      </>}
      <footer className="site-footer">Am Ball · Gemeinsam auf dem Platz.<br /><span>Ein Teamzugang für Anwesenheit und Verwaltung.</span></footer>
    </main>
  </div>;
}

function AddChild({ disabled, onAdd }: { disabled: boolean; onAdd: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  return <form className="add-child" onSubmit={(event) => {
    event.preventDefault();
    void onAdd(name).then((saved) => { if (saved) setName(""); });
  }}>
    <div><label htmlFor="new-child">Neuer Vorname</label><input id="new-child" placeholder="z. B. Emil" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} disabled={disabled} /></div>
    <button disabled={disabled || !name.trim()}>+ Kind hinzufügen</button>
  </form>;
}

function ChildEditor({ child, disabled, duplicate, onSave, onDelete }: {
  child: Child; disabled: boolean; duplicate: boolean;
  onSave: (name: string, archived: boolean) => Promise<boolean>; onDelete: () => Promise<boolean>;
}) {
  const [name, setName] = useState(child.name);
  const [confirming, setConfirming] = useState(false);
  return <div className="child-editor">
    <form onSubmit={(event) => { event.preventDefault(); void onSave(name, child.archived); }}>
      <div className="name-input"><label htmlFor={`name-${child.id}`}>Vorname</label><input id={`name-${child.id}`} value={name} required maxLength={60} disabled={disabled} onChange={(event) => setName(event.target.value)} />
        {duplicate && <small className="duplicate">Gleicher Vorname mehrfach vorhanden. Zur Unterscheidung ggf. einen kurzen Zusatz verwenden.</small>}</div>
      <div className="row-actions">
        <button className="secondary" disabled={disabled || !name.trim() || name.trim() === child.name}>Umbenennen</button>
        <button className="secondary" type="button" disabled={disabled} onClick={() => void onSave(child.name, !child.archived)}>{child.archived ? "Reaktivieren" : "Archivieren"}</button>
        <button className="text-button danger" type="button" disabled={disabled} onClick={() => setConfirming(true)}>Löschen</button>
      </div>
    </form>
    {confirming && <div className="delete-confirm" role="group" aria-label={`${child.name} endgültig löschen`}>
      <p><strong>{child.name} endgültig löschen?</strong> Dabei werden alle zugehörigen Anwesenheitsdaten aus allen Trainings entfernt. Das kann nicht rückgängig gemacht werden.</p>
      <div className="row-actions"><button className="danger-button" disabled={disabled} onClick={() => void onDelete()}>Ja, endgültig löschen</button><button className="secondary" disabled={disabled} onClick={() => setConfirming(false)}>Abbrechen</button></div>
    </div>}
  </div>;
}
