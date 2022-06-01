import { Request, Response } from "express";
import { validationResult } from "express-validator";
import logger from "../utils/logger";
import { getErrorResult, updateAccessedChannelsOfRole } from "../utils/utils";
import {
  createChannel,
  createRole,
  deleteChannelAndRole,
  getRole,
  isIn,
  isMember,
  listAdministeredServers,
  getServerInfo,
  updateRoleName,
  sendJoinButton,
  deleteRole,
  getUser,
  manageMigratedActions,
  setupGuildGuard,
  getEmoteList,
  getChannelList,
  resetGuildGuard,
  getMembersByRoleId,
  sendPollMessage,
} from "./actions";
import { getInvite, getServerName, handleAccessEvent } from "./service";
import {
  AccessEventParams,
  CreateChannelParams,
  DeleteChannelAndRoleParams,
} from "./types";

const controller = {
  access: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const params: AccessEventParams[] = req.body;

    try {
      const results = await Promise.all(
        params.map(async (aep) => {
          try {
            await handleAccessEvent(aep);
            return true;
          } catch (error) {
            logger.error(
              `accss action error: params: ${JSON.stringify(
                aep
              )} error: ${error}`
            );
            return false;
          }
        })
      );
      res.status(200).json(results);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  invite: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { platformGuildId } = req.params;

    try {
      const result = await getInvite(platformGuildId);
      res.status(200).json(result);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  info: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const { platformGuildId } = req.params;
      const guildName = await getServerName(platformGuildId);

      res.status(200).json(guildName);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  isMember: (req: Request, res: Response): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { serverId, platformUserId } = req.body;

    isMember(serverId, platformUserId)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch((error) => {
        const errorMsg = getErrorResult(error);
        res.status(400).json(errorMsg);
      });
  },

  createRole: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const { serverId, roleName, isGuarded, entryChannelId, gatedChannels } =
        req.body;

      const roleId = await createRole(
        serverId,
        roleName,
        isGuarded,
        entryChannelId
      );

      await updateAccessedChannelsOfRole(
        serverId,
        roleId,
        gatedChannels,
        isGuarded,
        entryChannelId
      );

      res.status(201).json(roleId);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  updateRole: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const {
        serverId,
        roleId,
        roleName,
        isGuarded,
        entryChannelId,
        gatedChannels,
      } = req.body;

      await updateRoleName(
        serverId,
        roleId,
        roleName,
        isGuarded,
        entryChannelId
      );

      await updateAccessedChannelsOfRole(
        serverId,
        roleId,
        gatedChannels,
        isGuarded,
        entryChannelId
      );

      res.status(200).send();
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  deleteRole: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const { guildId, roleId } = req.body;
      const deleted = await deleteRole(guildId, roleId);
      res.status(200).json(deleted);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  createGuildGuard: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const { serverId, entryChannelId, roleIds } = req.body;
      const createdEntryChannelId = await setupGuildGuard(
        serverId,
        entryChannelId,
        roleIds
      );
      res.status(200).json(createdEntryChannelId);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  resetGuildGuard: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const { serverId, entryChannelId } = req.body;
      const createdEntryChannelId = await resetGuildGuard(
        serverId,
        entryChannelId
      );
      res.status(200).json(createdEntryChannelId);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  isIn: (req: Request, res: Response): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { guildId } = req.params;
    isIn(guildId)
      .then((result) => res.status(200).json(result))
      .catch((error) => {
        const errorMsg = getErrorResult(error);
        res.status(400).json(errorMsg);
      });
  },

  server: (req: Request, res: Response): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { guildId } = req.params;
    const { includeDetails } = req.body;

    getServerInfo(guildId, includeDetails)
      .then((result) => res.status(200).json(result))
      .catch((error) => {
        const errorMsg = getErrorResult(error);
        res.status(400).json(errorMsg);
      });
  },

  administeredServers: (req: Request, res: Response): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { platformUserId } = req.params;

    listAdministeredServers(platformUserId)
      .then((result) => res.status(200).json(result))
      .catch((error) => {
        const errorMsg = getErrorResult(error);
        res.status(400).json(errorMsg);
      });
  },

  createChannel: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const params: CreateChannelParams = req.body;
      const createdChannel = await createChannel(params);

      res.status(200).json(createdChannel.id);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  deleteChannelAndRole: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const params: DeleteChannelAndRoleParams = req.body;
      const deleted = await deleteChannelAndRole(params);

      res.status(200).json(deleted);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  getRoleNameByRoleId: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const { guildId, roleId } = req.params;
      const result = await getRole(guildId, roleId);

      res.status(200).json(result);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  sendJoinButtonToChannel: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const { guildId, channelId, ...sendJoinMeta } = req.body;
      const result = await sendJoinButton(guildId, channelId, sendJoinMeta);

      res.status(200).json(result);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  getUser: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const { platformUserId } = req.params;
      const result = await getUser(platformUserId);

      res.status(200).json(result);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  manageMigratedActions: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const {
        guildId,
        upgradeableUserIds,
        downgradeableUserIds,
        roleId,
        message,
      } = req.body;
      const result = await manageMigratedActions(
        guildId,
        upgradeableUserIds,
        downgradeableUserIds,
        roleId,
        message
      );
      res.status(200).json(result);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  getMembersByRole: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const { roleId, serverId } = req.params;
      const members = await getMembersByRoleId(serverId, roleId);
      res.status(200).json(members);
    } catch (error) {
      const errorMsg = getErrorResult(error);
      res.status(400).json(errorMsg);
    }
  },

  createPoll: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const msgId = await sendPollMessage(req.body.channelId, req.body);

      res.status(200).json(msgId);
    } catch (err) {
      res.status(400).json(getErrorResult(err));
    }
  },

  getEmotes: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const guildId = req?.params?.guildId;
      const result = await getEmoteList(guildId);

      res.status(200).json(result);
    } catch (err) {
      res.status(400).json(getErrorResult(err));
    }
  },

  getChannels: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const guildId = req?.params?.guildId;
      const result = await getChannelList(guildId);

      res.status(200).json(result);
    } catch (err) {
      res.status(400).json(getErrorResult(err));
    }
  },
};

export default controller;
