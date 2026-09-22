import { it, expect } from "vitest";
import { snapshotInput, clientPatch, noteInput } from "../src/api/validators";

it("snapshot válido", () => {
  const r = snapshotInput.safeParse({
    status: "red",
    summary: "x",
    nextSteps: [{ text: "a" }],
    openPoints: [],
    sources: { threads: [], meetings: [] },
  });
  expect(r.success).toBe(true);
});

it("snapshot sin status falla", () => {
  expect(snapshotInput.safeParse({ summary: "x" }).success).toBe(false);
});

it("status fuera del enum falla", () => {
  expect(snapshotInput.safeParse({ status: "blue", summary: "x" }).success).toBe(false);
});

it("defaults de arrays y hasChanges", () => {
  const r = snapshotInput.parse({ status: "green", summary: "ok" });
  expect(r.nextSteps).toEqual([]);
  expect(r.openPoints).toEqual([]);
  expect(r.sources).toEqual({ threads: [], meetings: [] });
  expect(r.hasChanges).toBe(true);
});

it("patch rechaza campos desconocidos", () => {
  expect(clientPatch.safeParse({ name: "no" }).success).toBe(false);
  expect(clientPatch.safeParse({ domains: ["a.com"] }).success).toBe(true);
});

it("nota vacía falla y se recorta", () => {
  expect(noteInput.safeParse({ body: "  " }).success).toBe(false);
  expect(noteInput.parse({ body: "  hola " }).body).toBe("hola");
});
