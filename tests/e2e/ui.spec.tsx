import { expect, test } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { Button, NavigationButton } from "../../src/components/ui/button";
import { Checkbox, Fieldset, Input, Label, Select, Textarea } from "../../src/components/ui/fields";
import { ErrorMessage } from "../../src/components/ui/feedback";
import { NavigationGroup, Panel } from "../../src/components/ui/panel";
import ErrorPage from "../../src/app/error";

test("Shared UI: native semantics, variants, disabled fields and focus", async ({ page }) => {
  await page.goto("/login");
  const markup = renderToStaticMarkup(<Panel data-testid="ui-contract">
    <form aria-label="UI contract">
      <Label htmlFor="ui-name">Test field</Label>
      <Input id="ui-name" placeholder="Placeholder" required defaultValue="Synthetic" />
      <Label htmlFor="ui-readonly">Readonly field</Label>
      <Input id="ui-readonly" readOnly defaultValue="Readonly" />
      <Label htmlFor="ui-invalid">Invalid field</Label>
      <Input id="ui-invalid" aria-invalid="true" aria-describedby="ui-error" defaultValue="Invalid" />
      <ErrorMessage id="ui-error">Synthetic error</ErrorMessage>
      <Label htmlFor="ui-textarea">Text area</Label><Textarea id="ui-textarea" />
      <Button>Non-submit action</Button><Button type="submit">Explicit submit</Button>
      <Button variant="secondary">Secondary action</Button>
      <Button variant="text" size="text">Text action</Button>
      <Button variant="danger">Destructive action</Button>
      <Button variant="danger-secondary">Destructive secondary</Button>
      <Button variant="danger-text" size="text">Destructive text</Button>
      <Button disabled>Disabled action</Button>
      <Button aria-busy="true">Busy presentation</Button>
      <Checkbox aria-label="Regular checkbox" />
      <Checkbox size="attendance" aria-label="Attendance checkbox" />
      <Fieldset disabled><legend>Locked fields</legend>
        <Label htmlFor="ui-locked">Locked input</Label><Input id="ui-locked" defaultValue="Locked" />
        <Label htmlFor="ui-select">Locked select</Label><Select id="ui-select"><option>Locked</option></Select>
        <Label htmlFor="ui-locked-area">Locked text area</Label><Textarea id="ui-locked-area" />
        <Checkbox aria-label="Locked checkbox" /><Button>Locked action</Button>
      </Fieldset>
      <NavigationGroup role="group" aria-label="View">
        <NavigationButton active aria-pressed="true">Active view</NavigationButton>
        <NavigationButton active={false} aria-pressed="false">Other view</NavigationButton>
      </NavigationGroup>
    </form>
  </Panel>);
  await page.locator("body").evaluate((body, html) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    body.append(wrapper);
    wrapper.querySelector("form")!.addEventListener("submit", event => {
      event.preventDefault();
      wrapper.dataset.submissions = String(Number(wrapper.dataset.submissions ?? 0) + 1);
    });

  }, markup);
  const fixture = page.getByTestId("ui-contract");
  const action = fixture.getByRole("button", { name: "Non-submit action", exact: true });
  await expect(action).toHaveAttribute("type", "button");
  await action.click();
  expect(await fixture.evaluate(element => element.parentElement!.dataset.submissions)).toBeUndefined();
  await fixture.getByRole("button", { name: "Explicit submit", exact: true }).click();
  expect(await fixture.evaluate(element => element.parentElement!.dataset.submissions)).toBe("1");
  await expect(fixture.getByRole("button", { name: "Busy presentation" })).toBeEnabled();
  await expect(fixture.getByRole("button", { name: "Disabled action" })).toBeDisabled();
  for (const label of ["Locked input", "Locked select", "Locked text area", "Locked checkbox"]) {
    await expect(fixture.getByLabel(label, { exact: true })).toBeDisabled();
  }
  await expect(fixture.getByRole("button", { name: "Locked action" })).toBeDisabled();
  await expect(fixture.getByLabel("Readonly field")).toHaveAttribute("readonly", "");
  const styles = await fixture.evaluate(element => {
    const style = (selector: string) => {
      const css = getComputedStyle(element.querySelector(selector)!);
      return { background: css.backgroundColor, color: css.color, border: css.borderTopColor };
    };
    return {
      regular: style("#ui-name"), invalid: style("#ui-invalid"),
      locked: style("#ui-locked"), select: style("#ui-select"), textarea: style("#ui-locked-area"),
      active: style('[aria-pressed="true"]'), inactive: style('[aria-pressed="false"]'),
    };
  });
  expect(styles.locked.background).toBe("rgb(237, 242, 238)");
  expect(styles.select.background).toBe(styles.locked.background);
  expect(styles.textarea.background).toBe(styles.locked.background);
  expect(styles.invalid.border).toBe("rgb(199, 133, 128)");
  expect(styles.regular.border).toBe("rgb(123, 137, 126)");
  expect(styles.active.background).toBe("rgb(255, 255, 255)");
  expect(styles.active.border).toBe("rgb(123, 137, 126)");
  expect(styles.active.color).toBe("rgb(36, 84, 62)");
  expect(styles.inactive.color).toBe("rgb(86, 100, 93)");
  for (const [name, background, color] of [
    ["Non-submit action", "rgb(36, 84, 62)", "rgb(255, 255, 255)"],
    ["Secondary action", "rgb(237, 242, 238)", "rgb(36, 53, 46)"],
    ["Destructive action", "rgb(161, 46, 50)", "rgb(255, 255, 255)"],
    ["Destructive secondary", "rgb(237, 242, 238)", "rgb(161, 46, 50)"],
  ]) {
    const computed = await fixture.getByRole("button", { name, exact: true }).evaluate(element => {
      const css = getComputedStyle(element);
      return { background: css.backgroundColor, color: css.color, radius: css.borderRadius };
    });
    expect(computed).toEqual({ background, color, radius: "6px" });
  }
  await action.focus();
  expect(await action.evaluate(element => getComputedStyle(element).outlineWidth)).toBe("3px");
  await page.keyboard.press("Enter");
  expect(await fixture.evaluate(element => element.parentElement!.dataset.submissions)).toBe("1");
  for (const control of await fixture.locator("button, input:not([type=checkbox]), select").all()) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }
  expect((await fixture.getByLabel("Text area", { exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(100);
});

test("Root error surface keeps the common controls and responsive layout", async ({ page }) => {
  await page.goto("/login");
  await page.locator("main").evaluate((element, html) => {
    element.outerHTML = html;
  }, renderToStaticMarkup(<ErrorPage reset={() => {}} />));
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole("heading", { name: "Die App ist gerade nicht erreichbar." })).toBeVisible();
    const retry = page.getByRole("button", { name: "Erneut versuchen", exact: true });
    await expect(retry).toHaveAttribute("type", "button");
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.impeccable/review/error-${width}.png`, fullPage: true });
  }
});
