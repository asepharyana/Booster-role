import { REST, Routes } from "discord.js";
import { boosterRoleCommand } from "./commands/booster-role";

export type DiscordRestClient = {
  put(route: string, input: { body: unknown }): Promise<unknown>;
};

export type RegisterCommandsConfig = {
  clientId: string;
  guildId: string;
};

export async function registerGuildCommands(rest: DiscordRestClient, config: RegisterCommandsConfig): Promise<void> {
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: [boosterRoleCommand.toJSON()]
  });
}

export async function registerGuildCommandsWithToken(token: string, config: RegisterCommandsConfig): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  await registerGuildCommands(rest, config);
}
