import { it, expect } from "vitest";
import { timeAgo, firstSentence } from "../src/ui/time";

const now = new Date("2026-09-22T12:00:00Z");

it("timeAgo", () => {
  expect(timeAgo(new Date("2026-09-22T11:59:30Z"), now)).toBe("hace un momento");
  expect(timeAgo(new Date("2026-09-22T11:55:00Z"), now)).toBe("hace 5 min");
  expect(timeAgo(new Date("2026-09-22T09:00:00Z"), now)).toBe("hace 3 h");
  expect(timeAgo(new Date("2026-09-21T09:00:00Z"), now)).toBe("hace 1 día");
  expect(timeAgo(new Date("2026-09-15T09:00:00Z"), now)).toBe("hace 7 días");
});

it("firstSentence", () => {
  expect(firstSentence("Hola. Chau.")).toBe("Hola.");
  expect(firstSentence("Sin punto")).toBe("Sin punto");
  expect(firstSentence("Con 1.5 millones. Otra.")).toBe("Con 1.5 millones.");
});
