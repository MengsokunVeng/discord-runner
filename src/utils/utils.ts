/* eslint-disable default-param-last */
import { AxiosResponse } from "axios";
import {
  GuildMember,
  DiscordAPIError,
  MessageButton,
  MessageActionRow,
  MessageEmbed,
  Guild,
  Collection,
  GuildChannel,
  Permissions,
  MessageOptions,
  Role,
  PartialGuildMember,
} from "discord.js";
import { GetGuildResponse } from "@guildxyz/sdk";
import { ActionError, ErrorResult, UserResult } from "../api/types";
import config from "../config";
import Main from "../Main";
import logger from "./logger";

const getUserResult = (member: GuildMember): UserResult => ({
  username: member.user.username,
  discriminator: member.user.discriminator,
  avatar: member.user.avatar,
  roles: member.roles.cache
    .filter((role) => role.id !== member.guild.roles.everyone.id)
    .map((role) => role.id),
});

const getErrorResult = (error: Error): ErrorResult => {
  let errorMsg: string;
  let ids: string[];
  if (error instanceof DiscordAPIError) {
    if (error.code === 50001) {
      // Missing access
      errorMsg = "guild not found";
    } else if (error.code === 10013) {
      // Unknown User
      errorMsg = "cannot fetch member";
    } else if (error.code === 10007) {
      // Unknown Member
      errorMsg = "user is not member";
    } else {
      errorMsg = `discord api error: ${error.message}`;
    }
  } else if (error instanceof ActionError) {
    errorMsg = error.message;
    ids = error.ids;
  } else {
    logger.error(error);
    errorMsg = error.message;
  }
  return {
    errors: [
      {
        msg: errorMsg,
        value: ids,
      },
    ],
  };
};

const logBackendError = (error) => {
  const errorData = error.response?.data;
  const errors = errorData?.errors;

  if (errors?.length > 0 && errors[0]?.msg) {
    logger.verbose(errors[0].msg);
  } else if (error.response?.data) {
    logger.verbose(JSON.stringify(errorData));
  } else {
    logger.verbose(JSON.stringify(error));
  }
};

const logAxiosResponse = (res: AxiosResponse<any>) => {
  const data = JSON.stringify(res.data);
  logger.verbose(
    `${res.status} ${res.statusText} data:${
      data.length > 2000 ? " hidden" : data
    }`
  );
  return res;
};

const isNumber = (value: any) =>
  typeof value === "number" && Number.isFinite(value);

const createJoinInteractionPayload = (
  guild: GetGuildResponse,
  title: string = "Verify your wallet",
  messageText: string = null,
  buttonText?: string
) => {
  const joinButton = new MessageButton({
    customId: "join-button",
    label: buttonText || `Join ${guild?.name || "Guild"}`,
    emoji: "🔗",
    style: "PRIMARY",
  });
  const guideButton = new MessageButton({
    label: "Guide",
    url: "https://docs.guild.xyz/",
    style: "LINK",
  });
  const row = new MessageActionRow({ components: [joinButton, guideButton] });
  return {
    embeds: [
      new MessageEmbed({
        title,
        url: guild ? `${config.guildUrl}/${guild?.urlName}` : null,
        description:
          messageText ||
          guild?.description ||
          "Join this guild and get your role(s)!",
        color: `#${config.embedColor}`,
        author: {
          name: guild?.name || "Guild",
          iconURL: encodeURI(
            guild?.imageUrl?.startsWith("https")
              ? guild?.imageUrl
              : "https://cdn.discordapp.com/attachments/950682012866465833/951448319169802250/kerek.png"
          ),
        },
        thumbnail: {
          url: "https://cdn.discordapp.com/attachments/950682012866465833/951448318976884826/dc-message.png",
        },
        footer: {
          text: "Do not share your private keys. We will never ask for your seed phrase.",
        },
      }),
    ],
    components: [row],
  };
};

