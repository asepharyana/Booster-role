import { describe, expect, test } from "bun:test";
import { registerGuildCommands, type DiscordRestClient } from "./registerCommands";

class FakeRestClient implements DiscordRestClient {
  route: string | null = null;
  body: unknown = null;

  async put(route: string, input: { body: unknown }): Promise<unknown> {
    this.route = route;
    this.body = input.body;
    return null;
  }
}

describe("registerGuildCommands", () => {
  test("registers booster role command to the configured guild", async () => {
    const rest = new FakeRestClient();

    await registerGuildCommands(rest, { clientId: "client", guildId: "guild" });

    expect(rest.route).toBe("/applications/client/guilds/guild/commands");
    expect(rest.body).toEqual([
      expect.objectContaining({ name: "booster-role", description: "Manage your cosmetic booster role" })
    ]);
  });
});
