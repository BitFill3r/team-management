import { expect, test } from "@playwright/test";
import type { Snapshot, Training } from "../../src/lib/types";

for (const width of [1280, 390, 320]) {
  test(`Trainingskalender: Markierungen, Auswahl und Bedienung bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 480 : 844 });
    const login = await page.request.post("/api/login", {
      headers: { origin: "http://127.0.0.1:3100" }, data: { password: "browser-test-password" },
    });
    expect(login.ok()).toBe(true);
    const trainings = new Map<string, Training>([
      ["2026-01-05", { id: "past", date: "2026-01-05", participants: [] }],
      ["2028-02-29", { id: "future", date: "2028-02-29", participants: [] }],
    ]);
    let reads = 0;
    let creates = 0;
    await page.route("**/api/dashboard?*", async (route) => {
      reads++;
      const date = new URL(route.request().url()).searchParams.get("date")!;
      const snapshot: Snapshot = {
        training: trainings.get(date) ?? null,
        children: [{ id: "child", name: "Testkind", archived: false, version: 0 }],
        history: [...trainings.values()].map((training) => ({ id: training.id, date: training.date, total: 0, present: 0 })),
      };
      await route.fulfill({ json: snapshot });
    });
    await page.route("**/api/training", async (route) => {
      expect(route.request().method()).toBe("POST");
      creates++;
      const date = route.request().postDataJSON().date as string;
      const training = { id: "created", date, participants: [] };
      trainings.set(date, training);
      await route.fulfill({ json: training });
    });
    await page.goto("/");
    const input = page.getByLabel("Trainingsdatum", { exact: true });
    await input.fill("2026-01-05");
    const toggle = page.getByRole("button", { name: "Kalender", exact: true });
    await toggle.click();
    const dialog = page.getByRole("dialog", { name: "Trainingsdatum wählen" });
    const day = (date: string) => dialog.locator(`[data-date="${date}"]`);
    await expect(day("2026-01-05")).toHaveAttribute("aria-label", /Training angelegt/);
    await expect(day("2026-01-05")).toHaveAttribute("aria-pressed", "true");
    await expect(day("2026-01-05")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(day("2026-01-06")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(day("2026-01-05")).toBeFocused();
    await page.keyboard.press("End");
    await expect(day("2026-01-11")).toBeFocused();
    await page.keyboard.press("PageDown");
    await expect(day("2026-02-11")).toBeFocused();
    await page.keyboard.press("PageUp");
    await expect(day("2026-01-11")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(toggle).toBeFocused();
    await expect(input).toHaveValue("2026-01-05");
    await toggle.click();
    const before = reads;
    await dialog.getByLabel("Kalenderjahr").selectOption("2028");
    await dialog.getByLabel("Kalendermonat").selectOption("02");
    await expect(day("2028-02-29")).toHaveAttribute("aria-label", /Training angelegt/);
    await expect(day("2028-02-28")).not.toHaveAttribute("aria-label", /Training angelegt/);
    expect(reads).toBe(before);
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width);
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.height).toBeLessThanOrEqual(width === 320 ? 480 : 844);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(width === 320 ? 480 : 844);
    await expect(day("2028-02-29")).toBeInViewport();
    await page.screenshot({ path: `test-results/calendar-${width}.png` });
    await day("2028-02-29").click();
    await expect(dialog).not.toBeVisible();
    await expect(input).toHaveValue("2028-02-29");
    await expect(page.getByRole("button", { name: "Training anlegen" })).toHaveCount(0);
    await toggle.click();
    await day("2028-02-28").click();
    await expect(page.getByRole("button", { name: "Training anlegen" })).toBeVisible();
    expect(creates).toBe(0);
    await page.getByRole("button", { name: "Training anlegen" }).click();
    await expect(page.getByRole("status")).toContainText("Training angelegt");
    await toggle.click();
    await expect(day("2028-02-28")).toHaveAttribute("aria-label", /Training angelegt/);
    await dialog.getByLabel("Kalenderjahr").selectOption("2000");
    await dialog.getByLabel("Kalendermonat").selectOption("01");
    await expect(dialog.getByRole("button", { name: "Vorheriger Monat" })).toBeDisabled();
    await dialog.getByLabel("Kalenderjahr").selectOption("2100");
    await dialog.getByLabel("Kalendermonat").selectOption("12");
    await expect(dialog.getByRole("button", { name: "Nächster Monat" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: /Training angelegt/ })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Kalender schließen" }).click();
    await input.fill(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date()));
    await toggle.click();
    await expect(dialog.locator('[aria-current="date"]')).toHaveAttribute("aria-pressed", "true");
  });
}
