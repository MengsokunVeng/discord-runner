import { DiscordAPIError, Guild, GuildMember } from "discord.js";
import Main from "../../Main";
import { ActionError, UserResult } from "../types/results";
import getUserResult from "../utils/getUserResult";

export default async function isMember(
  guildId: string,
  userId: string
): Promise<UserResult | ActionError> {
  let guild: Guild;
  try {
    guild = await Main.Client.guilds.fetch(guildId);
  } catch (error) {
    if (error instanceof DiscordAPIError) {
      return {
        error: "guild not found",
      };
    }
    throw error;
  }

  let member: GuildMember;
  try {
    member = await guild.members.fetch(userId);
  } catch (error) {
    if (error instanceof DiscordAPIError) {
      if (error.message === "Unknown Member") {
        return {
          error: "not a member",
        };
      }
      return {
        error: "cannot fetch member",
      };
    }
    throw error;
  }

  return getUserResult(member);
}
