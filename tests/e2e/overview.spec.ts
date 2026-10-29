import { expect, test } from "@playwright/test";

test("Monatsübersicht: drei Zustände, Monatsgrenzen, veraltete Antworten und Fehler", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("Team-Passwort").fill("browser-test-password");
  await page.getByRole("button", { name: "Zum Training" }).click();
  await expect(page.getByRole("heading", { name: "Wer ist dabei?" })).toBeVisible();
  let release = () => {};
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  const seen: string[] = [];
  await page.route("**/api/overview?*", async (route) => {
    const month = new URL(route.request().url()).searchParams.get("month")!;
    seen.push(month);
    if (month === "2028-01") await delayed;
    await route.fulfill({ json: {
      month,
      trainings: month !== "2028-02" ? [] : ["01", "04", "08", "11", "15", "18", "22", "29"].map((day, index) => ({
        id: `day-${day}`, date: `${month}-${day}`,
        participants: [
          { id: "first", name: "Emil", archived: true, present: index === 0 },
          ...(index > 0 ? [{ id: "second", name: "Mila", archived: false, present: true }] : []),
        ],
      })),
    } });
  });
  await page.getByRole("button", { name: "Verlauf", exact: true }).click();
  const month = page.getByLabel("Monat", { exact: true });
  await month.fill("2028-02");
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const emil = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Emil Archiviert" }) });
  const mila = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Mila" }) });
  await expect(emil.getByRole("cell", { name: "Anwesend", exact: true })).toHaveCount(1);
  await expect(emil.getByRole("cell", { name: "Nicht anwesend", exact: true })).toHaveCount(7);
  await expect(mila.getByRole("cell", { name: "Nicht in der damaligen Teilnehmerliste", exact: true })).toHaveCount(1);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);
  const scroller = page.getByRole("region", { name: /Anwesenheitstabelle/ });
  expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await scroller.focus();
  await expect(scroller).toBeFocused();
  await page.screenshot({ path: "test-results/handy-monatsuebersicht.png" });
  const requests = seen.length;
  await page.getByRole("button", { name: "Tagesliste", exact: true }).click();
  await expect(page.locator(".present-names").last()).toContainText("Emil");
  expect(seen).toHaveLength(requests);
  await page.getByRole("button", { name: "Tabelle", exact: true }).click();
  await page.getByRole("button", { name: "Vorheriger Monat" }).click();
  await expect(page.getByText("Die Monatsübersicht wird geladen …")).toBeVisible();
  await expect(table).toHaveCount(0);
  await page.getByRole("button", { name: "Nächster Monat" }).click();
  await expect(table).toBeVisible();
  release();
  await expect(month).toHaveValue("2028-02");
  await expect(table).toBeVisible();
  await page.route("**/api/overview?month=2028-03", (route) => route.abort(), { times: 1 });
  await page.getByRole("button", { name: "Nächster Monat" }).click();
  await expect(page.locator(".error[role=alert]")).toContainText("Verbindung");
  await expect(table).toHaveCount(0);
  await page.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(page.getByText("Keine Trainings in diesem Monat gespeichert.")).toBeVisible();
  await month.fill("2027-12");
  await page.getByRole("button", { name: "Nächster Monat" }).click();
  await expect(month).toHaveValue("2028-01");
  await page.getByRole("button", { name: "Vorheriger Monat" }).click();
  await expect(month).toHaveValue("2027-12");
  await month.fill("2000-01");
  await expect(page.getByRole("button", { name: "Vorheriger Monat" })).toBeDisabled();
  await month.fill("2100-12");
  await expect(page.getByRole("button", { name: "Nächster Monat" })).toBeDisabled();
});
