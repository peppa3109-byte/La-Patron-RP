import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
  ChannelType,
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';

// Cambia esta URL por tu banner de "Server UP" (imgur, discord cdn, etc.)
const DEFAULT_BANNER_URL = 'https://imgur.com/a/H3C8nNf';
const DEFAULT_TITLE = 'ENVENENADO RP ESTA ABIERTO';
const DEFAULT_CONNECT = 'cfx.re/join/xlladb5';
const DEFAULT_EXTRA = O ABRE <#1518421283946238103> si tienes problemas para ingresar

export default {
  data: new SlashCommandBuilder()
    .setName('serverup')
    .setDescription('Anuncia que el servidor está online')
    .setDefaultMemberPermissions(PermissionFlagsBits.MentionEveryone)
    .addSubcommand((sub) =>
      sub
        .setName('enviar')
        .setDescription('Envía el anuncio estándar de Server UP')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal donde se envía (por defecto este)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt
            .setName('tickets')
            .setDescription('Canal de tickets para mencionar')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('custom')
        .setDescription('Anuncio personalizado de Server UP')
        .addStringOption((opt) =>
          opt
            .setName('titulo')
            .setDescription('Título (ej: ENVENENADO IS UP)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('connect')
            .setDescription('IP / código de conexión')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('mensaje')
            .setDescription('Texto extra (usa {tickets} para mencionar el canal de tickets)')
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('imagen')
            .setDescription('URL de la imagen/banner')
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal donde se envía')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt
            .setName('tickets')
            .setDescription('Canal de tickets')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('everyone')
            .setDescription('Mencionar @everyone (default: true)')
            .setRequired(false),
        ),
    ),

  async execute(interaction) {
    try {
      const deferred = await InteractionHelper.safeDefer(interaction, {
        flags: MessageFlags.Ephemeral,
      });
      if (!deferred) return;

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.MentionEveryone)) {
        return await replyUserError(interaction, {
          type: ErrorTypes.PERMISSION,
          message: 'Necesitas permiso para mencionar @everyone.',
        });
      }

      const sub = interaction.options.getSubcommand();
      const channel =
        interaction.options.getChannel('canal') || interaction.channel;
      const ticketsChannel = interaction.options.getChannel('tickets');

      if (!channel?.isTextBased?.()) {
        return await replyUserError(interaction, {
          type: ErrorTypes.VALIDATION,
          message: 'Elige un canal de texto válido.',
        });
      }

      const me = interaction.guild.members.me;
      const perms = channel.permissionsFor(me);
      if (!perms?.has(['ViewChannel', 'SendMessages', 'EmbedLinks', 'MentionEveryone'])) {
        return await replyUserError(interaction, {
          type: ErrorTypes.PERMISSION,
          message: `No tengo permisos en ${channel} (Ver, Enviar, Embeds, Mencionar everyone).`,
        });
      }

      let title, connect, extra, imageUrl, pingEveryone;

      if (sub === 'enviar') {
        title = DEFAULT_TITLE;
        connect = DEFAULT_CONNECT;
        extra = DEFAULT_EXTRA;
        imageUrl = DEFAULT_BANNER_URL;
        pingEveryone = true;
      } else {
        title = interaction.options.getString('titulo');
        connect = interaction.options.getString('connect');
        extra =
          interaction.options.getString('mensaje') ||
          'O ABRE {tickets} si tienes problemas para ingresar';
        imageUrl = interaction.options.getString('imagen') || DEFAULT_BANNER_URL;
        pingEveryone = interaction.options.getBoolean('everyone') !== false;
      }

      const ticketsText = ticketsChannel ? `${ticketsChannel}` : '#Tickets';
      const bodyExtra = extra.replace(/\{tickets\}/gi, ticketsText);

      const description = [
        `\`\`\`\n${connect}\n\`\`\``,
        bodyExtra,
      ].join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x9B00FF)
        .setTitle(title)
        .setDescription(description)
        .setImage(imageUrl)
        .setTimestamp();

      await channel.send({
        content: pingEveryone ? '@everyone' : null,
        embeds: [embed],
        allowedMentions: { parse: pingEveryone ? ['everyone'] : [] },
      });

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Server UP enviado en ${channel}`,
      });
    } catch (error) {
      logger.error('serverup error:', error);
      await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: 'No se pudo enviar el anuncio.',
      });
    }
  },
};
