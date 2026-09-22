import type { Status } from "../db/schema";

export type StatusOrNull = Status | null;

export function statusOrder(status: StatusOrNull): number {
  return status === "red" ? 0 : status === "yellow" ? 1 : status === "green" ? 2 : 3;
}

export function statusLabel(status: StatusOrNull): string {
  return status === "red" ? "Bloqueado" : status === "yellow" ? "Atención" : status === "green" ? "Al día" : "Sin datos";
}

/** Clases Tailwind para el punto de color. */
export function statusClass(status: StatusOrNull): string {
  return status === "red"
    ? "bg-red-500"
    : status === "yellow"
      ? "bg-amber-400"
      : status === "green"
        ? "bg-emerald-500"
        : "bg-zinc-400";
}

type Sortable = { latest: { status: Status; generatedAt: Date } | null };

export function sortClients<T extends Sortable>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const byStatus = statusOrder(a.latest?.status ?? null) - statusOrder(b.latest?.status ?? null);
    if (byStatus !== 0) return byStatus;
    return (b.latest?.generatedAt.getTime() ?? 0) - (a.latest?.generatedAt.getTime() ?? 0);
  });
}
