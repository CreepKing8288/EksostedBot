const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');
const ServerShop = require('../../models/ServerShop');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item from the server\'s EksosCoin shop.')
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('The name of the item to buy.')
        .setRequired(true)
        .setAutocomplete(true)
    ),

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

    const itemName = interaction.options.getString('item');
    const userId = interaction.user.id;

    const shopData = await ServerShop.findOne({ guildId: interaction.guild.id });
    if (!shopData || !shopData.enabled) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Shop Disabled')
            .setDescription('The shop is not enabled in this server.'),
        ],
        ephemeral: true,
      });
    }

    const item = shopData.items.find(
      (i) => i.name.toLowerCase() === itemName.toLowerCase() && i.enabled
    );

    if (!item) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Item Not Found')
            .setDescription(`No enabled item named **${itemName}** found in the shop.`),
        ],
        ephemeral: true,
      });
    }

    if (item.stock === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Out of Stock')
            .setDescription(`**${item.name}** is out of stock!`),
        ],
        ephemeral: true,
      });
    }

    let userData = await EksosCoin.findOne({ userId });
    if (!userData) {
      userData = await EksosCoin.create({ userId });
    }

    if (userData.balance < item.price) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Insufficient Funds')
            .setDescription(
              `You need **${item.price.toLocaleString()} eksoscoin** but only have **${userData.balance.toLocaleString()}**.`
            ),
        ],
        ephemeral: true,
      });
    }

    userData.balance -= item.price;
    userData.totalSpent += item.price;
    userData.inventory.push({
      itemId: item.itemId,
      name: item.name,
      quantity: 1,
    });
    await userData.save();

    if (item.stock > 0) {
      item.stock -= 1;
    }
    item.purchaseCount += 1;
    await shopData.save();

    if (item.type === 'role' && item.roleId) {
      try {
        const member = await interaction.guild.members.fetch(userId);
        const role = await interaction.guild.roles.fetch(item.roleId);
        if (role) {
          await member.roles.add(role);
        }
      } catch {
        // Role may not be assignable
      }
    }

    let confirmationText = `You purchased **${item.name}** for **${item.price.toLocaleString()} eksoscoin**!`;
    if (item.type === 'role' && item.roleId) {
      confirmationText += '\nYour role has been assigned!';
    } else if (item.type === 'xp_boost') {
      confirmationText += `\nYou now have a **${item.xpMultiplier}x XP boost**!`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Purchase Successful!')
      .setDescription(confirmationText)
      .addFields(
        { name: 'Remaining Balance', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const shopData = await ServerShop.findOne({ guildId: interaction.guild?.id });
    if (!shopData) return interaction.respond([]);

    const items = shopData.items
      .filter((i) => i.enabled && i.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((i) => ({ name: `${i.name} - ${i.price} eksoscoin`, value: i.name }));

    await interaction.respond(items);
  },
};
