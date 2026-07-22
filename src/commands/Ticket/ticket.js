import { getColor } from '../../config/bot.js';
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
} from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../services/config/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import ticketConfig from './modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription("Manages the server's ticket system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Sets up the ticket creation panel in a specified channel.')
                .addChannelOption((option) =>
                    option
                        .setName('panel_channel')
                        .setDescription('The channel where the ticket panel will be sent.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('panel_message')
                        .setDescription('The main message/description for the ticket panel.')
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('titulo')
                        .setDescription('Título del panel (ej: Sistema de tickets)')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('imagen')
                        .setDescription('URL de la imagen del panel de tickets')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('button_label')
                        .setDescription('Label del botón si no hay categorías (default: Create Ticket)')
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName('category')
                        .setDescription('Categoría por defecto si no usas menú de categorías.')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName('closed_category')
                        .setDescription('Categoría donde se mueven tickets cerrados (opcional).')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addRoleOption((option) =>
                    option
                        .setName('staff_role')
                        .setDescription('Rol de staff con acceso a tickets (opcional).')
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('max_tickets_per_user')
                        .setDescription('Máximo de tickets por usuario (default: 3)')
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('dm_on_close')
                        .setDescription('Enviar DM al cerrar el ticket (default: true)')
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('category-add')
                .setDescription('Añade una categoría al menú de tickets')
                .addStringOption((option) =>
                    option
                        .setName('nombre')
                        .setDescription('Nombre (ej: Soporte, Apelación)')
                        .setRequired(true),
                )
                .addChannelOption((option) =>
                    option
                        .setName('categoria_discord')
                        .setDescription('Categoría de Discord donde se abren estos tickets')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('descripcion')
                        .setDescription('Texto que sale en el menú')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('emoji')
                        .setDescription('Emoji (ej: 🛠️)')
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('category-list')
                .setDescription('Lista las categorías del menú de tickets'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('category-remove')
                .setDescription('Elimina una categoría del menú')
                .addStringOption((option) =>
                    option
                        .setName('id')
                        .setDescription('ID de la categoría (mira /ticket category-list)')
                        .setRequired(true),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Open the interactive ticket system dashboard'),
        ),

    category: 'ticket',

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferred) return;

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: 'You need the `Manage Channels` permission for this action.',
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'dashboard') {
            return ticketConfig.execute(interaction, config, client);
        }

        if (subcommand === 'category-add') {
            return handleCategoryAdd(interaction, client);
        }

        if (subcommand === 'category-list') {
            return handleCategoryList(interaction, client);
        }

        if (subcommand === 'category-remove') {
            return handleCategoryRemove(interaction, client);
        }

        if (subcommand === 'setup') {
            return handleSetup(interaction, client);
        }
    },
};

async function handleCategoryAdd(interaction, client) {
    const nombre = interaction.options.getString('nombre');
    const descripcion =
        interaction.options.getString('descripcion') || `Abrir ticket de ${nombre}`;
    const emoji = interaction.options.getString('emoji') || '🎫';
    const catDiscord = interaction.options.getChannel('categoria_discord');

    const config = await getGuildConfig(client, interaction.guildId);
    const categories = Array.isArray(config.ticketCategories) ? [...config.ticketCategories] : [];

    if (categories.length >= 25) {
        return await replyUserError(interaction, {
            type: ErrorTypes.VALIDATION,
            message: 'Máximo 25 categorías en el menú.',
        });
    }

    const id = `cat_${Date.now()}`;
    categories.push({
        id,
        name: nombre,
        description: descripcion,
        emoji,
        discordCategoryId: catDiscord.id,
    });

    config.ticketCategories = categories;
    await setGuildConfig(client, interaction.guildId, config);

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [
            successEmbed(
                'Categoría añadida',
                [
                    `**${emoji} ${nombre}**`,
                    `ID: \`${id}\``,
                    `Tickets se abrirán en: **${catDiscord.name}**`,
                    '',
                    'Vuelve a ejecutar `/ticket setup` para actualizar el panel con el menú.',
                ].join('\n'),
            ),
        ],
    });
}

async function handleCategoryList(interaction, client) {
    const config = await getGuildConfig(client, interaction.guildId);
    const categories = config.ticketCategories || [];

    if (categories.length === 0) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    'Categorías de tickets',
                    'No hay categorías. Añade una con `/ticket category-add`.',
                ),
            ],
        });
    }

    const lines = categories.map(
        (c, i) =>
            `**${i + 1}.** ${c.emoji || '🎫'} **${c.name}**\nID: \`${c.id}\` · Discord: <#${c.discordCategoryId}>`,
    );

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [
            createEmbed({
                title: 'Categorías de tickets',
                description: lines.join('\n\n'),
                color: 0x000000,
            }),
        ],
    });
}

