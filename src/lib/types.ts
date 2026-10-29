export type Child = { id: string; name: string; archived: boolean; version: number };
export type Participant = Child & { present: boolean; attendanceVersion: number };
export type Training = { id: string; date: string; participants: Participant[] };
export type HistoryEntry = { id: string; date: string; total: number; present: number };
export type Snapshot = { training: Training | null; children: Child[]; history: HistoryEntry[] };
export type OverviewParticipant = Pick<Child, "id" | "name" | "archived"> & { present: boolean };
export type OverviewTraining = { id: string; date: string; participants: OverviewParticipant[] };
export type MonthlyOverview = { month: string; trainings: OverviewTraining[] };
