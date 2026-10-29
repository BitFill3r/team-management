"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client";

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="login-shell">
    <section className="card login-card">
      <div className="brand-mark" aria-hidden="true">AB</div>
      <p className="eyebrow">UNSER TEAM. UNSER TRAINING.</p>
      <h1>Am Ball<span className="accent">.</span></h1>
      <p className="muted">Wer ist heute dabei? Melde dich mit eurem Team-Passwort an.</p>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError("");
        try {
          await api("login", "POST", { password });
          router.replace("/"); router.refresh();
        } catch (error) {
          setError(errorMessage(error)); setBusy(false);
        }
      }}>
        <label htmlFor="password">Team-Passwort</label>
        <input id="password" type="password" autoComplete="current-password" required maxLength={256}
          value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="full" disabled={busy}>{busy ? "Anmelden …" : "Zum Training →"}</button>
      </form>
      <p className="privacy-note">Geschützter Bereich · Nur für euer Trainerteam</p>
    </section>
  </main>;
}