async function handleCategoryRemove(interaction, client) {
    const id = interaction.options.getString('id');
    const config = await getGuildConfig(client, interaction.guildId);
    const categories = Array.isArray(config.ticketCategories) ? [...config.ticketCategories] : [];
    const before = categories.length;
    config.ticketCategories = categories.filter((c) => c.id !== id);

    if (config.ticketCategories.length === before) {
        return await replyUserError(interaction, {
            type: ErrorTypes.VALIDATION,
            message: `No se encontró la categoría \`${id}\`. Usa \`/ticket category-list\`.`,
        });
    }

    await setGuildConfig(client, interaction.guildId, config);

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [
            successEmbed(
                'Categoría eliminada',
                `Se eliminó \`${id}\`.\nVuelve a hacer \`/ticket setup\` para actualizar el panel.`,
            ),
        ],
    });
}

async function handleSetup(interaction, client) {
    const existingConfig = await getGuildConfig(client, interaction.guildId);

    // Si ya hay panel, permitimos actualizar (no bloqueamos)
    const panelChannel = interaction.options.getChannel('panel_channel');
    const categoryChannel = interaction.options.getChannel('category');
    const closedCategoryChannel = interaction.options.getChannel('closed_category');
    const staffRole = interaction.options.getRole('staff_role');
    const panelMessage =
        interaction.options.getString('panel_message') ||
        'Selecciona una categoría para crear un ticket.';
    const panelTitle = interaction.options.getString('titulo') || 'Sistema de tickets';
    const imageUrl = interaction.options.getString('imagen') || null;
    const buttonLabel = interaction.options.getString('button_label') || 'Create Ticket';
    const maxTicketsPerUser = interaction.options.getInteger('max_tickets_per_user') || 3;
    const dmOnClose = interaction.options.getBoolean('dm_on_close') !== false;

    const ticketCategories = Array.isArray(existingConfig?.ticketCategories)
        ? existingConfig.ticketCategories
        : [];

    const setupEmbed = createEmbed({
        title: panelTitle,
        description: panelMessage,
        color: 0x000000,
        image: imageUrl || undefined,
    });

    let components;
    if (ticketCategories.length > 0) {
        const select = new StringSelectMenuBuilder()
            .setCustomId('ticket_category_select')
            .setPlaceholder('Seleccione una categoría')
            .addOptions(
                ticketCategories.slice(0, 25).map((cat) => {
                    const opt = new StringSelectMenuOptionBuilder()
                        .setLabel(String(cat.name).substring(0, 100))
                        .setDescription(String(cat.description || 'Abrir ticket').substring(0, 100))
                        .setValue(String(cat.id));
                    if (cat.emoji) {
                        try {
                            opt.setEmoji(cat.emoji);
                        } catch {
                            // emojiAquí tienes el `ticket.js` **completo** con imagen, menú de categorías y `category-add`:

```js
import { getColor } from '../../config/bot.js';
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
} from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../services/config/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import ticketConfig from './modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription("Manages the server's ticket system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Sets up the ticket creation panel in a specified channel.')
                .addChannelOption((option) =>
                    option
                        .setName('panel_channel')
                        .setDescription('The channel where the ticket panel will be sent.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('panel_message')
                        .setDescription('The main message/description for the ticket panel.')
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('titulo')
                        .setDescription('Título del panel (ej: Sistema de tickets)')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('imagen')
                        .setDescription('URL de la imagen del panel de tickets')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('button_label')
                        .setDescription('Label del botón si no hay categorías (default: Create Ticket)')
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName('category')
                        .setDescription('Categoría por defecto si no usas menú de categorías.')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName('closed_category')
                        .setDescription('Categoría donde se mueven tickets cerrados (opcional).')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addRoleOption((option) =>
                    option
                        .setName('staff_role')
                        .setDescription('Rol de staff con acceso a tickets (opcional).')
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('max_tickets_per_user')
                        .setDescription('Máximo de tickets por usuario (default: 3)')
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('dm_on_close')
                        .setDescription('Enviar DM al cerrar el ticket (default: true)')
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('category-add')
                .setDescription('Añade una categoría al menú de tickets')
                .addStringOption((option) =>
                    option
                        .setName('nombre')
                        .setDescription('Nombre (ej: Soporte, Apelación)')
                        .setRequired(true),
                )
                .addChannelOption((option) =>
                    option
                        .setName('categoria_discord')
                        .setDescription('Categoría de Discord donde se abren estos tickets')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('descripcion')
                        .setDescription('Texto que sale en el menú')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('emoji')
                        .setDescription('Emoji (ej: 🛠️)')
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('category-list')
                .setDescription('Lista las categorías del menú de tickets'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('category-remove')
                .setDescription('Elimina una categoría del menú')
                .addStringOption((option) =>
                    option
                        .setName('id')
                        .setDescription('ID de la categoría (mira /ticket category-list)')
                        .setRequired(true),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Open the interactive ticket system dashboard'),
        ),

    category: 'ticket',

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferred) return;

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: 'You need the `Manage Channels` permission for this action.',
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'dashboard') {
            return ticketConfig.execute(interaction, config, client);
        }

        if (subcommand === 'category-add') {
            return handleCategoryAdd(interaction, client);
        }

        if (subcommand === 'category-list') {
            return handleCategoryList(interaction, client);
        }

        if (subcommand === 'category-remove') {
            return handleCategoryRemove(interaction, client);
        }

        if (subcommand === 'setup') {
            return handleSetup(interaction, client);
        }
    },
};

async function handleCategoryAdd(interaction, client) {
    const nombre = interaction.options.getString('nombre');
    const descripcion =
        interaction.options.getString('descripcion') || `Abrir ticket de ${nombre}`;
    const emoji = interaction.options.getString('emoji') || '🎫';
    const catDiscord = interaction.options.getChannel('categoria_discord');

    const config = await getGuildConfig(client, interaction.guildId);
    const categories = Array.isArray(config.ticketCategories) ? [...config.ticketCategories] : [];

    if (categories.length >= 25) {
        return await replyUserError(interaction, {
            type: ErrorTypes.VALIDATION,
            message: 'Máximo 25 categorías en el menú.',
        });
    }

    const id = `cat_${Date.now()}`;
    categories.push({
        id,
        name: nombre,
        description: descripcion,
        emoji,
        discordCategoryId: catDiscord.id,
    });

    config.ticketCategories = categories;
    await setGuildConfig(client, interaction.guildId, config);

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [
            successEmbed(
                'Categoría añadida',
                [
                    `**${emoji} ${nombre}**`,
                    `ID: \`${id}\``,
                    `Tickets se abrirán en: **${catDiscord.name}**`,
                    '',
                    'Vuelve a ejecutar `/ticket setup` para actualizar el panel con el menú.',
                ].join('\n'),
            ),
        ],
    });
}

async function handleCategoryList(interaction, client) {
    const config = await getGuildConfig(client, interaction.guildId);
    const categories = config.ticketCategories || [];

    if (categories.length === 0) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    'Categorías de tickets',
                    'No hay categorías. Añade una con `/ticket category-add`.',
                ),
            ],
        });
    }

    const lines = categories.map(
        (c, i) =>
            `**${i + 1}.** ${c.emoji || '🎫'} **${c.name}**\nID: \`${c.id}\` · Discord: <#${c.discordCategoryId}>`,
    );

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [
            createEmbed({
                title: 'Categorías de tickets',
                description: lines.join('\n\n'),
                color: 0x000000,
            }),
        ],
    });
}

