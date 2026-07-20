const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ServerShop = require('../../models/ServerShop');
const crypto = require('crypto');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop-admin')
    .setDescription('Manage the server\'s EksosCoin shop.')
    .setDefaultMemberPermissions(0x20) // ManageGuild
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add an item to the shop.')
        .addStringOption((o) => o.setName('name').setDescription('Item name.').setRequired(true))
        .addStringOption((o) => o.setName('description').setDescription('Item description.'))
        .addIntegerOption((o) => o.setName('price').setDescription('Price in eksoscoin.').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('Item type.')
            .setRequired(true)
            .addChoices(
              { name: 'Role', value: 'role' },
              { name: 'XP Boost', value: 'xp_boost' },
              { name: 'Custom', value: 'custom' }
            )
        )
        .addRoleOption((o) => o.setName('role').setDescription('Role to grant (for role type).'))
        .addNumberOption((o) =>
          o.setName('xp-multiplier').setDescription('XP multiplier (for xp_boost type).')
        )
        .addIntegerOption((o) => o.setName('stock').setDescription('Stock limit (-1 = unlimited).'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove an item from the shop.')
        .addStringOption((o) =>
          o.setName('name').setDescription('Item name to remove.').setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all items in the shop.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable the shop.')
        .addBooleanOption((o) =>
          o.setName('enabled').setDescription('Enable or disable the shop.').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle-item')
        .setDescription('Enable or disable a specific item.')
        .addStringOption((o) =>
          o.setName('name').setDescription('Item name.').setRequired(true).setAutocomplete(true)
        )
        .addBooleanOption((o) =>
          o.setName('enabled').setDescription('Enable or disable.').setRequired(true)
        )
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

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    let shopData = await ServerShop.findOne({ guildId });
    if (!shopData) {
      shopData = await ServerShop.create({ guildId });
    }

    if (subcommand === 'add') {
      const name = interaction.options.getString('name');
      const description = interaction.options.getString('description') || '';
      const price = interaction.options.getInteger('price');
      const type = interaction.options.getString('type');
      const role = interaction.options.getRole('role');
      const xpMultiplier = interaction.options.getNumber('xp-multiplier') || 1;
      const stock = interaction.options.getInteger('stock') ?? -1;

      if (shopData.items.find((i) => i.name.toLowerCase() === name.toLowerCase())) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Duplicate Item')
              .setDescription(`An item named **${name}** already exists.`),
          ],
          ephemeral: true,
        });
      }

      if (type === 'role' && !role) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Role Required')
              .setDescription('You must specify a role for role-type items.'),
          ],
          ephemeral: true,
        });
      }

      const itemId = crypto.randomBytes(4).toString('hex');

      shopData.items.push({
        itemId,
        name,
        description,
        price,
        type,
        roleId: role ? role.id : null,
        xpMultiplier: type === 'xp_boost' ? xpMultiplier : 1,
        stock,
        enabled: true,
      });

      await shopData.save();

      const typeEmojis = { role: '🏷️', xp_boost: '⚡', custom: '🎁' };

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Item Added!')
        .setDescription(`**${name}** has been added to the shop.`)
        .addFields(
          { name: 'Type', value: `${typeEmojis[type] || '📦'} ${type}`, inline: true },
          { name: 'Price', value: `${price.toLocaleString()} eksoscoin`, inline: true },
          { name: 'Stock', value: stock === -1 ? 'Unlimited' : `${stock}`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (subcommand === 'remove') {
      const name = interaction.options.getString('name');
      const itemIndex = shopData.items.findIndex(
        (i) => i.name.toLowerCase() === name.toLowerCase()
      );

      if (itemIndex === -1) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Item Not Found')
              .setDescription(`No item named **${name}** found.`),
          ],
          ephemeral: true,
        });
      }

      const removed = shopData.items.splice(itemIndex, 1)[0];
      await shopData.save();

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Item Removed!')
        .setDescription(`**${removed.name}** has been removed from the shop.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (subcommand === 'list') {
      if (shopData.items.length === 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xfee75c)
              .setTitle('Shop Empty')
              .setDescription('No items in the shop. Use `/shop-admin add` to add items.'),
          ],
          ephemeral: true,
        });
      }

      const typeEmojis = { role: '🏷️', xp_boost: '⚡', custom: '🎁' };
      const fields = shopData.items.map((item) => {
        const emoji = typeEmojis[item.type] || '📦';
        const status = item.enabled ? '✅' : '❌';
        const stock = item.stock === -1 ? '∞' : `${item.stock}`;
        return {
          name: `${status} ${emoji} ${item.name}`,
          value: `**${item.price.toLocaleString()} eksoscoin** | Stock: ${stock} | Sold: ${item.purchaseCount}`,
          inline: true,
        };
      });

      const embed = new EmbedBuilder()
        .setColor(0xf5a623)
        .setTitle(`${interaction.guild.name} Shop Items`)
        .addFields(fields)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (subcommand === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled');
      shopData.enabled = enabled;
      await shopData.save();

      const embed = new EmbedBuilder()
        .setColor(enabled ? 0x57f287 : 0xed4245)
        .setTitle(`Shop ${enabled ? 'Enabled' : 'Disabled'}`)
        .setDescription(`The shop has been ${enabled ? 'enabled' : 'disabled'}.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (subcommand === 'toggle-item') {
      const name = interaction.options.getString('name');
      const enabled = interaction.options.getBoolean('enabled');

      const item = shopData.items.find(
        (i) => i.name.toLowerCase() === name.toLowerCase()
      );

      if (!item) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('Item Not Found')
              .setDescription(`No item named **${name}** found.`),
          ],
          ephemeral: true,
        });
      }

      item.enabled = enabled;
      await shopData.save();

      const embed = new EmbedBuilder()
        .setColor(enabled ? 0x57f287 : 0xed4245)
        .setTitle(`Item ${enabled ? 'Enabled' : 'Disabled'}`)
        .setDescription(`**${item.name}** is now ${enabled ? 'enabled' : 'disabled'}.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const shopData = await ServerShop.findOne({ guildId: interaction.guild?.id });
    if (!shopData) return interaction.respond([]);

    const items = shopData.items
      .filter((i) => i.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((i) => ({ name: i.name, value: i.name }));

    await interaction.respond(items);
  },
};
