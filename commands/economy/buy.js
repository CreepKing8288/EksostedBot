const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');
const ServerShop = require('../../models/ServerShop');
const BotShopConfig = require('../../models/BotShopConfig');

const NOTE_BOOST = 10000;

const WALLET_PROTECTION = [
  { match: 'wallet shield (1 day)', duration: 1 * 24 * 60 * 60 * 1000, priceKey: 'walletShield1dPrice', defaultPrice: 10000, label: '1 Day' },
  { match: 'wallet shield (3 days)', duration: 3 * 24 * 60 * 60 * 1000, priceKey: 'walletShield3dPrice', defaultPrice: 25000, label: '3 Days' },
  { match: 'wallet shield (7 days)', duration: 7 * 24 * 60 * 60 * 1000, priceKey: 'walletShield7dPrice', defaultPrice: 35000, label: '7 Days' },
];

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

    const itemName = interaction.options.getString('item').toLowerCase();
    const userId = interaction.user.id;

    let userData = await EksosCoin.findOne({ userId });
    if (!userData) {
      userData = await EksosCoin.create({ userId });
    }

    // Bank Note
    if (itemName === 'bank note') {
      let botShopConfig = await BotShopConfig.findOne({ _id: 'global' });
      if (!botShopConfig) botShopConfig = await BotShopConfig.create({ _id: 'global' });
      const price = botShopConfig.bankNotePrice || 10000;

      if (userData.balance < price) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Insufficient Funds')
              .setDescription(
                `You need **${price.toLocaleString()} eksoscoin** but only have **${userData.balance.toLocaleString()}**.`
              ),
          ],
          ephemeral: true,
        });
      }

      userData.balance -= price;
      userData.totalSpent += price;

      const existing = userData.inventory.find((i) => i.itemId === 'bank_note');
      if (existing) {
        existing.quantity += 1;
      } else {
        userData.inventory.push({ itemId: 'bank_note', name: 'Bank Note', quantity: 1 });
      }
      await userData.save();

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Bank Note Purchased!')
        .setDescription(`You bought a **Bank Note** for **${price.toLocaleString()} eksoscoin**!`)
        .addFields(
          { name: 'Remaining in Inventory', value: `${userData.inventory.find((i) => i.itemId === 'bank_note')?.quantity || 0}`, inline: true },
          { name: 'Remaining Balance', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true }
        )
        .setFooter({ text: 'Use /inventory use item:Bank Note to activate it.' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // Wallet Protection items
    const wpMatch = WALLET_PROTECTION.find((wp) => itemName === wp.match);
    if (wpMatch) {
      let botShopConfig = await BotShopConfig.findOne({ _id: 'global' });
      if (!botShopConfig) botShopConfig = await BotShopConfig.create({ _id: 'global' });
      const price = botShopConfig[wpMatch.priceKey] || wpMatch.defaultPrice;

      if (userData.balance < price) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Insufficient Funds')
              .setDescription(
                `You need **${price.toLocaleString()} eksoscoin** but only have **${userData.balance.toLocaleString()}**.`
              ),
          ],
          ephemeral: true,
        });
      }

      userData.balance -= price;
      userData.totalSpent += price;

      const invName = `Wallet Shield (${wpMatch.label})`;
      const invId = `wallet_shield_${wpMatch.label.toLowerCase().replace(/ /g, '')}`;
      const existing = userData.inventory.find((i) => i.itemId === invId);
      if (existing) {
        existing.quantity += 1;
      } else {
        userData.inventory.push({ itemId: invId, name: invName, quantity: 1 });
      }
      await userData.save();

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Wallet Shield Purchased!')
        .setDescription(`You bought a **Wallet Shield (${wpMatch.label})** for **${price.toLocaleString()} eksoscoin**!`)
        .addFields(
          { name: 'Remaining in Inventory', value: `${userData.inventory.find((i) => i.itemId === invId)?.quantity || 0}`, inline: true },
          { name: 'Remaining Balance', value: `${userData.balance.toLocaleString()} eksoscoin`, inline: true }
        )
        .setFooter({ text: `Use /inventory use item:${invName} to activate it.` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // Server shop items
    let shopData = await ServerShop.findOne({ guildId: interaction.guild.id });
    if (!shopData) {
      shopData = await ServerShop.create({ guildId: interaction.guild.id });
    }

    if (!shopData.enabled) {
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
      (i) => i.name.toLowerCase() === itemName && i.enabled
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
      roleId: item.roleId || null,
      xpMultiplier: item.xpMultiplier || null,
    });
    await userData.save();

    if (item.stock > 0) {
      item.stock -= 1;
    }
    item.purchaseCount += 1;
    await shopData.save();

    let confirmationText = `You purchased **${item.name}** for **${item.price.toLocaleString()} eksoscoin**!`;
    if (item.type === 'role') {
      confirmationText += '\nIt has been added to your inventory. Use `/inventory use` to assign the role!';
    } else if (item.type === 'xp_boost') {
      confirmationText += `\nIt has been added to your inventory. Use \`/inventory use\` to activate the **${item.xpMultiplier}x XP boost**!`;
    } else {
      confirmationText += '\nIt has been added to your inventory. Use `/inventory use` to activate it!';
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
    let items = [
      { name: `Bank Note - ${(10000).toLocaleString()} eksoscoin`, value: 'Bank Note' },
      { name: `Wallet Shield (1 Day) - 10,000 eksoscoin`, value: 'Wallet Shield (1 Day)' },
      { name: `Wallet Shield (3 Days) - 25,000 eksoscoin`, value: 'Wallet Shield (3 Days)' },
      { name: `Wallet Shield (7 Days) - 35,000 eksoscoin`, value: 'Wallet Shield (7 Days)' },
    ];

    // Update prices from config
    try {
      const config = await BotShopConfig.findOne({ _id: 'global' });
      if (config) {
        items[0].name = `Bank Note - ${(config.bankNotePrice || 10000).toLocaleString()} eksoscoin`;
        items[1].name = `Wallet Shield (1 Day) - ${(config.walletShield1dPrice || 10000).toLocaleString()} eksoscoin`;
        items[2].name = `Wallet Shield (3 Days) - ${(config.walletShield3dPrice || 25000).toLocaleString()} eksoscoin`;
        items[3].name = `Wallet Shield (7 Days) - ${(config.walletShield7dPrice || 35000).toLocaleString()} eksoscoin`;
      }
    } catch {}

    if (interaction.guild) {
      const shopData = await ServerShop.findOne({ guildId: interaction.guild.id });
      if (shopData && shopData.items) {
        for (const i of shopData.items.filter((i) => i.enabled && i.name.toLowerCase().includes(focused)).slice(0, 19)) {
          items.push({ name: `${i.name} - ${i.price} eksoscoin`, value: i.name });
        }
      }
    }

    const filtered = items.filter((i) => i.value.toLowerCase().includes(focused));
    await interaction.respond(filtered.slice(0, 25));
  },
};
