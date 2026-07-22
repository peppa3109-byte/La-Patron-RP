import {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import { successEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { InteractionHelper } from '../utils/interactionHelper.js';
import { replyUserError, ErrorTypes, handleInteractionError } from '../utils/errorHandler.js';

function buildDisabledButtons(approved) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('wl_done_approve')
      .setLabel(approved ? 'Aprobado' : 'Aprobar')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('wl_done_reject')
      .setLabel(approved ? 'Rechazar' : 'Rechazado')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
  );
}

async function handleReview(interaction, client, isApprove) {
  try {
    if (!interaction.inGuild()) {
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: 'Esta acción solo se puede usar en un servidor.',
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return await replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'Solo un **Administrador** puede gestionar solicitudes de WL.',
      });
    }

    await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const parts = interaction.customId.split(':');
    const userId = parts[1];
    if (!userId) {
      return await replyUserError(interaction, {
        type: ErrorTypes.VALIDATION,
        message: 'No se pudo identificar al solicitante.',
      });
    }

    const guild = interaction.guild;
    const config = await getGuildConfig(client, guild.id);
    const wl = config.whitelist || {};

    const originalEmbed = interaction.message?.embeds?.[0];
    if (!originalEmbed) {
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: 'No se encontró el embed de la solicitud.',
      });
    }

    // Evitar procesar dos veces
    const statusField = originalEmbed.fields?.find(
      (f) => f.name?.toLowerCase().includes('estado'),
    );
    if (statusField && /aprobad|rechazad/i.test(statusField.value || '')) {
      return await replyUserError(interaction, {
        type: ErrorTypes.VALIDATION,
        message: 'Esta solicitud ya fue procesada.',
      });
    }

    let roleAssigned = false;
    let roleName = null;

    if (isApprove && wl.roleId) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        const role = guild.roles.cache.get(wl.roleId);

        if (member && role) {
          await member.roles.add(role, `WL aprobada por ${interaction.user.tag}`);
          roleAssigned = true;
          roleName = role.name;
        }
      } catch (error) {
        logger.error('Failed to assign WL role', { error: error.message, userId });
      }
    }

    const newStatus = isApprove ? 'Aprobada' : 'Rechazada';
    const statusColor = isApprove ? 0x57f287 : 0xed4245;
    const statusEmoji = isApprove ? '🟢' : '🔴';

    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(statusColor)
      .setFields(
        ...(originalEmbed.fields || []).map((field) => {
          if (field.name?.toLowerCase().includes('estado')) {
            return {
              name: field.name,
              value: `${statusEmoji} ${newStatus}`,
              inline: field.inline,
            };
          }
          return field;
        }),
      )
      .setFooter({
        text: `${isApprove ? 'Aprobada' : 'Rechazada'} por ${interaction.user.tag} • Sistema de Whitelist`,
      })
      .setTimestamp();

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: [buildDisabledButtons(isApprove)],
    });

    // DM al usuario (si tiene abiertos)
    try {
      const user = await client.users.fetch(userId);
      await user.send({
        embeds: [
          successEmbed(
            isApprove ? 'Whitelist aprobada' : 'Whitelist rechazada',
            isApprove
              ? `Tu solicitud de **Whitelist** en **${guild.name}** fue **aprobada**.${
                  roleAssigned ? `\nSe te asignó el rol **${roleName}**.` : ''
                }`
              : `Tu solicitud de **Whitelist** en **${guild.name}** fue **rechazada**.`,
          ).setColor(statusColor),
        ],
      });
    } catch {
      // DSiguiente paso: **crear los botones de Aprobar / Rechazar**.

### 1. Crea este archivo en GitHub:

**Add file → Create new file** y pon este nombre:
