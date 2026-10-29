import { describe, expect, it } from "vitest";
import { clampDate, monthDays, shiftDay, shiftMonth } from "../src/lib/calendar";

describe("Kalenderdaten", () => {
  it("beginnt montags und füllt vollständige Wochen", () => {
    const days = monthDays("2026-11");
    expect(days.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(days).toHaveLength(42);
    expect(days.filter(Boolean)).toHaveLength(30);
    expect(monthDays("2026-06")[0]).toBe("2026-06-01");
  });
  it("beachtet Schaltjahre und Monatsenden", () => {
    expect(monthDays("2028-02").filter(Boolean)).toHaveLength(29);
    expect(monthDays("2100-02").filter(Boolean)).toHaveLength(28);
    expect(shiftMonth("2028-01-31", 1)).toBe("2028-02-29");
    expect(shiftMonth("2026-03-31", -1)).toBe("2026-02-28");
  });
  it("wechselt Jahre und Tage ohne Zeitzonenversatz und begrenzt den Bereich", () => {
    expect(shiftMonth("2026-12-31", 1)).toBe("2027-01-31");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-03-29", -1)).toBe("2026-03-28");
    expect(clampDate("1999-12-31")).toBe("2000-01-01");
    expect(clampDate("2101-01-01")).toBe("2100-12-31");
  });
});
