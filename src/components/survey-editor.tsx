"use client";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label, Checkbox, Fieldset } from "@/components/ui/fields";

import { useId, useState } from "react";
import type { SurveyConfig } from "@/lib/survey-types";
import ActionIcon from "./action-icon";

export type PasswordChoice = { mode: "generated" } | { mode: "manual"; password: string };
export function PasswordFields({ disabled, value, onChange }: { disabled: boolean; value: PasswordChoice; onChange: (value: PasswordChoice) => void }) {
  const id = useId();
  return <Fieldset disabled={disabled}><legend>Passwortvergabe</legend>
    <Label htmlFor={`${id}-mode`}>Passwort festlegen</Label>
    <Select id={`${id}-mode`} value={value.mode} onChange={(event) => onChange(event.target.value === "generated" ? { mode: "generated" } : { mode: "manual", password: "" })}>
      <option value="generated">Sicheres Passwort generieren</option><option value="manual">Eigenes Passwort setzen</option>
    </Select>
    {value.mode === "manual" && <><Label htmlFor={`${id}-password`}>Neues Passwort (12–128 Zeichen)</Label>
      <Input id={`${id}-password`} type="password" autoComplete="new-password" minLength={12} maxLength={128} required
        value={value.password} onChange={(event) => onChange({ mode: "manual", password: event.target.value })} /></>}
  </Fieldset>;
}
export const initialSurveyConfig: SurveyConfig = {
  title: "", description: "", firstLabel: "Vorname des Kindes", firstPlaceholder: "", firstRequired: true,
  secondLabel: "Trikotgröße", secondPlaceholder: "", secondRequired: true,
  secondType: "single_choice", warnDuplicates: true, options: ["116", "128", "140", "152", "164"],
};

export default function SurveyEditor({ initial, published, busy, creating, onSave }: {
  initial: SurveyConfig; published: boolean; busy: boolean; creating: boolean;
  onSave: (config: SurveyConfig, password: PasswordChoice) => Promise<void>;
}) {
  const id = useId();
  const [config, setConfig] = useState(initial);
  const [password, setPassword] = useState<PasswordChoice>({ mode: "generated" });
  const set = <K extends keyof SurveyConfig>(key: K, value: SurveyConfig[K]) => setConfig((previous) => ({ ...previous, [key]: value }));
  return <form onSubmit={(event) => { event.preventDefault(); void onSave(config, password); }}>
    <Fieldset disabled={busy}><legend>Umfrage</legend>
      <Label htmlFor={`${id}-title`}>Titel</Label><Input id={`${id}-title`} required maxLength={120} value={config.title} onChange={(event) => set("title", event.target.value)} />
      <Label htmlFor={`${id}-description`}>Beschreibung und Zweck</Label><Textarea id={`${id}-description`} maxLength={2000}
        value={config.description} onChange={(event) => set("description", event.target.value)} />
      <Label layout="check" data-ui="check-label"><Checkbox  checked={config.warnDuplicates} onChange={(event) => set("warnDuplicates", event.target.checked)} />Gleiche Werte im ersten Feld als mögliche Doppelung markieren</Label>
    </Fieldset>
    {published && <p className="text-muted">Die Felddefinitionen sind seit der ersten Veröffentlichung gesperrt. Für andere Fragen bitte eine neue Umfrage erstellen.</p>}
    <Fieldset disabled={busy || published}><legend>Feld 1 · Freitext (max. 200 Zeichen)</legend>
      <Label htmlFor={`${id}-first-label`}>Label für Feld 1</Label><Input id={`${id}-first-label`} required maxLength={120} value={config.firstLabel} onChange={(event) => set("firstLabel", event.target.value)} />
      <Label htmlFor={`${id}-first-placeholder`}>Platzhalter für Feld 1 (optional)</Label><Input id={`${id}-first-placeholder`} maxLength={120} value={config.firstPlaceholder} onChange={(event) => set("firstPlaceholder", event.target.value)} />
      <Label layout="check" data-ui="check-label"><Checkbox  checked={config.firstRequired} onChange={(event) => set("firstRequired", event.target.checked)} />Feld 1 ist Pflicht</Label>
    </Fieldset>
    <Fieldset disabled={busy || published}><legend>Feld 2</legend>
      <Label htmlFor={`${id}-type`}>Antworttyp für Feld 2</Label>
      <Select id={`${id}-type`} value={config.secondType} onChange={(event) => {
        const secondType = event.target.value === "text" ? "text" : "single_choice";
        setConfig((previous) => ({ ...previous, secondType, options: secondType === "text" ? [] : ["", ""], secondPlaceholder: "" }));
      }}><option value="single_choice">Einzelauswahl</option><option value="text">Freitext (max. 200 Zeichen)</option></Select>
      <p className="text-muted">Ein Typwechsel verwirft die bisherigen Optionen und den Platzhalter für Feld 2.</p>
      <Label htmlFor={`${id}-second-label`}>Label für Feld 2</Label><Input id={`${id}-second-label`} required maxLength={120} value={config.secondLabel} onChange={(event) => set("secondLabel", event.target.value)} />
      {config.secondType === "text"
        ? <><Label htmlFor={`${id}-second-placeholder`}>Platzhalter für Feld 2 (optional)</Label><Input id={`${id}-second-placeholder`} maxLength={120} value={config.secondPlaceholder} onChange={(event) => set("secondPlaceholder", event.target.value)} /></>
        : <div ><p>2–30 eindeutige Optionen, jeweils maximal 60 Zeichen</p>
          {config.options.map((option, index) => <div className="mb-3 flex items-end gap-1.5 [&>div]:min-w-0 [&>div]:flex-1" key={index}>
            <div><Label htmlFor={`${id}-option-${index}`}>Option {index + 1}</Label><Input id={`${id}-option-${index}`} required maxLength={60}
              value={option} onChange={(event) => set("options", config.options.map((value, position) => position === index ? event.target.value : value))} /></div>
            <Button variant="secondary" size="icon" type="button" aria-label={`Option ${index + 1} nach oben`} disabled={index === 0} onClick={() => {
              const next = [...config.options]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; set("options", next);
            }}>↑</Button>
            <Button variant="danger-secondary" size="icon" type="button" aria-label={`Option ${index + 1} entfernen`} disabled={config.options.length <= 2}
              onClick={() => set("options", config.options.filter((_, position) => position !== index))}><ActionIcon name="close" /></Button>
          </div>)}
          <Button variant="secondary" type="button" disabled={config.options.length >= 30} onClick={() => set("options", [...config.options, ""])}>Option hinzufügen</Button>
        </div>}
      <Label layout="check" data-ui="check-label"><Checkbox  checked={config.secondRequired} onChange={(event) => set("secondRequired", event.target.checked)} />Feld 2 ist Pflicht</Label>
    </Fieldset>
    {creating && <PasswordFields disabled={busy} value={password} onChange={setPassword} />}
    <p className="text-muted">Mindestens eines der beiden Felder muss pro Einsendung ausgefüllt werden, auch wenn beide optional sind.</p>
    <Button type="submit" disabled={busy}>{creating ? "Entwurf erstellen" : "Änderungen speichern"}</Button>
  </form>;
}
