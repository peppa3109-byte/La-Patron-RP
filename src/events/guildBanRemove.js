import { Events, AuditLogEvent } from 'discord.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { logger } from '../utils/logger.js';

export default {
  name: Events.GuildBanRemove,
  once: false,

  async execute(ban) {
    try {
      const { guild, user } = ban;
      if (!guild || !user) return;

      let moderator = null;
      let reason = null;

      try {
        const logs = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberBanRemove,
          limit: 5,
        });

        const entry = logs.entries.find(
          (e) =>
            e.target?.id === user.id &&
            Date.now() - e.createdTimestamp < 15_000,
        );

        if (entry) {
          moderator = entry.executor;
          reason = entry.reason || null;
        }
      } catch (err) {
        logger.debug('Could not fetch unban audit log:', err.message);
      }

      await logEvent({
        client: ban.client,
        guildId: guild.id,
        eventType: EVENT_TYPES.MODERATION_UNBAN,
        data: {
          title: 'Usuario desbaneado',
          lines: [
            `**Usuario:** ${user.toString()} (\`${user.tag}\`)`,
            `**ID:** \`${user.id}\``,
            `**Moderador:** ${moderator ? `${moderator.toString()} (\`${moderator.tag}\`)` : '*Desconocido*'}`,
            `**Motivo:** ${reason || '*Sin motivo*'}`,
          ],
          thumbnail: user.displayAvatarURL({ dynamic: true }),
          userId: user.id,
        },
      });
    } catch (error) {
      logger.error('Error in guildBanRemove:', error);
    }
  },
};
