const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const CrateConfig = require('../../models/CrateConfig');

const crateInfo = {
  small: {
    label: 'Small Crate',
    description: 'Easy drop with a small XP reward.',
    color: 0x57f287,
  },
  medium: {
    label: 'Medium Crate',
    description: 'Medium drop with a nice XP reward.',
    color: 0xf1c40f,
  },
  large: {
    label: 'Large Crate',
    description: 'Big drop with a large XP reward.',
    color: 0xe91e63,
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dropcrate')
    .setDescription('Send a crate drop to the configured drop channel')
    .addStringOption((option) =>
      option
        .setName('size')
        .setDescription('Choose the crate size')
        .setRequired(true)
        .addChoices(
          { name: 'Small', value: 'small' },
          { name: 'Medium', value: 'medium' },
          { name: 'Large', value: 'large' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('note')
        .setDescription('Optional message to show with the crate')
    ),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: 'You need Administrator permission to drop crates.',
        ephemeral: true,
      });
    }

    const size = interaction.options.getString('size');
    const note = interaction.options.getString('note') || '';
    const config = await CrateConfig.findOne({ guildId: interaction.guild.id });

    if (!config || !config.enabled) {
      return interaction.reply({
        content: 'Crate drops are currently disabled. Enable them with `/togglecrate on`.',
        ephemeral: true,
      });
    }

    if (!config.dropChannelId) {
      return interaction.reply({
        content: 'Please set a crate drop channel first with `/setdropchannel`.',
        ephemeral: true,
      });
    }

    const channel = interaction.guild.channels.cache.get(config.dropChannelId);
    if (!channel) {
      return interaction.reply({
        content: 'The configured drop channel is not accessible. Please update it with `/setdropchannel`.',
        ephemeral: true,
      });
    }

    const crate = crateInfo[size] || crateInfo.small;
    const claimLimit = Math.max(
      1,
      config.claimLimits?.[size] ?? { small: 3, medium: 2, large: 1 }[size]
    );

    if (!interaction.client.activeCrateMessages) {
      interaction.client.activeCrateMessages = new Map();
    }

    const embed = new EmbedBuilder()
      .setTitle(`${crate.label} Dropped!`)
      .setDescription(`${crate.description}\n${note}\n\nThis crate can be claimed by up to **${claimLimit}** users.`)
      .addFields({
        name: 'Claim Reward',
        value: `Click the button below to claim a ${crate.label} and earn XP.`,
      })
      .setColor(crate.color);

    const button = new ButtonBuilder()
      .setCustomId(`claimcrate_${size}`)
      .setLabel('Claim Crate')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const message = await channel.send({ embeds: [embed], components: [row] });
    interaction.client.activeCrateMessages.set(message.id, {
      size,
      maxClaims: claimLimit,
      claimedBy: new Set(),
    });
    await interaction.reply({ content: `Dropped a ${crate.label} in ${channel}.`, ephemeral: true });

    const expiryMinutes = Math.max(1, config.claimExpiryMinutes ?? 5);
    setTimeout(async () => {
      try {
        const current = await message.fetch();
        const crateState = interaction.client.activeCrateMessages.get(message.id);
        if (crateState && crateState.claimedBy.size > 0) {
          const claimers = [...crateState.claimedBy].map(id => `<@${id}>`).join(', ');
          await current.channel.send(`⏰ This crate has expired! Claimed by: ${claimers}`);
        }
        await current.delete();
      } catch (error) {
        if (error.code !== 10008) {
          console.error('Failed to delete expired crate message:', error);
        }
      } finally {
        interaction.client.activeCrateMessages.delete(message.id);
      }
    }, expiryMinutes * 60_000);
  },
};
