import { expect, test } from "@playwright/test";
import type { Snapshot } from "../../src/lib/types";

for (const width of [1280, 390, 320]) {
  test(`Designbasis: Layout, Kontrast und Formulare bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await expect(page.getByRole("contentinfo")).toBeVisible();
    const checkLayout = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const input of await page.locator('input:not([type="checkbox"])').all()) {
        const box = await input.boundingBox();
        if (box) expect(box.height).toBeGreaterThanOrEqual(48);
      }
    };
    await checkLayout();
    await page.screenshot({ path: `.impeccable/review/login-${width}.png`, fullPage: true });
    const origin = "http://127.0.0.1:3100";
    expect((await page.request.post("/api/login", {
      headers: { origin }, data: { password: "browser-test-password" },
    })).ok()).toBe(true);
    await page.route("**/api/dashboard?*", async route => {
      const date = new URL(route.request().url()).searchParams.get("date")!;
      const child = { id: "synthetic-child", name: "Fiktiver sehr langer Vorname zur Layoutprüfung", archived: false, version: 0 };
      const snapshot: Snapshot = {
        children: [child],
        training: { id: "synthetic-training", date, participants: [{ ...child, present: true, attendanceVersion: 0 }] },
        history: [{ id: "synthetic-training", date, total: 1, present: 1 }],
      };
      await route.fulfill({ json: snapshot });
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Wer ist dabei?" })).toBeVisible();
    await checkLayout();
    const contrast = await page.evaluate(() => {
      const rgb = (value: string) => value.match(/\d+/g)!.slice(0, 3).map(Number);
      const luminance = (color: number[]) => color.map(value => {
        const channel = value / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const ratio = (foreground: string, background: string) => {
        const a = luminance(rgb(foreground)), b = luminance(rgb(background));
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      };
      const styles = getComputedStyle(document.documentElement);
      const token = (name: string) => {
        const element = document.createElement("span");
        element.style.color = styles.getPropertyValue(name);
        document.body.append(element);
        const color = getComputedStyle(element).color;
        element.remove();
        return color;
      };
      return [
        ratio(token("--ink"), token("--paper")),
        ratio(token("--muted"), token("--surface")),
        ratio(token("--surface"), token("--green")),
        ratio(token("--error-text"), token("--error-bg")),
      ];
    });
    for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: `.impeccable/review/${width === 1280 ? "desktop" : width === 390 ? "mobile" : "user-320"}.png`, fullPage: true });
    await page.getByRole("button", { name: "Kalender", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await checkLayout();
    await page.screenshot({ path: `.impeccable/review/calendar-${width}.png`, fullPage: true });
    await page.keyboard.press("Escape");
    for (const section of ["Kinder verwalten", "Verlauf", "Umfragen"]) {
      await page.getByRole("button", { name: section, exact: true }).click();
      await expect(page.getByRole("heading", { name: section === "Verlauf" ? "Trainingsverlauf" : section, exact: true })).toBeVisible();
      if (section === "Umfragen") await expect(page.getByText("Noch keine Umfragen angelegt.", { exact: true })).toBeVisible();
      if (section === "Verlauf") await expect(page.getByText("Keine Trainings in diesem Monat gespeichert.", { exact: true })).toBeVisible();
      await checkLayout();
      await page.screenshot({ path: `.impeccable/review/section-${section}-${width}.png`, fullPage: true });
    }
  });
}
