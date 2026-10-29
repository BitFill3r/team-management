export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, method = "GET", data?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    cache: "no-store",
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal,
  });
  if (!response.ok) {
    const result = await response.json();
    throw new RequestError(response.status, typeof result.error === "string" ? result.error : "Die Anfrage ist fehlgeschlagen.");
  }
  return response.json() as Promise<T>;
}

export function errorMessage(error: unknown) {
  if (error instanceof RequestError) return error.message;
  return "Keine sichere Verbindung zum Server. Bitte neu laden und den gespeicherten Stand prüfen.";
}

export function today() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function displayDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`));
}
