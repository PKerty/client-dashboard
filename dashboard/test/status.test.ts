import { it, expect } from "vitest";
import { statusOrder, statusLabel, sortClients } from "../src/ui/status";

it("orden: rojo, amarillo, verde, sin datos", () => {
  expect([statusOrder("red"), statusOrder("yellow"), statusOrder("green"), statusOrder(null)]).toEqual([0, 1, 2, 3]);
});

it("etiquetas", () => {
  expect(statusLabel("green")).toBe("Al día");
  expect(statusLabel("yellow")).toBe("Atención");
  expect(statusLabel("red")).toBe("Bloqueado");
  expect(statusLabel(null)).toBe("Sin datos");
});

it("sortClients: por semáforo y luego más reciente primero, sin snapshot al final", () => {
  const at = (d: string) => new Date(d);
  const rows = [
    { slug: "a", latest: { status: "green" as const, generatedAt: at("2026-09-20") } },
    { slug: "b", latest: null },
    { slug: "c", latest: { status: "red" as const, generatedAt: at("2026-09-18") } },
    { slug: "d", latest: { status: "red" as const, generatedAt: at("2026-09-21") } },
    { slug: "e", latest: { status: "yellow" as const, generatedAt: at("2026-09-19") } },
  ];
  expect(sortClients(rows).map((r) => r.slug)).toEqual(["d", "c", "e", "a", "b"]);
});
