import type { Client } from "discord.js";
import type { AppConfig } from "../config";
import { createDb } from "../db";
import { BoosterRoleService } from "../services/boosterRoleService";
import { DrizzleBoosterRoleStore } from "../services/drizzleBoosterRoleStore";
import { DiscordRoleRepository } from "../services/discordRoleRepository";
import { handleGuildMemberUpdate } from "./events/guildMemberUpdate";
import { sendBoostGreeting } from "./events/boostGreeting";
import { handleInteraction } from "./interactionHandler";

export function attachBotHandlers(client: Client, config: AppConfig): void {
  const db = createDb(config.databaseUrl);
  const store = new DrizzleBoosterRoleStore(db);

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const service = new BoosterRoleService(
      store,
      new DiscordRoleRepository(interaction.guild),
      { anchorPosition: resolveAnchorPosition(interaction.guild, config.boosterRoleAnchorRoleId) }
    );

    await handleInteraction(interaction, service, {
      isBoosting: async () => memberHasRole(interaction.member, config.boosterEligibilityRoleId)
    });
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const eligibilityRoleId = config.boosterEligibilityRoleId;

    // Detect boost gain: member just acquired the booster eligibility role
    const hadBooster = oldMember.roles.cache.has(eligibilityRoleId);
    const hasBooster = newMember.roles.cache.has(eligibilityRoleId);
    if (!hadBooster && hasBooster && config.boosterGreetingChannelId) {
      await sendBoostGreeting(newMember, config.boosterGreetingChannelId).catch((err) => {
        logger.error("Failed to send boost greeting", { error: String(err), userId: newMember.id });
      });
    }

    // Handle boost loss (existing behaviour)
    const service = new BoosterRoleService(
      store,
      new DiscordRoleRepository(newMember.guild),
      { anchorPosition: resolveAnchorPosition(newMember.guild, config.boosterRoleAnchorRoleId) }
    );

    await handleGuildMemberUpdate(oldMember, newMember, service, eligibilityRoleId);
  });
}

function memberHasRole(member: unknown, roleId: string): boolean {
  return Boolean(
    member &&
      typeof member === "object" &&
      "roles" in member &&
      member.roles &&
      typeof member.roles === "object" &&
      "cache" in member.roles &&
      member.roles.cache &&
      typeof member.roles.cache === "object" &&
      "has" in member.roles.cache &&
      typeof member.roles.cache.has === "function" &&
      member.roles.cache.has(roleId)
  );
}

function resolveAnchorPosition(guild: { members: { me: { roles: { highest: { position: number } } } | null }; roles: { cache: { get(id: string): { position: number } | undefined } } }, anchorRoleId: string | null): number {
  const botPosition = botRolePosition(guild);
  if (!anchorRoleId) return botPosition;
  const anchorPosition = guild.roles.cache.get(anchorRoleId)?.position ?? botPosition;
  return Math.min(anchorPosition, botPosition);
}

function botRolePosition(guild: { members: { me: { roles: { highest: { position: number } } } | null } }): number {
  return guild.members.me?.roles.highest.position ?? 1;
}
