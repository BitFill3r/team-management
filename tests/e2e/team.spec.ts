import { expect, test } from "@playwright/test";
import type { Training } from "../../src/lib/types";

for (const setup of [
  { label: "Desktop", width: 1280, height: 900, first: "Emil", second: "Mila", date: "2026-10-29", next: "2026-11-02" },
  { label: "Handy", width: 390, height: 844, first: "Jonas", second: "Ben", date: "2026-10-30", next: "2026-11-03" },
]) {
  test(`${setup.label}: Team pflegen, Anwesenheit speichern und Fehler korrigieren`, async ({ page }) => {
    const reads: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "GET" && request.url().includes("/api/")) reads.push(new URL(request.url()).pathname);
    });
    await page.setViewportSize({ width: setup.width, height: setup.height });
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Team-Passwort").fill("wrong");
    await page.getByRole("button", { name: "Zum Training" }).click();
    await expect(page.locator(".error[role=alert]")).toContainText("nicht richtig");
    await page.getByLabel("Team-Passwort").fill("browser-test-password");
    await page.getByRole("button", { name: "Zum Training" }).click();
    await expect(page.getByRole("heading", { name: "Wer ist dabei?" })).toBeVisible();
    expect(reads).toEqual(["/api/dashboard"]);
    await page.getByRole("button", { name: "Kinder verwalten", exact: true }).click();
    for (const name of [setup.first, setup.second]) {
      await page.getByLabel("Neuer Vorname").fill(name);
      await page.getByRole("button", { name: "Kind hinzufügen" }).click();
      await expect(page.getByLabel("Neuer Vorname")).toHaveValue("");
      await expect(page.getByRole("status")).toContainText("Kind hinzugefügt");
    }

    await page.getByRole("button", { name: "Training", exact: true }).click();
    await page.getByLabel("Trainingsdatum", { exact: true }).fill(setup.date);
    await page.getByRole("button", { name: "Training anlegen" }).click();
    const first = page.getByRole("checkbox", { name: `${setup.first}: anwesend`, exact: true });
    await first.click();
    await expect(page.getByRole("status")).toContainText("Anwesenheit gespeichert");
    await page.reload();
    await page.getByLabel("Trainingsdatum", { exact: true }).fill(setup.date);
    await expect(first).toBeChecked();
    await first.click();
    await expect(page.getByRole("status")).toContainText("Anwesenheit gespeichert");
    await page.getByRole("button", { name: "Letzte Änderung rückgängig" }).click();
    await expect(first).toBeChecked();
    await expect(page.getByRole("status")).toContainText("rückgängig gemacht");
    await first.focus();
    await page.keyboard.press("Space");
    await expect(first).not.toBeChecked();
    await expect(first).toHaveAttribute("aria-disabled", "false");
    await expect(first).toBeFocused();
    await page.keyboard.press("Space");
    await expect(first).toBeChecked();
    await expect(first).toHaveAttribute("aria-disabled", "false");

    let release = () => {};
    let writes = 0;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/attendance", async (route) => {
      writes++;
      await pending;
      await route.continue();
    });
    await first.click();
    await expect(first).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Kalender", exact: true })).toBeDisabled();
    await expect(first).not.toBeChecked({ timeout: 500 });
    await expect(page.getByRole("status")).toContainText("Wird gespeichert");
    const second = page.getByRole("checkbox", { name: `${setup.second}: anwesend`, exact: true });
    await expect(second).toHaveAttribute("aria-disabled", "false");
    await second.click();
    await expect(second).toBeChecked({ timeout: 500 });
    await first.dispatchEvent("click");
    release();
    await expect(first).toHaveAttribute("aria-disabled", "false");
    await expect(first).not.toBeChecked();
    await expect(second).toHaveAttribute("aria-disabled", "false");
    expect(writes).toBe(2);
    await page.unroute("**/api/attendance");
    await first.click();
    await expect(first).toBeChecked();
    await expect(first).toHaveAttribute("aria-disabled", "false");
    await second.click();
    await expect(second).not.toBeChecked();
    await expect(second).toHaveAttribute("aria-disabled", "false");

    await page.route("**/api/attendance", (route) => route.abort(), { times: 1 });
    await first.click();
    await expect(page.locator(".error[role=alert]")).toContainText("Verbindung");
    await expect(first).toBeChecked();
    await expect(first).toBeDisabled();
    await page.getByRole("button", { name: "Gespeicherten Stand neu laden" }).click();
    await expect(first).toBeEnabled();
    await expect(first).toBeChecked();

    const training: Training = await (await page.request.get(`/api/training?date=${setup.date}`)).json();
    const participant = training.participants.find((child) => child.name === setup.first)!;
    const concurrent = await page.request.patch("/api/attendance", {
      headers: { origin: "http://127.0.0.1:3100" },
      data: { trainingId: training.id, childId: participant.id, present: true, version: participant.attendanceVersion },
    });
    expect(concurrent.ok()).toBe(true);
    await first.click();
    await expect(page.locator(".error[role=alert]")).toContainText("inzwischen geändert");
    await page.getByRole("button", { name: "Gespeicherten Stand neu laden" }).click();
    await expect(first).toBeChecked();
    await expect(first).toBeEnabled();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", setup.width);
    await page.screenshot({ path: `test-results/${setup.label.toLowerCase()}-training.png`, fullPage: true });

    await page.getByRole("button", { name: "Kinder verwalten", exact: true }).click();
    const lateName = `${setup.first} neu`;
    await page.getByLabel("Neuer Vorname").fill(lateName);
    await page.getByRole("button", { name: "Kind hinzufügen" }).click();
    await expect(page.getByLabel("Neuer Vorname")).toHaveValue("");
    await page.getByRole("button", { name: "Training", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: `${lateName}: anwesend`, exact: true })).not.toBeChecked();
    await expect(first).toBeChecked();
    await page.reload();
    await page.getByLabel("Trainingsdatum", { exact: true }).fill(setup.date);
    await expect(page.getByRole("checkbox", { name: `${lateName}: anwesend`, exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: `${lateName}: anwesend`, exact: true })).not.toBeChecked();
    await expect(first).toBeChecked();
    await page.getByRole("button", { name: "Verlauf", exact: true }).click();
    await page.getByLabel("Monat", { exact: true }).fill("2026-10");
    const lateRow = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: lateName, exact: true }) });
    await expect(lateRow.getByRole("cell", { name: "Nicht anwesend", exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Training", exact: true }).click();
    await page.getByRole("button", { name: "Kinder verwalten", exact: true }).click();
    const childRow = page.locator(".child-editor").filter({ has: page.locator(`input[value="${setup.first}"]`) });
    await childRow.getByRole("button", { name: "Archivieren", exact: true }).click();
    await expect(childRow.getByRole("button", { name: "Reaktivieren" })).toBeVisible();
    await page.getByRole("button", { name: "Training", exact: true }).click();
    await expect(first).toBeVisible();
    await expect(page.getByText("Archiviert", { exact: true })).toBeVisible();
    await page.getByLabel("Trainingsdatum", { exact: true }).fill(setup.next);
    await page.getByRole("button", { name: "Training anlegen" }).click();
    await expect(first).toHaveCount(0);
    await page.getByRole("button", { name: "Verlauf", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Trainingsverlauf" })).toBeVisible();
    await page.getByLabel("Monat", { exact: true }).fill("2026-10");
    await expect(page.getByRole("table")).toBeVisible();
    const overviewReads = () => reads.filter((path) => path === "/api/overview").length;
    const count = overviewReads();
    await page.getByRole("button", { name: "Tagesliste", exact: true }).click();
    await expect(page.locator(".present-names")).toContainText(setup.first);
    expect(overviewReads()).toBe(count);
    await page.getByRole("button", { name: "Tabelle", exact: true }).click();
    const archivedRow = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: `${setup.first} Archiviert` }) });
    await expect(archivedRow).toContainText("Archiviert");
    await expect(archivedRow.getByRole("cell", { name: "Anwesend", exact: true }).first()).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", setup.width);
    await page.getByRole("button", { name: "Nächster Monat", exact: true }).click();
    await expect(page.getByLabel("Monat", { exact: true })).toHaveValue("2026-11");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText("Die Monatsübersicht wird geladen …")).toHaveCount(0);
    await page.getByRole("button", { name: "Tagesliste", exact: true }).click();
    await expect(page.getByText("Niemand anwesend.").first()).toBeVisible();
    await page.getByRole("button", { name: "Vorheriger Monat", exact: true }).click();
    await expect(page.getByLabel("Monat", { exact: true })).toHaveValue("2026-10");
    await page.getByRole("button", { name: "Tabelle", exact: true }).click();
    await page.getByRole("button", { name: /Training öffnen:/ }).filter({ hasText: setup.date === "2026-10-29" ? "29.10.2026" : "30.10.2026" }).click();
    await expect(first).toBeChecked();
    await first.click();
    await expect(first).toHaveAttribute("aria-disabled", "false");
    await page.getByRole("button", { name: "Verlauf", exact: true }).click();
    await expect(page.getByLabel("Monat", { exact: true })).toHaveValue("2026-10");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(archivedRow.getByRole("cell", { name: "Nicht anwesend", exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Training", exact: true }).click();

    await page.getByRole("button", { name: "Kinder verwalten", exact: true }).click();
    await childRow.getByRole("button", { name: "Reaktivieren" }).click();
    await expect(childRow.getByRole("button", { name: "Archivieren", exact: true })).toBeVisible();
    const secondRow = page.locator(".child-editor").filter({ has: page.locator(`input[value="${setup.second}"]`) });
    await secondRow.getByRole("button", { name: "Löschen", exact: true }).click();
    await secondRow.getByRole("button", { name: "Abbrechen" }).click();
    await expect(secondRow).toBeVisible();
    await secondRow.getByRole("button", { name: "Löschen", exact: true }).click();
    await secondRow.getByRole("button", { name: "Ja, endgültig löschen" }).click();
    await expect(secondRow).toHaveCount(0);
    await page.getByRole("button", { name: "Training", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: `${setup.second}: anwesend`, exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Abmelden", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get("/api/children")).status()).toBe(401);
  });
}
