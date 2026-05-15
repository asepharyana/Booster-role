import { SlashCommandBuilder } from "discord.js";

export const boosterRoleCommand = new SlashCommandBuilder()
  .setName("booster-role")
  .setDescription("Manage your cosmetic booster role")
  .addSubcommand((command) =>
    command
      .setName("claim")
      .setDescription("Claim a new custom cosmetic booster role")
      .addStringOption((option) => option.setName("name").setDescription("Role name").setRequired(true))
      .addStringOption((option) => option.setName("color").setDescription("Hex color like #AABBCC"))
      .addAttachmentOption((option) => option.setName("icon").setDescription("Optional role icon image"))
  )
  .addSubcommand((command) =>
    command
      .setName("rename")
      .setDescription("Rename your bot-managed booster role")
      .addStringOption((option) => option.setName("name").setDescription("New role name").setRequired(true))
  )
  .addSubcommand((command) =>
    command
      .setName("recolor")
      .setDescription("Recolor your bot-managed booster role")
      .addStringOption((option) => option.setName("color").setDescription("Hex color like #AABBCC").setRequired(true))
  )
  .addSubcommand((command) =>
    command
      .setName("icon")
      .setDescription("Set an optional icon on your bot-managed booster role")
      .addAttachmentOption((option) => option.setName("image").setDescription("Role icon image").setRequired(true))
  )
  .addSubcommand((command) => command.setName("delete").setDescription("Delete your bot-managed booster role"));
