const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EksosCoin = require('../../models/EksosCoin');

const NOTE_BOOST = 10000;

const WP_ITEMS = [
  { match: 'wallet shield (1 day)', duration: 1 * 24 * 60 * 60 * 1000, label: '1 Day' },
  { match: 'wallet shield (3 days)', duration: 3 * 24 * 60 * 60 * 1000, label: '3 Days' },
  { match: 'wallet shield (7 days)', duration: 7 * 24 * 60 * 60 * 1000, label: '7 Days' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View or use items from your inventory.')
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View all items in your inventory.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('use')
        .setDescription('Use an item from your inventory.')
        .addStringOption((opt) =>
          opt
            .setName('item')
            .setDescription('The item to use.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    let userData = await EksosCoin.findOne({ userId });
    if (!userData) userData = await EksosCoin.create({ userId });

    if (subcommand === 'view') {
      const inv = userData.inventory;

      if (!inv || inv.length === 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xfee75c)
              .setTitle('Inventory')
              .setDescription('Your inventory is empty. Buy items from `/shop`!'),
          ],
          ephemeral: true,
        });
      }

      const typeEmojis = {
        bank_note: '📗',
        wallet_shield: '🛡️',
        role: '🏷️',
        xp_boost: '⚡',
        custom: '🎁',
      };

      const fields = [];
      for (const item of inv) {
        if (item.quantity <= 0) continue;
        const emoji = typeEmojis[item.itemId] || typeEmojis[item.itemId?.split('_')[0]] || '📦';
        let desc = '';
        if (item.itemId === 'bank_note') desc = 'Use with `/inventory use item:Bank Note` to increase bank limit by 10,000.';
        else if (item.itemId?.startsWith('wallet_shield_')) desc = 'Use with `/inventory use item:' + item.name + '` to protect your wallet from /rob.';
        else if (item.itemId === 'role') desc = 'Server shop role item.';
        else if (item.itemId === 'xp_boost') desc = 'Server shop XP boost item.';
        else desc = 'Server shop custom item.';

        fields.push({
          name: `${emoji} ${item.name}`,
          value: `x${item.quantity}\n${desc}`,
          inline: true,
        });
      }

      if (fields.length === 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xfee75c)
              .setTitle('Inventory')
              .setDescription('Your inventory is empty. Buy items from `/shop`!'),
          ],
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${interaction.user.username}'s Inventory`)
        .addFields(fields)
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'use') {
      const itemName = interaction.options.getString('item');
      const itemNameLower = itemName.toLowerCase();

      const invIdx = userData.inventory.findIndex(
        (i) => i.quantity > 0 && i.name.toLowerCase() === itemNameLower
      );

      if (invIdx === -1) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Item Not Found')
              .setDescription(`You don't have **${itemName}** in your inventory, or it has 0 quantity.`),
          ],
          ephemeral: true,
        });
      }

      const invItem = userData.inventory[invIdx];

      // === Bank Note ===
      if (invItem.itemId === 'bank_note') {
        userData.bankNotesUsed += 1;
        userData.bankLimit += NOTE_BOOST;
        invItem.quantity -= 1;
        if (invItem.quantity <= 0) userData.inventory.splice(invIdx, 1);
        await userData.save();

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57f287)
              .setTitle('Bank Note Used!')
              .setDescription(`You used a **Bank Note**! Your bank limit increased by **${NOTE_BOOST.toLocaleString()} eksoscoin**.`)
              .addFields(
                { name: 'New Bank Limit', value: `**${userData.bankLimit.toLocaleString()} eksoscoin**`, inline: true },
                { name: 'Remaining Notes', value: `${userData.inventory.find((i) => i.itemId === 'bank_note')?.quantity || 0}`, inline: true }
              )
              .setTimestamp(),
          ],
        });
      }

      // === Wallet Shield ===
      const wpMatch = WP_ITEMS.find((wp) => itemNameLower === wp.match);
      if (wpMatch) {
        const now = new Date();
        const currentExpiry = userData.walletProtectedUntil && userData.walletProtectedUntil.getTime() > now.getTime()
          ? userData.walletProtectedUntil.getTime()
          : now.getTime();
        userData.walletProtectedUntil = new Date(currentExpiry + wpMatch.duration);

        invItem.quantity -= 1;
        if (invItem.quantity <= 0) userData.inventory.splice(invIdx, 1);
        await userData.save();

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57f287)
              .setTitle('Wallet Shield Activated!')
              .setDescription(`You activated a **Wallet Shield (${wpMatch.label})**!`)
              .addFields(
                { name: 'Protected Until', value: `<t:${Math.floor(userData.walletProtectedUntil.getTime() / 1000)}:F>`, inline: true },
                { name: 'Remaining Shields', value: `${userData.inventory.find((i) => i.name.toLowerCase() === itemNameLower)?.quantity || 0}`, inline: true }
              )
              .setTimestamp(),
          ],
        });
      }

      // === Server shop items (role, xp_boost, custom) ===
      if (invItem.itemId === 'role' && interaction.guild) {
        try {
          const member = await interaction.guild.members.fetch(userId);
          if (invItem.roleId) {
            const role = await interaction.guild.roles.fetch(invItem.roleId);
            if (role) await member.roles.add(role);
          }
        } catch {}

        invItem.quantity -= 1;
        if (invItem.quantity <= 0) userData.inventory.splice(invIdx, 1);
        await userData.save();

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57f287)
              .setTitle('Item Used!')
              .setDescription(`You used **${invItem.name}**! Role has been assigned.`)
              .setTimestamp(),
          ],
        });
      }

      if (invItem.itemId === 'xp_boost') {
        const mult = invItem.xpMultiplier || 2;
        invItem.quantity -= 1;
        if (invItem.quantity <= 0) userData.inventory.splice(invIdx, 1);
        await userData.save();

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57f287)
              .setTitle('Item Used!')
              .setDescription(`You used **${invItem.name}**! **${mult}x XP boost** is now active.`)
              .setTimestamp(),
          ],
        });
      }

      // Custom / fallback
      invItem.quantity -= 1;
      if (invItem.quantity <= 0) userData.inventory.splice(invIdx, 1);
      await userData.save();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('Item Used!')
            .setDescription(`You used **${invItem.name}**!`)
            .setTimestamp(),
        ],
      });
    }
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const userId = interaction.user.id;

    const userData = await EksosCoin.findOne({ userId });
    if (!userData || !userData.inventory) return interaction.respond([]);

    const items = userData.inventory
      .filter((i) => i.quantity > 0 && i.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((i) => ({ name: `${i.name} (x${i.quantity})`, value: i.name }));

    await interaction.respond(items);
  },
};
