const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ServerShop = require('../../models/ServerShop');
const EksosCoin = require('../../models/EksosCoin');
const BotShopConfig = require('../../models/BotShopConfig');

const NOTE_BOOST = 10000;

const WALLET_PROTECTION = [
  { name: '🛡️ Wallet Shield (1 Day)', duration: 1 * 24 * 60 * 60 * 1000, price: 10000 },
  { name: '🛡️ Wallet Shield (3 Days)', duration: 3 * 24 * 60 * 60 * 1000, price: 25000 },
  { name: '🛡️ Wallet Shield (7 Days)', duration: 7 * 24 * 60 * 60 * 1000, price: 35000 },
  { name: '🛡️ Wallet Shield (30 Days)', duration: 30 * 24 * 60 * 60 * 1000, price: 150000 },
];

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

    let shopData = await ServerShop.findOne({ guildId: interaction.guild.id });
    if (!shopData) {
      shopData = await ServerShop.create({ guildId: interaction.guild.id });
    }

    const fields = [];

    if (shopData.enabled && shopData.items.length > 0) {
      const enabledItems = shopData.items.filter((item) => item.enabled);
      const typeEmojis = { role: '🏷️', xp_boost: '⚡', custom: '🎁' };

      for (const item of enabledItems) {
        const emoji = typeEmojis[item.type] || '📦';
        const stockText = item.stock === -1 ? 'Unlimited' : `${item.stock} left`;
        let typeDetail = '';
        if (item.type === 'role') typeDetail = '\n> Grants a role';
        if (item.type === 'xp_boost') typeDetail = `\n> ${item.xpMultiplier}x XP boost`;
        if (item.type === 'custom') typeDetail = '\n> Special item';

        fields.push({
          name: `${emoji} ${item.name}`,
          value: `**${item.price.toLocaleString()} eksoscoin**\n${item.description || 'No description.'}${typeDetail}\n> Stock: ${stockText} | Sold: ${item.purchaseCount}`,
          inline: true,
        });
      }
    }

    const userData = await EksosCoin.findOne({ userId: interaction.user.id }) ||
      await EksosCoin.create({ userId: interaction.user.id });

    let botShopConfig = await BotShopConfig.findOne({ _id: 'global' });
    if (!botShopConfig) botShopConfig = await BotShopConfig.create({ _id: 'global' });
    const bankNotePrice = botShopConfig.bankNotePrice || 10000;
    const nextLimit = (userData.bankNotesUsed + 1) * NOTE_BOOST + 10000;

    fields.push({
      name: '📗 Bank Note',
      value: `**${bankNotePrice.toLocaleString()} eksoscoin**\nIncrease your bank limit by **${NOTE_BOOST.toLocaleString()}**\n> Your limit: ${userData.bankLimit.toLocaleString()} → ${nextLimit.toLocaleString()}\n> Notes bought: ${userData.bankNotesUsed}`,
      inline: true,
    });

    const now = Date.now();
    for (const wp of WALLET_PROTECTION) {
      const remaining = userData.walletProtectedUntil && userData.walletProtectedUntil.getTime() > now
        ? Math.ceil((userData.walletProtectedUntil.getTime() - now) / 3600000)
        : 0;
      const status = remaining > 0 ? `\n> 🟢 Active (${remaining}h remaining)` : '';
      fields.push({
        name: wp.name,
        value: `**${wp.price.toLocaleString()} eksoscoin**\nProtects your wallet from /rob for ${wp.duration / 86400000} day(s).${status}`,
        inline: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle(`${interaction.guild.name} Shop`)
      .setDescription('Use `/buy <item>` to purchase an item.')
      .addFields(fields)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
