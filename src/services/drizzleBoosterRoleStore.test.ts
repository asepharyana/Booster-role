import { describe, expect, test } from "bun:test";
import { DrizzleBoosterRoleStore, type BoosterRoleRecord, type BoosterRoleUpdate } from "./drizzleBoosterRoleStore";

class FakeDb {
  rows: BoosterRoleRecord[] = [];
  lastUpdate: { changes: BoosterRoleUpdate; condition: unknown } | null = null;

  select() {
    return {
      from: () => ({
        where: () => Object.assign(Promise.resolve(this.rows), {
          limit: (count: number) => Promise.resolve(this.rows.slice(0, count))
        })
      })
    };
  }

  insert() {
    return {
      values: (record: BoosterRoleRecord) => {
        this.rows.push(record);
      }
    };
  }

  update() {
    return {
      set: (changes: BoosterRoleUpdate) => ({
        where: (condition: unknown) => {
          this.lastUpdate = { changes, condition };
        }
      })
    };
  }

  delete() {
    return {
      where: () => {}
    };
  }
}

describe("DrizzleBoosterRoleStore", () => {
  test("persists metadata updates for a stored booster role", async () => {
    const db = new FakeDb();
    const store = new DrizzleBoosterRoleStore(db);

    await store.update("guild", "user", { name: "Renamed", color: "#AABBCC", updatedAt: 123 });

    expect(db.lastUpdate?.changes).toEqual({ name: "Renamed", color: "#AABBCC", updatedAt: 123 });
    expect(db.lastUpdate?.condition).toBeDefined();
  });
});
