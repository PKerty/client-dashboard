import { describe, it, expect } from "vitest";
import { makeTestDb } from "./setup";
import { clients } from "../src/db/schema";

describe("schema", () => {
  it("aplica las migraciones y permite insertar un cliente", async () => {
    const db = await makeTestDb();
    const [row] = await db
      .insert(clients)
      .values({ slug: "cliente-a", name: "Cliente A", gmailLabelName: "clients/cliente-a" })
      .returning();
    expect(row.slug).toBe("cliente-a");
    expect(row.domains).toEqual([]);
    expect(row.active).toBe(true);
  });
});