const getAccessedChannelsByRoles = (guild: Guild, accessedRoles: string[]) =>
  guild.channels.cache.filter(
    (channel) =>
      channel.type !== "GUILD_CATEGORY" &&
      !channel.isThread() &&
      channel.permissionOverwrites.cache.some(
        (po) =>
          accessedRoles.some((ar) => ar === po.id) &&
          po.allow.has(Permissions.FLAGS.VIEW_CHANNEL)
      )
  ) as Collection<string, GuildChannel>;

const getJoinReplyMessage = async (
  roleIds: string[],
  guild: Guild,
  userId: string
): Promise<MessageOptions> => {
  let message: MessageOptions;
  logger.verbose(`getJoinReply - ${roleIds} ${guild.id} ${userId}`);
  if (roleIds && roleIds.length !== 0) {
    const channelIds = getAccessedChannelsByRoles(guild, roleIds).map(
      (c) => c.id
    );

    if (channelIds.length === 0) {
      const roleNames = guild.roles.cache
        .filter((role) => roleIds.some((roleId) => roleId === role.id))
        .map((role) => role.name);
      message = {
        content: `✅ You got the \`${roleNames.join(", ")}\` role${
          roleNames.length > 1 ? "s" : ""
        }.`,
      };
    } else if (channelIds.length === 1) {
      message = {
        content: `✅ You got access to this channel: <#${channelIds[0]}>`,
      };
    } else {
      message = {
        content: `✅ You got access to these channels:\n${channelIds
          .map((c: string) => `<#${c}>`)
          .join("\n")}`,
      };
    }
  } else if (roleIds && roleIds[0] !== "") {
    message = {
      content: "❌ You don't have access to any guilds in this server.",
    };
  } else {
    const guildOfServer = await Main.platform.guild.get(guild.id);

    const button = new MessageButton({
      label: "Join",
      style: "LINK",
      url: `${config.guildUrl}/${guildOfServer.urlName}/?discordId=${userId}`,
    });

    return {
      components: [new MessageActionRow({ components: [button] })],
      content: `This is **your** join link. Do **NOT** share it with anyone!`,
    };
  }

  return message;
};

const denyViewEntryChannelForRole = async (
  role: Role,
  entryChannelId: string
) => {
  try {
    const entryChannel = role.guild.channels.cache.get(
      entryChannelId
    ) as GuildChannel;
    if (
      !!entryChannel &&
      !entryChannel.permissionOverwrites.cache
        .get(role.id)
        ?.deny.has(Permissions.FLAGS.VIEW_CHANNEL)
    ) {
      await entryChannel.permissionOverwrites.create(role.id, {
        VIEW_CHANNEL: false,
      });
    }
  } catch (error) {
    logger.warn(error);
    throw new Error(
      `Entry channel does not exists. (server: ${role.guild.id}, channel: ${entryChannelId})`
    );
  }
};

const getChannelsByCategoryWithRoles = (guild: Guild) => {
  // sort channels by categoryId
  const channelsByCategoryId = guild.channels.cache.reduce<
    Map<string, { id: string; name: string; roles: string[] }[]>
  >((acc, ch) => {
    // skip if not text or news channel
    if (ch.type !== "GUILD_TEXT" && ch.type !== "GUILD_NEWS") {
      return acc;
    }

    // handle where threre is not parent
    const parentId = ch.parent?.id || "-";

    // create parentId key if not exists
    if (!acc.has(parentId)) {
      acc.set(parentId, []);
    }

    // filter for roles that have explicit permission overwrites
    const roles = guild.roles.cache
      .filter((role) =>
        ch.permissionOverwrites.cache
          .get(role.id)
          ?.allow.has(Permissions.FLAGS.VIEW_CHANNEL)
      )
      .map((role) => role.id);

    // add channel info to the category's array
    acc.get(parentId).push({
      id: ch.id,
      name: ch.name,
      roles,
    });
    return acc;
  }, new Map());

  // add categoryName and convert to array
  const channelsByCategory = [];
  channelsByCategoryId.forEach((v, k) => {
    channelsByCategory.push({
      id: k,
      name: k === "-" ? "-" : guild.channels.cache.get(k).name,
      channels: v,
    });
  });

  return channelsByCategory;
};

const updateAccessedChannelsOfRole = (
  serverId: string,
  roleId: string,
  channelIds: string[],
  isGuarded: boolean,
  entryChannelId: string
) => {
  const shouldHaveAccess = new Set(channelIds);

  const channels = Main.client.guilds.cache
    .get(serverId)
    ?.channels.cache.filter((channel) => !channel.isThread()) as Collection<
    string,
    GuildChannel
  >;

  if (isGuarded) {
    shouldHaveAccess.delete(entryChannelId);
    channels.delete(entryChannelId);
  }

  const [channelsToAllow, channelsToDeny] = channels.partition(
    (channel) =>
      shouldHaveAccess.has(channel.id) ||
      shouldHaveAccess.has(channel.parentId) ||
      (channel.type !== "GUILD_CATEGORY" &&
        !channel.parent &&
        shouldHaveAccess.has("-"))
  );

  return Promise.all([
    ...channelsToDeny.map((channelToDenyAccessTo) =>
      channelToDenyAccessTo.permissionOverwrites.edit(roleId, {
        VIEW_CHANNEL: null,
      })
    ),
    ...channelsToAllow.map((channelToAllowAccessTo) =>
      channelToAllowAccessTo.permissionOverwrites.edit(roleId, {
        VIEW_CHANNEL: true,
      })
    ),
    ...channelsToAllow.map((channelToAllowAccessTo) =>
      channelToAllowAccessTo.permissionOverwrites.edit(
        Main.client.guilds.cache.get(serverId).roles.everyone.id,
        {
          VIEW_CHANNEL: false,
        }
      )
    ),
  ]);
};

const notifyAccessedChannels = async (
  member: GuildMember | PartialGuildMember,
  roleId: string,
  guildName: string
) => {
  const accessedChannels = getAccessedChannelsByRoles(member.guild, [roleId]);

  const sortedChannels = accessedChannels.reduce<
    Map<string | null, GuildChannel[]>
  >((acc, value) => {
    let channels = acc.get(value?.parent?.name);
    if (!channels) {
      channels = [];
    }
    channels.push(value);
    acc.set(value?.parent?.name, channels);
    return acc;
  }, new Map());

  let message: string;
  if (accessedChannels.size === 0) {
    message = `You got access to the \`${guildName}\` role  in \`${member.guild.name}\`.`;
  } else {
    message = `You got access to ${
      accessedChannels.size > 1 ? "these channels" : "this channel"
    } with the \`${guildName}\` role in \`${member.guild.name}\`:`;
  }

  const embed = new MessageEmbed({
    title: message,
    color: `#${config.embedColor}`,
  });

  const categoryEmoji = Main.client.emojis.cache.get("893836008712441858");
  const privateChannelEmoji =
    Main.client.emojis.cache.get("893836025699377192");

  sortedChannels.forEach((channel, key) => {
    const fieldValue = channel
      .map(
        (c) =>
          `[${privateChannelEmoji || ""}${
            c.name
          }](https://discord.com/channels/${member.guild.id}/${c.id})`
      )
      .join("\n");
    embed.addField(
      `${categoryEmoji || ""}${key || "Without Category"}`,
      fieldValue.length < 1025 ? fieldValue : fieldValue.substring(0, 1024)
    );
  });

  member.send({ embeds: [embed] }).catch(logger.error);
};

export {
  getUserResult,
  getErrorResult,
  logBackendError,
  logAxiosResponse,
  isNumber,
  createJoinInteractionPayload,
  getJoinReplyMessage,
  getAccessedChannelsByRoles,
  denyViewEntryChannelForRole,
  getChannelsByCategoryWithRoles,
  updateAccessedChannelsOfRole,
  notifyAccessedChannels,
};
