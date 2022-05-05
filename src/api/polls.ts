/* eslint no-return-await: "off" */

import { CommandInteraction, TextChannel } from "discord.js";
import axios from "axios";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { NewPoll, Poll } from "./types";
import Main from "../Main";
import logger from "../utils/logger";
import config from "../config";

const createPollText = async (
  poll: NewPoll | Poll,
  results = undefined
): Promise<string> => {
  const { options, reactions, expDate } = poll;

  const [pollResults, numOfVoters] = results
    ? results.data
    : [options.map(() => 0), 0];

  const allVotes = pollResults.reduce((a, b) => a + b, 0);

  const optionsText = options
    .map((option, idx) => {
      const perc = (pollResults[idx] / (allVotes || 1)) * 100;

      return `${reactions[idx]} ${option}\n▫️${
        Number.isInteger(perc) ? perc : perc.toFixed(2)
      }%`;
    })
    .join("\n\n");

  dayjs.extend(utc);

  const dateText = dayjs().isAfter(dayjs.unix(+expDate))
    ? "Poll has already ended."
    : `Poll ends on <t:${expDate}>`;

  const votersText = `👥 ${numOfVoters} person${
    numOfVoters === 1 ? "" : "s"
  } voted so far.`;

  return `${optionsText}\n\n${dateText}\n\n${votersText}`;
};

const createPoll = async (poll: NewPoll): Promise<boolean> => {
  const { channelId, question, expDate, options, reactions, requirementId } =
    poll;

  try {
    const channel = Main.Client.channels.cache.get(channelId) as TextChannel;

    await axios.post(
      `${config.backendUrl}/poll`,
      {
        platform: config.platform,
        platformId: channel.guildId,
        channelId,
        requirementId,
        question,
        startDate: dayjs().unix(),
        expDate,
        options,
        reactions,
      },
      { timeout: 150000 }
    );

    return true;
  } catch (e) {
    logger.error(e);
  }

  return false;
};

const endPoll = async (
  id: string,
  interaction?: CommandInteraction
): Promise<void> => {
  const pollResponse = await axios.get(`${config.backendUrl}/poll/${id}`);

  const poll = pollResponse.data;

  if (poll) {
    const owner = interaction.guild
      ? await interaction.guild.fetchOwner()
      : await (
          Main.Client.channels.cache.get(poll.channelId) as any
        ).guild.fetchOwner();

    if (interaction.user.id === owner.id) {
      poll.ended = true;

      await axios.post(`${config.backendUrl}/poll`, poll, {
        timeout: 150000,
      });

      interaction.reply({
        content: `Poll #${id} has been closed.`,
        ephemeral: interaction.channel.type !== "DM",
      });
    } else {
      interaction.reply({
        content: "Seems like you are not the guild owner.",
        ephemeral: interaction.channel.type !== "DM",
      });
    }
  } else {
    interaction.reply({
      content: `Couldn't find a poll with the id #${id}.`,
      ephemeral: interaction.channel.type !== "DM",
    });
  }
};

const hasEnded = async (id: string): Promise<boolean> => {
  const pollResponse = await axios.get(`${config.backendUrl}/poll/${id}`);

  return pollResponse.data.ended;
};

export { createPollText, createPoll, endPoll, hasEnded };
