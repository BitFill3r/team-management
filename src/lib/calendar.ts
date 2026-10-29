export const firstDate = "2000-01-01";
export const lastDate = "2100-12-31";

export function shiftDay(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function monthDays(month: string): (string | null)[] {
  const first = `${month}-01`;
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const end = new Date(`${first}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  const days: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= end.getUTCDate(); day++) days.push(`${month}-${String(day).padStart(2, "0")}`);
  while (days.length % 7) days.push(null);
  return days;
}

export function shiftMonth(date: string, months: number) {
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months + 1, 0);
  value.setUTCDate(Math.min(day, value.getUTCDate()));
  return value.toISOString().slice(0, 10);
}

export function clampDate(date: string) {
  return date < firstDate ? firstDate : date > lastDate ? lastDate : date;
}