async function handleCategoryRemove(interaction, client) {
    const id = interaction.options.getString('id');
    const config = await getGuildConfig(client, interaction.guildId);
    const categories = Array.isArray(config.ticketCategories) ? [...config.ticketCategories] : [];
    const before = categories.length;
    config.ticketCategories = categories.filter((c) => c.id !== id);

    if (config.ticketCategories.length === before) {
        return await replyUserError(interaction, {
            type: ErrorTypes.VALIDATION,
            message: `No se encontró la categoría \`${id}\`. Usa \`/ticket category-list\`.`,
        });
    }

    await setGuildConfig(client, interaction.guildId, config);

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [
            successEmbed(
                'Categoría eliminada',
                `Se eliminó \`${id}\`.\nVuelve a hacer \`/ticket setup\` para actualizar el panel.`,
            ),
        ],
    });
}

async function handleSetup(interaction, client) {
    const existingConfig = await getGuildConfig(client, interaction.guildId);

    // Si ya hay panel, permitimos actualizar (no bloqueamos)
    const panelChannel = interaction.options.getChannel('panel_channel');
    const categoryChannel = interaction.options.getChannel('category');
    const closedCategoryChannel = interaction.options.getChannel('closed_category');
    const staffRole = interaction.options.getRole('staff_role');
    const panelMessage =
        interaction.options.getString('panel_message') ||
        'Selecciona una categoría para crear un ticket.';
    const panelTitle = interaction.options.getString('titulo') || 'Sistema de tickets';
    const imageUrl = interaction.options.getString('imagen') || null;
    const buttonLabel = interaction.options.getString('button_label') || 'Create Ticket';
    const maxTicketsPerUser = interaction.options.getInteger('max_tickets_per_user') || 3;
    const dmOnClose = interaction.options.getBoolean('dm_on_close') !== false;

    const ticketCategories = Array.isArray(existingConfig?.ticketCategories)
        ? existingConfig.ticketCategories
        : [];

    const setupEmbed = createEmbed({
        title: panelTitle,
        description: panelMessage,
        color: 0x000000,
        image: imageUrl || undefined,
    });

    let components;
    if (ticketCategories.length > 0) {
        const select = new StringSelectMenuBuilder()
            .setCustomId('ticket_category_select')
            .setPlaceholder('Seleccione una categoría')
            .addOptions(
                ticketCategories.slice(0, 25).map((cat) => {
                    const opt = new StringSelectMenuOptionBuilder()
                        .setLabel(String(cat.name).substring(0, 100))
                        .setDescription(String(cat.description || 'Abrir ticket').substring(0, 100))
                        .setValue(String(cat.id));
                    if (cat.emoji) {
                        try {
                            opt.setEmoji(cat.emoji);
                        } catch {
                            // emoji inválido, ignorar
                        }
                    }
                    return opt;
                }),
            );
        components = [new ActionRowBuilder().addComponents(select)];
    } else {
        components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel(buttonLabel)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📩'),
            ),
        ];
    }

    try {
        const sentPanel = await panelChannel.send({
            embeds: [setupEmbed],
            components,
        });

        if (client.db && interaction.guildId) {
            const currentConfig = existingConfig || {};
            currentConfig.ticketCategoryId = categoryChannel ? categoryChannel.id : null;
            currentConfig.ticketClosedCategoryId = closedCategoryChannel
                ? closedCategoryChannel.id
                : null;
            currentConfig.ticketStaffRoleId = staffRole ? staffRole.id : null;
            currentConfig.ticketPanelChannelId = panelChannel.id;
            currentConfig.ticketPanelMessageId = sentPanel?.id || null;
            currentConfig.ticketPanelMessage = panelMessage;
            currentConfig.ticketPanelTitle = panelTitle;
            currentConfig.ticketPanelImage = imageUrl;
            currentConfig.ticketButtonLabel = buttonLabel;
            currentConfig.maxTicketsPerUser = maxTicketsPerUser;
            currentConfig.dmOnClose = dmOnClose;
            currentConfig.ticketCategories = ticketCategories;
            await setGuildConfig(client, interaction.guildId, currentConfig);
        }

        const mode =
            ticketCategories.length > 0
                ? `Menú con **${ticketCategories.length}** categoría(s)`
                : `Botón **${buttonLabel}** (sin categorías aún)`;

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    'Ticket Panel Set Up',
                    [
                        `Panel enviado a ${panelChannel}`,
                        `Modo: ${mode}`,
                        categoryChannel
                            ? `Categoría por defecto: **${categoryChannel.name}**`
                            : 'Categoría por defecto: automática',
                        staffRole ? `Staff: **${staffRole.name}**` : null,
                        `Imagen: ${imageUrl || 'Ninguna'}`,
                        '',
                        ticketCategories.length === 0
                            ? 'Añade categorías con `/ticket category-add` y vuelve a hacer setup.'
                            : 'Los usuarios eligen categoría en el menú del panel.',
                    ]
                        .filter(Boolean)
                        .join('\n'),
                ),
            ],
        });
    } catch (error) {
        logger.error('Ticket setup error', {
            error: error.message,
            stack: error.stack,
            guildId: interaction.guildId,
        });
        await replyUserError(interaction, {
            type: ErrorTypes.UNKNOWN,
            message:
                'No se pudo enviar el panel. Revisa permisos del bot en el canal (Enviar mensajes, Insertar enlaces).',
        });
    }
}
