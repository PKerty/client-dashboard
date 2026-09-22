import { it, expect } from "vitest";
import { createSessionValue, verifySessionValue, SESSION_TTL_MS } from "../src/auth/session";

const secret = "s3cret";

it("firma y verifica", async () => {
  const v = await createSessionValue(secret, 1000);
  expect(await verifySessionValue(secret, v, 2000)).toBe(true);
});

it("rechaza vencida", async () => {
  const v = await createSessionValue(secret, 1000);
  expect(await verifySessionValue(secret, v, 1000 + SESSION_TTL_MS + 1)).toBe(false);
});

it("rechaza firma ajena", async () => {
  const v = await createSessionValue("otro", 1000);
  expect(await verifySessionValue(secret, v, 2000)).toBe(false);
});

it("rechaza expiración manipulada", async () => {
  const v = await createSessionValue(secret, 1000);
  const [, sig] = v.split(".");
  expect(await verifySessionValue(secret, `${9999999999999}.${sig}`, 2000)).toBe(false);
});

it("rechaza basura", async () => {
  expect(await verifySessionValue(secret, "x", 2000)).toBe(false);
  expect(await verifySessionValue(secret, "", 2000)).toBe(false);
  expect(await verifySessionValue(secret, undefined, 2000)).toBe(false);
});

it("rechaza secreto vacío en la verificación", async () => {
  const v = await createSessionValue(secret, 1000);
  expect(await verifySessionValue("", v, 2000)).toBe(false);
});
