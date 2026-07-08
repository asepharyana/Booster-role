import { loadConfig } from "./config";
import { createDb } from "./db";
import { attachBotHandlers } from "./discord/bot";
import { createDiscordClient } from "./discord/client";
import { registerGuildCommandsWithToken } from "./discord/registerCommands";
import { startBoostCleanup } from "./services/boostCleanupService";
import { DiscordRoleRepository } from "./services/discordRoleRepository";
import { DrizzleBoosterRoleStore } from "./services/drizzleBoosterRoleStore";
import { logger } from "./logger";

const config = loadConfig();
logger.info("Registering guild commands", { guildId: config.discordGuildId });
await registerGuildCommandsWithToken(config.discordToken, {
  clientId: config.discordClientId,
  guildId: config.discordGuildId
});
logger.info("Guild commands registered", { guildId: config.discordGuildId });

const client = createDiscordClient();
const db = createDb(config.databaseUrl);
const store = new DrizzleBoosterRoleStore(db);

client.once("clientReady", () => {
  logger.info("Discord client ready", { bot: client.user?.tag ?? "unknown bot" });

  // Start periodic cleanup for boost ends missed during downtime 
  startBoostCleanup(
    client,
    store,
    (guild) => new DiscordRoleRepository(guild),
    {
      intervalMs: config.boostCleanupIntervalMs,
      boosterEligibilityRoleId: config.boosterEligibilityRoleId,
      anchorRoleId: config.boosterRoleAnchorRoleId,
    },
  );
  logger.info("Boost cleanup started", { intervalMs: config.boostCleanupIntervalMs });
});

attachBotHandlers(client, config);

logger.info("Logging in Discord client");
await client.login(config.discordToken);
