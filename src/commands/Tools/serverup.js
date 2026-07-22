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

const DEFAULT_BANNER_URL = 'https://i.imgur.com/0eOqo3B.png';
const DEFAULT_TITLE = 'ENVENENADO ESTA ABIERTO';
const DEFAULT_CONNECT = 'cfx.re/join/xlladb5';
const DEFAULT_EXTRA = 'O ABRE <#1518421283946238103> si tienes problemas para ingresar';

export default {
  data: new SlashCommandBuilder()
    .setName('serverup')
    .setDescription('Anuncia que el servidor esta online')
    .setDefaultMemberPermissions(PermissionFlagsBits.MentionEveryone)
    .addSubcommand((sub) =>
      sub
        .setName('enviar')
        .setDescription('Envia el anuncio estandar de Server UP')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal donde se envia (por defecto este)')
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
            .setDescription('Titulo (ej: ENVENENADO IS UP)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('connect')
            .setDescription('IP o codigo de conexion')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('mensaje')
            .setDescription('Texto extra del anuncio')
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
            .setDescription('Canal donde se envia')
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

      if (!channel?.isTextBased?.()) {
        return await replyUserError(interaction, {
          type: ErrorTypes.VALIDATION,
          message: 'Elige un canal de texto valido.',
        });
      }

      const me = interaction.guild.members.me;
      const perms = channel.permissionsFor(me);
      if (
        !perms?.has([
          'ViewChannel',
          'SendMessages',
          'EmbedLinks',
          'MentionEveryone',
        ])
      ) {
        return await replyUserError(interaction, {
          type: ErrorTypes.PERMISSION,
          message: `No tengo permisos en ${channel}.`,
        });
      }

      let title;
      let connect;
      let extra;
      let imageUrl;
      let pingEveryone;

if (sub === 'enviar') {
  title = 'Envenenado RP';
  connect = 'cfx.re/join/xlladb5';
  extra = DEFAULT_EXTRA;
  imageUrl = 'https://i.imgur.com/0eOqo3B.png';
  pingEveryone = true;
} else {
  title = interaction.options.getString('titulo');
  connect = interaction.options.getString('connect');
  extra = interaction.options.getString('mensaje') || DEFAULT_EXTRA;
  imageUrl = interaction.options.getString('imagen') || DEFAULT_BANNER_URL;
  pingEveryone = interaction.options.getBoolean('everyone') !== false;
}

      const description = [
        '```',
        connect,
        '```',
        extra,
      ].join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x9b00ff)
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
        content: `Server UP enviado en ${channel}`,
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
