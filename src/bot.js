import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getPrices, getRequests, saveRequests, setPrices } from './storage.js';
import { validateDateRange } from './domain.js';

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  ownerRoleIds: (process.env.CO_OWNER_ROLE_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean),
  staffRoleId: process.env.STAFF_ROLE_ID,
  loaChannelId: process.env.LOA_CHANNEL_ID,
  loaRoleId: process.env.LOA_ROLE_ID,
};

if (!config.token || !config.clientId) {
  throw new Error('Set DISCORD_TOKEN and DISCORD_CLIENT_ID before starting the bot.');
}

const client = new Client({ intents: ['Guilds', 'GuildMembers'] });
const privateReply = (content) => ({ content, ephemeral: true });

async function fetchMember(interaction) {
  return interaction.guild.members.fetch(interaction.user.id);
}

function isAdministrator(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isOwnerOrAdministrator(member) {
  return isAdministrator(member) || config.ownerRoleIds.some((id) => member.roles.cache.has(id));
}

function hasStaffRole(member) {
  return Boolean(config.staffRoleId && member.roles.cache.has(config.staffRoleId));
}

function requestEmbed(request) {
  const statusText = {
    pending: 'Pending review',
    processing: 'Decision in progress',
    approved: `Approved by <@${request.decidedBy}>`,
    denied: `Denied by <@${request.decidedBy}>`,
    completed: `Approved by <@${request.decidedBy}> (leave ended)`,
  }[request.status];

  return new EmbedBuilder()
    .setColor(request.status === 'approved' || request.status === 'completed' ? 0x57a773 : request.status === 'denied' ? 0xc75050 : 0xe5ad45)
    .setDescription([
      '⑅    ˘    ♡    .',
      '︵ <:WhiteBow:1545210685997326336>     ︵ <:PurinHeart:1545207756720439308>     ︵ <:WhiteBow:1545210685997326336>  ︵',
      '',
      '(✿ᴗ͈ᴗ͈)   ┊   ˙ <:WhiteBow:1545210685997326336>     **LOA Request!!**',
      '',
      `> **Staff Member:** <@${request.userId}>`,
      `> **Start Date:** ${request.startDate}`,
      `> **End Date:** ${request.endDate}`,
      `> **Reason:** ${request.reason}`,
      `> **Notes:** ${request.notes || 'None'}`,
      `> **Status:** ${statusText}`,
      '',
      '_ _',
      '_ _︶ <:WhiteBow:1545210685997326336>  ︶ <:PurinHeart:1545207756720439308>  ︶ <:WhiteBow:1545210685997326336>  ︶',
      '_ _    ⑅    ˘    ♡    .',
    ].join('\n'))
    .setImage('https://cdn.discordapp.com/attachments/1065594561679863899/1067509068622737449/ezgif.com-gif-maker_89.gif?ex=6a8f2e4b&is=6a8ddccb&hm=ed941d334a83cb89ed60ffa0edda80e9f1e7d9ed24f9053104ceb98f1b19a762')
    .setTimestamp(new Date(request.createdAt));
}

function decisionButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('loa:accept').setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId('loa:deny').setLabel('Deny').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

async function showLoaModal(interaction) {
  const member = await fetchMember(interaction);
  if (!hasStaffRole(member)) return interaction.reply(privateReply('This command is available to staff members only.'));

  const modal = new ModalBuilder().setCustomId('loa:submit').setTitle('Leave of Absence Request');
  const fields = [
    new TextInputBuilder().setCustomId('reason').setLabel('Reason').setPlaceholder('Exams, vacation, personal, etc.').setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(true),
    new TextInputBuilder().setCustomId('startDate').setLabel('Start Date (YYYY-MM-DD)').setPlaceholder('2026-10-20').setStyle(TextInputStyle.Short).setMaxLength(10).setRequired(true),
    new TextInputBuilder().setCustomId('endDate').setLabel('End Date (YYYY-MM-DD)').setPlaceholder('2026-10-27').setStyle(TextInputStyle.Short).setMaxLength(10).setRequired(true),
    new TextInputBuilder().setCustomId('notes').setLabel('Additional Notes (Optional)').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false),
  ];
  modal.addComponents(...fields.map((field) => new ActionRowBuilder().addComponents(field)));
  return interaction.showModal(modal);
}

async function submitLoa(interaction) {
  const member = await fetchMember(interaction);
  if (!hasStaffRole(member)) return interaction.reply(privateReply('This command is available to staff members only.'));
  if (!config.loaChannelId || !config.loaRoleId) {
    return interaction.reply(privateReply('LOA is not configured. Ask an administrator to set LOA_CHANNEL_ID and LOA_ROLE_ID.'));
  }

  let dates;
  try {
    dates = validateDateRange(interaction.fields.getTextInputValue('startDate').trim(), interaction.fields.getTextInputValue('endDate').trim());
  } catch (error) {
    return interaction.reply(privateReply(error.message));
  }

  const channel = await client.channels.fetch(config.loaChannelId);
  if (!channel?.isTextBased() || !channel.guild) {
    return interaction.reply(privateReply('The configured LOA request channel is unavailable.'));
  }

  const request = {
    userId: interaction.user.id,
    guildId: channel.guild.id,
    reason: interaction.fields.getTextInputValue('reason').trim(),
    startDate: dates.startDate,
    endDate: dates.endDate,
    expiresAt: dates.expiresAt,
    notes: interaction.fields.getTextInputValue('notes').trim(),
    status: 'pending',
    createdAt: Date.now(),
  };
  const message = await channel.send({ embeds: [requestEmbed(request)], components: [decisionButtons()] });
  const requests = getRequests();
  requests[message.id] = request;
  saveRequests(requests);
  return interaction.reply(privateReply('Your leave request has been sent for review.'));
}

