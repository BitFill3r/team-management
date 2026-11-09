import { expect, test } from "@playwright/test";
import type { Snapshot } from "../../src/lib/types";

for (const width of [1280, 390, 320, 380, 381, 680, 681]) {
  test(`Designbasis: Layout, Kontrast und Formulare bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/login");
    await expect(page.getByRole("contentinfo")).toBeVisible();
    const checkLayout = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const control of await page.locator('input:not([type="checkbox"]), select, textarea, button').all()) {
        const box = await control.boundingBox();
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
    await page.evaluate(() => document.fonts.ready);
    await checkLayout();
    const firstParticipant = await page.locator("[data-ui=participant]").first().boundingBox();
    expect(firstParticipant).not.toBeNull();
    expect(firstParticipant!.y + firstParticipant!.height).toBeLessThanOrEqual(844);
    if (width === 390) expect(firstParticipant!.y).toBeLessThanOrEqual(650);
    const dateField = await page.getByLabel("Trainingsdatum", { exact: true }).boundingBox();
    expect(dateField!.y + dateField!.height).toBeLessThanOrEqual(844);
    await page.getByRole("button", { name: "Training", exact: true }).focus();
    expect(await page.getByRole("button", { name: "Training", exact: true }).evaluate(element =>
      getComputedStyle(element).outlineStyle)).toBe("solid");
    const font = await page.evaluate(async () => {
      await document.fonts.ready;
      const family = getComputedStyle(document.body).fontFamily;
      return {
        family,
        heading: getComputedStyle(document.querySelector("h1")!).fontFamily,
        input: getComputedStyle(document.querySelector("input")!).fontFamily,
        loaded: [...document.fonts].some(face =>
          face.family === family.split(",")[0].trim() && face.status === "loaded"),
      };
    });
    expect(font.heading).toBe(font.family);
    expect(font.input).toBe(font.family);
    expect(font.loaded).toBe(true);
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
        ratio(token("--muted"), token("--paper")),
        ratio(token("--muted"), token("--surface-subtle")),
        ratio(token("--muted"), token("--surface-present")),
        ratio(token("--green"), token("--surface")),
        ratio(token("--focus"), token("--surface")),
        ratio(token("--danger"), token("--surface")),
      ];
    });
    for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: `.impeccable/review/${width === 1280 ? "desktop" : width === 390 ? "mobile" : width === 320 ? "user-320" : `team-${width}`}.png`, fullPage: true });
    await page.getByRole("button", { name: "Kalender", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await checkLayout();
    await page.screenshot({ path: `.impeccable/review/calendar-${width}.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.locator("[data-ui=participant]").first().evaluate(element =>
      getComputedStyle(element).transitionDuration)).toBe("0s");
    await page.emulateMedia({ reducedMotion: "no-preference" });
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
