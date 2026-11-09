"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { Panel } from "@/components/ui/panel";
import { ErrorMessage } from "@/components/ui/feedback";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client";

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="grid flex-1 place-items-center px-6 py-12">
    <Panel padding="login" className="w-full max-w-[460px] [&_h1]:mb-2 [&_h1]:text-[2.5rem] [&_form]:mt-7 [&_input]:mb-4">
      <div className="mb-6 grid size-[52px] place-items-center rounded-control bg-green text-[1.4rem] font-extrabold tracking-[-.02em] text-lime" aria-hidden="true">AB</div>
      <h1>Am Ball<span className="text-green">.</span></h1>
      <p className="mt-2 mb-6 text-small text-muted">UNSER TEAM. UNSER TRAINING.</p>
      <p className="text-muted">Wer ist heute dabei? Melde dich mit eurem Team-Passwort an.</p>
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
        <Label htmlFor="password">Team-Passwort</Label>
        <Input id="password" type="password" autoComplete="current-password" required maxLength={256}
          value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
        {error && <ErrorMessage as="p" role="alert">{error}</ErrorMessage>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Anmelden …" : "Zum Training"}</Button>
      </form>
      <p className="mt-6 mb-0 text-small text-muted">Geschützter Bereich · Nur für euer Trainerteam</p>
    </Panel>
  </main>;
}
