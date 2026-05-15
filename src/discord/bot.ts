import { Database } from "bun:sqlite";
import type { Client } from "discord.js";
import type { AppConfig } from "../config";
import { prepareSqlitePath } from "../db/sqlitePath";
import { BoosterRoleService } from "../services/boosterRoleService";
import { BunSqliteBoosterRoleStore } from "../services/bunSqliteBoosterRoleStore";
import { DiscordRoleRepository } from "../services/discordRoleRepository";
import { handleGuildMemberUpdate } from "./events/guildMemberUpdate";
import { handleInteraction } from "./interactionHandler";

export function attachBotHandlers(client: Client, config: AppConfig): void {
  const db = new Database(prepareSqlitePath(config.databaseUrl));
  const store = new BunSqliteBoosterRoleStore(db);

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const service = new BoosterRoleService(
      store,
      new DiscordRoleRepository(interaction.guild, config.boosterRoleAnchorRoleId),
      { anchorPosition: resolveAnchorPosition(interaction.guild, config.boosterRoleAnchorRoleId) }
    );

    await handleInteraction(interaction, service, {
      isBoosting: async () => Boolean(interaction.member && "premiumSince" in interaction.member && interaction.member.premiumSince)
    });
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const service = new BoosterRoleService(
      store,
      new DiscordRoleRepository(newMember.guild, config.boosterRoleAnchorRoleId),
      { anchorPosition: resolveAnchorPosition(newMember.guild, config.boosterRoleAnchorRoleId) }
    );

    await handleGuildMemberUpdate(oldMember, newMember, service);
  });
}

function resolveAnchorPosition(guild: { members: { me: { roles: { highest: { position: number } } } | null }; roles: { cache: { get(id: string): { position: number } | undefined } } }, anchorRoleId: string | null): number {
  if (!anchorRoleId) return botRolePosition(guild);
  return guild.roles.cache.get(anchorRoleId)?.position ?? botRolePosition(guild);
}

function botRolePosition(guild: { members: { me: { roles: { highest: { position: number } } } | null } }): number {
  return guild.members.me?.roles.highest.position ?? 1;
}
