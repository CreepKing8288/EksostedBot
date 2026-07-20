const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ServerShop = require('../../models/ServerShop');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View this server\'s EksosCoin shop.'),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Server Only')
            .setDescription('This command can only be used in a server.'),
        ],
        ephemeral: true,
      });
    }

    const shopData = await ServerShop.findOne({ guildId: interaction.guild.id });

    if (!shopData || !shopData.enabled || shopData.items.length === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle('Shop Empty')
            .setDescription('This server doesn\'t have a shop yet! Ask an admin to set one up.'),
        ],
        ephemeral: true,
      });
    }

    const enabledItems = shopData.items.filter((item) => item.enabled);

    if (enabledItems.length === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle('Shop Empty')
            .setDescription('No items available in the shop right now.'),
        ],
        ephemeral: true,
      });
    }

    const typeEmojis = {
      role: '🏷️',
      xp_boost: '⚡',
      custom: '🎁',
    };

    const fields = enabledItems.map((item, index) => {
      const emoji = typeEmojis[item.type] || '📦';
      const stockText = item.stock === -1 ? 'Unlimited' : `${item.stock} left`;
      let typeDetail = '';
      if (item.type === 'role') typeDetail = '\n> Grants a role';
      if (item.type === 'xp_boost') typeDetail = `\n> ${item.xpMultiplier}x XP boost`;
      if (item.type === 'custom') typeDetail = '\n> Special item';

      return {
        name: `${emoji} ${item.name}`,
        value: `**${item.price.toLocaleString()} eksoscoin**\n${item.description || 'No description.'}${typeDetail}\n> Stock: ${stockText} | Sold: ${item.purchaseCount}`,
        inline: true,
      };
    });

    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle(`${interaction.guild.name} Shop`)
      .setDescription('Use `/buy <item>` to purchase an item.')
      .addFields(fields)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
