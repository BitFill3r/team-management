export type Child = { id: string; name: string; archived: boolean; version: number };
export type Participant = Child & { present: boolean; attendanceVersion: number };
export type Training = { id: string; date: string; participants: Participant[] };
export type HistoryEntry = { id: string; date: string; total: number; present: number };
