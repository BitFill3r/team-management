"use client";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="grid flex-1 place-items-center px-6 py-12"><Panel>
    <h1>Die App ist gerade nicht erreichbar.</h1>
    <p>Bitte die Verbindung prüfen und erneut versuchen. Falls der Fehler bleibt, muss die Serverkonfiguration geprüft werden.</p>
    <Button onClick={reset}>Erneut versuchen</Button>
  </Panel></main>;
}
