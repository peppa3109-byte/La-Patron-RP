import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getGuildConfig, patchGuildConfig } from '../../services/config/guildConfig.js';
import { withErrorHandling, createError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('wl')
    .setDescription('Configura el sistema de Whitelist (WL) del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Configura el canal donde se reciben las solicitudes de WL')
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal donde los usuarios escribirán "wl" para solicitar whitelist')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addRoleOption((option) =>
          option
            .setName('rol')
            .setDescription('Rol que se otorga al aprobar una solicitud de WL (opcional)')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('disable')
        .setDescription('Desactiva el sistema de Whitelist'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Muestra la configuración actual del sistema de WL'),
    ),

  category: 'WL',

  execute: withErrorHandling(async (interaction) => {
    if (!interaction.inGuild()) {
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: 'Este comando solo se puede usar en un servidor.',
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return await replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'Necesitas el permiso de **Administrador** para configurar el sistema de WL.',
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      await handleSetup(interaction);
    } else if (subcommand === 'disable') {
      await handleDisable(interaction);
    } else if (subcommand === 'status') {
      await handleStatus(interaction);
    }
  }, { type: 'command', commandName: 'wl' }),
};

async function handleSetup(interaction) {
  const channel = interaction.options.getChannel('canal');
  const role = interaction.options.getRole('rol');
  const guild = interaction.guild;
  const botMember = guild.members.me;

  if (!botMember) {
    throw createError(
      'Bot member not found',
      ErrorTypes.CONFIGURATION,
      'No pude verificar mis permisos en este servidor. Inténtalo de nuevo.',
      { guildId: guild.id },
    );
  }

  const requiredPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ManageMessages,
  ];

  const channelPerms = channel.permissionsFor(botMember);
  const missing = requiredPermissions.filter((perm) => !channelPerms?.has(perm));

  if (missing.length > 0) {
    throw createError(
      'Missing channel permissions for WL setup',
      ErrorTypes.PERMISSION,
      `Necesito estos permisos en ${channel}: **Ver canal**, **Enviar mensajes**, **Insertar enlaces** y **Gestionar mensajes**.`,
      { channelId: channel.id, missing },
    );
  }

  if (role) {
    if (role.managed) {
      throw createError(
        'Cannot assign managed role for WL',
        ErrorTypes.VALIDATION,
        'No puedo asignar un rol gestionado por una integración.',
        { roleId: role.id },
      );
    }
    if (role.position >= botMember.roles.highest.position) {
      throw createError(
        'WL role hierarchy too high',
        ErrorTypes.PERMISSION,
        'El rol de WL debe estar **por debajo** de mi rol más alto para poder asignarlo.',
        { roleId: role.id },
      );
    }
  }

  await patchGuildConfig(interaction.client, guild.id, {
    whitelist: {
      enabled: true,
      channelId: channel.id,
      roleId: role?.id ?? null,
    },
  });

  logger.info('WL system configured', {
    guildId: guild.id,
    channelId: channel.id,
    roleId: role?.id ?? null,
    by: interaction.user.id,
  });

  const embed = successEmbed(
    'Sistema de Whitelist configurado',
    [
      `**Canal de solicitudes:** ${channel}`,
      `**Rol al aprobar:** ${role ? role : '*Ninguno (solo se marcará como aprobado)*'}`,
      '',
      'Los usuarios deben escribir **`wl`** (o `wl <motivo>`) en ese canal para crear una solicitud.',
      'Un administrador podrá **Aprobar** o **Rechazar** con los botones del embed.',
    ].join('\n'),
  );

  await InteractionHelper.safeReply(interaction, {
    embeds: [embed],
    flags: [MessageFlags.Ephemeral],
  });
}

async function handleDisable(interaction) {
  await patchGuildConfig(interaction.client, interaction.guild.id, {
    whitelist: {
      enabled: false,
      channelId: null,
      roleId: null,
    },
  });

  await InteractionHelper.safeReply(interaction, {
    embeds: [
      successEmbed(
        'Sistema de Whitelist desactivado',
        'Ya no se procesarán mensajes `wl` como solicitudes de whitelist.',
      ),
    ],
    flags: [MessageFlags.Ephemeral],
  });
}

async function handleStatus(interaction) {
  const config = await getGuildConfig(interaction.client, interaction.guild.id);
  const wl = config.whitelist || {};

  const channelMention = wl.channelId ? `<#${wl.channelId}>` : '*No configurado*';
  const roleMention = wl.roleId ? `<@&${wl.roleId}>` : '*Ninguno*';
  const enabledLabel = wl.enabled ? 'Activado' : 'Desactivado';

  const embed = createEmbed({
    title: 'Estado del sistema de WL',
    description: [
      `**Estado:** ${enabledLabel}`,
      `**Canal:** ${channelMention}`,
      `**Rol al aprobar:** ${roleMention}`,
      '',
      'Configura con `/wl setup canal:#canal rol:@Rol`',
    ].join('\n'),
    color: wl.enabled ? 'success' : 'warning',
  });

  await InteractionHelper.safeReply(interaction, {
    embeds: [embed],
    flags: [MessageFlags.Ephemeral],
  });
}
