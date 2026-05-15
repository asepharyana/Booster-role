import { MessageFlags } from "discord.js";
import type { BoosterRoleRecord, RoleIcon } from "../services/boosterRoleService";

export type ChatInputInteractionLike = {
  commandName: string;
  guildId: string | null;
  user: { id: string };
  isChatInputCommand(): boolean;
  reply(input: { content: string; flags: MessageFlags.Ephemeral }): Promise<unknown>;
  options: {
    getSubcommand(): string;
    getString(name: string): string | null;
    getAttachment(name: string): { contentType: string | null; size: number; url: string } | null;
  };
};

export type BoosterRoleCommandService = {
  claimRole(input: { guildId: string; userId: string; name: string; color: string | null; icon?: RoleIcon | null; isBoosting: boolean }): Promise<BoosterRoleRecord | { roleId: string }>;
  renameRole(input: { guildId: string; userId: string; name: string }): Promise<void>;
  recolorRole(input: { guildId: string; userId: string; color: string }): Promise<void>;
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

    if (subcommand === "claim") {
      const role = await service.claimRole({
        guildId,
        userId,
        name: requireString(interaction, "name"),
        color: interaction.options.getString("color"),
        icon: optionalIcon(interaction, "icon"),
        isBoosting: await deps.isBoosting(guildId, userId)
      });
      await interaction.reply({ content: `Booster role created: <@&${role.roleId}>`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "rename") {
      await service.renameRole({ guildId, userId, name: requireString(interaction, "name") });
      await interaction.reply({ content: "Booster role renamed.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "recolor") {
      await service.recolorRole({ guildId, userId, color: requireString(interaction, "color") });
      await interaction.reply({ content: "Booster role color updated.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "icon") {
      await service.setRoleIcon({ guildId, userId, icon: requireIcon(interaction, "image") });
      await interaction.reply({ content: "Booster role icon updated.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "delete") {
      await service.deleteRole({ guildId, userId });
      await interaction.reply({ content: "Booster role deleted.", flags: MessageFlags.Ephemeral });
      return;
    }

    throw new Error("Unknown booster-role subcommand");
  } catch (error) {
    await interaction.reply({ content: error instanceof Error ? error.message : "Command failed", flags: MessageFlags.Ephemeral });
  }
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