async function handleDecision(interaction) {
  const member = await fetchMember(interaction);
  if (!isOwnerOrAdministrator(member)) {
    return interaction.reply(privateReply('Only Co-Owners+ or administrators can review leave requests.'));
  }

  const requests = getRequests();
  const request = requests[interaction.message.id];
  if (!request || request.status !== 'pending') {
    return interaction.reply(privateReply('This request has already been handled or is unavailable.'));
  }

  const accepted = interaction.customId === 'loa:accept';
  request.status = 'processing';
  saveRequests(requests);

  try {
    if (accepted) {
      if (!config.loaRoleId) throw new Error('LOA_ROLE_ID is not configured.');
      const staffMember = await interaction.guild.members.fetch(request.userId);
      await staffMember.roles.add(config.loaRoleId, 'Approved leave of absence');
    }

    request.status = accepted ? 'approved' : 'denied';
    request.decidedBy = interaction.user.id;
    request.decidedAt = Date.now();
    saveRequests(requests);
    await interaction.update({ embeds: [requestEmbed(request)], components: [decisionButtons(true)] });

    try {
      const staffUser = await client.users.fetch(request.userId);
      await staffUser.send(`Your leave request from ${request.startDate} to ${request.endDate} was ${accepted ? 'approved' : 'denied'} by ${interaction.user.tag}.`);
    } catch {
      await interaction.followUp(privateReply('The request was processed, but the staff member could not be reached by DM.'));
      return;
    }
    await interaction.followUp(privateReply(`Request ${accepted ? 'approved' : 'denied'}; the staff member was notified.`));
  } catch (error) {
    request.status = 'pending';
    delete request.decidedBy;
    delete request.decidedAt;
    saveRequests(requests);
    console.error('Could not process LOA decision:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(privateReply('The request could not be processed. Check the bot role and LOA role configuration.'));
    } else {
      await interaction.reply(privateReply('The request could not be processed. Check the bot role and LOA role configuration.'));
    }
  }
}

async function expireLoas() {
  const requests = getRequests();
  const now = Date.now();
  const expired = Object.entries(requests).filter(([, request]) => request.status === 'approved' && request.expiresAt <= now);
  if (!expired.length) return;

  const groups = new Map();
  for (const [messageId, request] of expired) {
    const key = `${request.guildId}:${request.userId}`;
    if (!groups.has(key)) groups.set(key, { guildId: request.guildId, userId: request.userId, messageIds: [] });
    groups.get(key).messageIds.push(messageId);
  }

  for (const group of groups.values()) {
    const hasCurrentLeave = Object.values(requests).some((request) => request.guildId === group.guildId
      && request.userId === group.userId && request.status === 'approved' && request.expiresAt > now);
    if (!hasCurrentLeave && config.loaRoleId) {
      try {
        const guild = await client.guilds.fetch(group.guildId);
        const member = await guild.members.fetch(group.userId);
        await member.roles.remove(config.loaRoleId, 'Leave of absence ended');
      } catch (error) {
        if (error.code !== 10007) {
          console.error(`Could not remove expired LOA role for ${group.userId}:`, error);
          continue;
        }
      }
    }
    for (const messageId of group.messageIds) requests[messageId].status = 'completed';
  }
  saveRequests(requests);
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'prices') {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf2a7bb).setTitle('Chef Order Menu & Pricing').setDescription(getPrices())] });
      }
      if (interaction.commandName === 'setprices') {
        const member = await fetchMember(interaction);
        if (!isOwnerOrAdministrator(member)) return interaction.reply(privateReply('Only Co-Owners+ or administrators can update prices.'));
        const currentPrices = getPrices();
        if (currentPrices.length > 4000) return interaction.reply(privateReply('The current menu is too long to edit in a modal.'));
        const input = new TextInputBuilder().setCustomId('priceText').setLabel('Menu and prices').setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(true).setValue(currentPrices);
        const modal = new ModalBuilder().setCustomId('prices:save').setTitle('Edit Chef Order Prices').addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      if (interaction.commandName === 'loa') return await showLoaModal(interaction);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'prices:save') {
      const member = await fetchMember(interaction);
      if (!isOwnerOrAdministrator(member)) return interaction.reply(privateReply('Only Co-Owners+ or administrators can update prices.'));
      const text = interaction.fields.getTextInputValue('priceText').trim();
      if (!text) return interaction.reply(privateReply('The menu cannot be empty.'));
      setPrices(text);
      return interaction.reply(privateReply('Chef Order prices have been updated.'));
    }

    if (interaction.isModalSubmit() && interaction.customId === 'loa:submit') return await submitLoa(interaction);
    if (interaction.isButton() && ['loa:accept', 'loa:deny'].includes(interaction.customId)) return await handleDecision(interaction);
  } catch (error) {
    console.error('Interaction failed:', error);
    const response = privateReply('Something went wrong while processing that interaction.');
    if (interaction.deferred || interaction.replied) await interaction.followUp(response);
    else await interaction.reply(response);
  }
});

client.once(Events.ClientReady, () => {
  console.log(`Ready as ${client.user.tag}`);
  void expireLoas();
  setInterval(() => void expireLoas(), 60_000);
});

await client.login(config.token);