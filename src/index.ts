import { loadConfig } from "./config";
import { createDiscordClient } from "./discord/client";
import { registerGuildCommandsWithToken } from "./discord/registerCommands";

const config = loadConfig();
await registerGuildCommandsWithToken(config.discordToken, {
  clientId: config.discordClientId,
  guildId: config.discordGuildId
});

const client = createDiscordClient();

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user?.tag ?? "unknown bot"}`);
});

await client.login(config.discordToken);
