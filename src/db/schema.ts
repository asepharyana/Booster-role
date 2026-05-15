import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const boosterRoles = sqliteTable(
  "booster_roles",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    roleId: text("role_id").notNull(),
    name: text("name").notNull(),
    color: text("color"),
    icon: text("icon"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
  },
  (table) => ({
    userIdx: uniqueIndex("booster_roles_guild_user_idx").on(table.guildId, table.userId),
    roleIdx: uniqueIndex("booster_roles_guild_role_idx").on(table.guildId, table.roleId)
  })
);

export type BoosterRoleRow = typeof boosterRoles.$inferSelect;
export type NewBoosterRoleRow = typeof boosterRoles.$inferInsert;
