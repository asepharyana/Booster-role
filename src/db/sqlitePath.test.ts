import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { prepareSqlitePath } from "./sqlitePath";

describe("prepareSqlitePath", () => {
  test("creates parent directory for file database urls", async () => {
    const root = await mkdtemp(join(tmpdir(), "booster-role-db-"));
    const dbPath = join(root, "nested", "booster-role.sqlite");

    expect(existsSync(join(root, "nested"))).toBe(false);
    expect(prepareSqlitePath(`file:${dbPath}`)).toBe(dbPath);
    expect(existsSync(join(root, "nested"))).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  test("does not create a directory for in-memory databases", () => {
    expect(prepareSqlitePath(":memory:")).toBe(":memory:");
  });
});
