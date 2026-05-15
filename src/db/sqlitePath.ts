import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function prepareSqlitePath(databaseUrl: string): string {
  const sqlitePath = databaseUrl.replace(/^file:/, "");

  if (sqlitePath !== ":memory:") {
    mkdirSync(dirname(sqlitePath), { recursive: true });
  }

  return sqlitePath;
}
