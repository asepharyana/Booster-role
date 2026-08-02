export type AppConfig = {
  discordToken: string;
  discordClientId: string;
  discordGuildId: string;
  databaseUrl: string;
  boosterRoleAnchorRoleId: string | null;
  boosterEligibilityRoleId: string;
  boostCleanupIntervalMs: number;
  boosterGreetingChannelId: string | null;
};

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    discordToken: requireEnv(env, "DISCORD_TOKEN"),
    discordClientId: requireEnv(env, "DISCORD_CLIENT_ID"),
    discordGuildId: requireEnv(env, "DISCORD_GUILD_ID"),
    databaseUrl: env.DATABASE_URL ?? "postgresql://asephs:***@100.121.180.82:6432/boost",
    boosterRoleAnchorRoleId: env.BOOSTER_ROLE_ANCHOR_ROLE_ID ?? null,
    boosterEligibilityRoleId: env.BOOSTER_ELIGIBILITY_ROLE_ID ?? "1206431347925852162",
    boostCleanupIntervalMs: Number(env.BOOST_CLEANUP_INTERVAL_MS) || 5 * 60 * 1000,
    boosterGreetingChannelId: env.BOOSTER_GREETING_CHANNEL_ID ?? null
  };
}

function requireEnv(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}
