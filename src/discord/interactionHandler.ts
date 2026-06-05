import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { logger } from "../logger";
import { ValidationError, NotFoundError, PermissionError } from "../domain/errors";
import type { BoosterRoleRecord, RoleIcon } from "../services/boosterRoleService";

export type ChatInputInteractionLike = {
  commandName: string;
  guildId: string | null;
  user: { id: string };
  memberPermissions: { has(permission: bigint): boolean } | null;
  isChatInputCommand(): boolean;
  deferred: boolean;
  replied: boolean;
  reply(input: { content: string; flags?: MessageFlags.Ephemeral }): Promise<unknown>;
  deferReply(input?: { flags?: number }): Promise<unknown>;
  editReply(input: { content: string }): Promise<unknown>;
  options: {
    getSubcommand(): string;
    getString(name: string): string | null;
    getUser(name: string): { id: string } | null;
    getAttachment(name: string): { contentType: string | null; size: number; url: string } | null;
  };
};

export type BoosterRoleCommandService = {
  claimRole(input: {
    guildId: string;
    userId: string;
    name: string;
    color: string | null;
    color2?: string | null;
    icon?: RoleIcon | null;
    isBoosting: boolean;
  }): Promise<BoosterRoleRecord | { roleId: string }>;
  renameRole(input: { guildId: string; userId: string; name: string }): Promise<void>;
  recolorRole(input: { guildId: string; userId: string; color: string; color2?: string | null }): Promise<void>;
  setRoleIcon(input: { guildId: string; userId: string; icon: RoleIcon }): Promise<void>;
  deleteRole(input: { guildId: string; userId: string }): Promise<void>;
};

export type InteractionHandlerDeps = {
  isBoosting(guildId: string, userId: string): Promise<boolean>;
};

export async function handleInteraction(
  interaction: ChatInputInteractionLike,
  service: BoosterRoleCommandService,
  deps: InteractionHandlerDeps
): Promise<void> {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "booster-role") return;

  try {
    const guildId = requireGuildId(interaction.guildId);
    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    // Defer reply for potentially slow commands (claim, icon) to avoid 10062 "Unknown interaction"
    const shouldDefer = subcommand === "claim" || subcommand === "icon";
    if (shouldDefer) {
      await interaction.deferReply();
    }

    if (subcommand === "claim") {
      logger.info("Handling booster-role command", { guildId, userId, subcommand });
      const role = await service.claimRole({
        guildId,
        userId,
        name: requireString(interaction, "name"),
        color: interaction.options.getString("color"),
        color2: interaction.options.getString("color2"),
        icon: optionalIcon(interaction, "icon"),
        isBoosting: await deps.isBoosting(guildId, userId)
      });
      await interaction.editReply({ content: `Booster role created: <@&${role.roleId}>` });
      return;
    }

    if (subcommand === "rename") {
      logger.info("Handling booster-role command", { guildId, userId, subcommand });
      await service.renameRole({ guildId, userId, name: requireString(interaction, "name") });
      await interaction.reply({ content: "Booster role renamed." });
      return;
    }

    if (subcommand === "recolor") {
      logger.info("Handling booster-role command", { guildId, userId, subcommand });
      await service.recolorRole({ guildId, userId, color: requireString(interaction, "color"), color2: interaction.options.getString("color2") });
      await interaction.reply({ content: "Booster role color updated." });
      return;
    }

    if (subcommand === "icon") {
      logger.info("Handling booster-role command", { guildId, userId, subcommand });
      await service.setRoleIcon({ guildId, userId, icon: requireIcon(interaction, "image") });
      await interaction.editReply({ content: "Booster role icon updated." });
      return;
    }

    if (subcommand === "delete") {
      logger.info("Handling booster-role command", { guildId, userId, subcommand });
      await service.deleteRole({ guildId, userId });
      await interaction.reply({ content: "Booster role deleted." });
      return;
    }

    if (subcommand === "admin-delete") {
      requireAdministrator(interaction);
      const targetUserId = requireUser(interaction, "user").id;
      logger.info("Handling booster-role admin command", { guildId, userId, subcommand, targetUserId });
      await service.deleteRole({ guildId, userId: targetUserId });
      await interaction.reply({ content: "Booster role deleted by admin." });
      return;
    }

    throw new Error("Unknown booster-role subcommand");
  } catch (error) {
    logger.warn("Booster-role command failed", { error });
    // If already deferred, edit the reply instead of replying anew
    if (interaction.deferred) {
      await interaction.editReply({ content: toUserErrorMessage(error) });
    } else {
      await interaction.reply({ content: toUserErrorMessage(error) });
    }
  }
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof PermissionError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (error.message.includes("Missing Permissions")) {
      return "Bot is missing permissions or role position to manage this role.";
    }

    if (error.message.includes("Failed query") || error.message.includes("insert")) {
      return "Failed to save booster role. Any created role was cleaned up. Try again.";
    }
  }

  return "Command failed";
}

function requireGuildId(guildId: string | null): string {
  if (!guildId) throw new Error("This command can only be used in a server");
  return guildId;
}

function requireString(interaction: ChatInputInteractionLike, name: string): string {
  const value = interaction.options.getString(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireUser(interaction: ChatInputInteractionLike, name: string): { id: string } {
  const value = interaction.options.getUser(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireAdministrator(interaction: ChatInputInteractionLike): void {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    throw new Error("Administrator permission is required");
  }
}

function requireIcon(interaction: ChatInputInteractionLike, name: string): RoleIcon {
  const icon = optionalIcon(interaction, name);
  if (!icon) throw new Error("Role icon image is required");
  return icon;
}

function optionalIcon(interaction: ChatInputInteractionLike, name: string): RoleIcon | null {
  const attachment = interaction.options.getAttachment(name);
  if (!attachment) return null;

  return {
    contentType: attachment.contentType ?? "application/octet-stream",
    size: attachment.size,
    dataUri: attachment.url
  };
}
