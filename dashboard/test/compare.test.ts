import { it, expect } from "vitest";
import { timingSafeEqual } from "../src/auth/compare";

it("iguales", () => expect(timingSafeEqual("abc", "abc")).toBe(true));
it("distintos mismo largo", () => expect(timingSafeEqual("abc", "abd")).toBe(false));
it("distinto largo", () => expect(timingSafeEqual("abc", "ab")).toBe(false));
it("vacíos", () => expect(timingSafeEqual("", "")).toBe(true));
