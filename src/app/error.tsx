"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="login-shell"><section className="card">
    <h1>Die App ist gerade nicht erreichbar.</h1>
    <p>Bitte die Verbindung prüfen und erneut versuchen. Falls der Fehler bleibt, muss die Serverkonfiguration geprüft werden.</p>
    <button onClick={reset}>Erneut versuchen</button>
  </section></main>;
}
