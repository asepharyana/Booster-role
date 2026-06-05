import { logger } from "../../logger";

type GuildTextChannel = {
  send(input: { content: string }): Promise<unknown>;
};

type GuildMemberLike = {
  id: string;
  user?: { id: string };
  guild: {
    id: string;
    channels: {
      cache: {
        get(channelId: string): GuildTextChannel | undefined;
      };
    };
  };
};

/**
 * Sends a welcome message to the configured greeting channel.
 * Call this after confirming the member newly gained the booster eligibility role.
 */
export async function sendBoostGreeting(
  member: GuildMemberLike,
  greetingChannelId: string,
): Promise<void> {
  const channel = member.guild.channels.cache.get(greetingChannelId);

  if (!channel) {
    logger.warn("Boost greeting channel not found", {
      channelId: greetingChannelId,
      guildId: member.guild.id,
    });
    return;
  }

  const mention = member.user?.id ?? member.id;
  const message =
    `🎉 Thank you for boosting <@${mention}>! ` +
    `You can now claim a custom role using \`/booster-role claim\` in <#${greetingChannelId}>.`;

  await channel.send({ content: message });

  logger.info("Boost greeting sent", {
    userId: member.id,
    guildId: member.guild.id,
    channelId: greetingChannelId,
  });
}
