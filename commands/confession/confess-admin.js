const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('confess-admin')
    .setDescription('Administrative tools for the confession system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('setchannel')
        .setDescription('Set the public channel for confessions')
        .addChannelOption(opt => opt.setName('channel').setDescription('The channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('setlogs')
        .setDescription('Set the private log channel for staff')
        .addChannelOption(opt => opt.setName('channel').setDescription('The channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('ban')
        .setDescription('Ban a user from the confession system')
        .addStringOption(opt => opt.setName('user_id').setDescription('The Discord ID of the user').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 7d, Permanent)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('unban')
        .setDescription('Unban a user from the confession system')
        .addStringOption(opt => opt.setName('user_id').setDescription('The Discord ID of the user').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('banlist')
        .setDescription('View all currently banned users')
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a confession by its message link')
        .addStringOption(opt => opt.setName('link').setDescription('The Discord message link').setRequired(true))
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    // 1. Set Channels
    if (subcommand === 'setchannel' || subcommand === 'setlogs') {
      const channel = interaction.options.getChannel('channel');
      const key = subcommand === 'setchannel' ? 'confession_channel_id' : 'log_channel_id';

      await client.db.collection('settings').updateOne(
        { _id: 'config' },
        { $set: { [key]: channel.id } },
        { upsert: true }
      );

      return interaction.reply({ content: `✅ ${subcommand === 'setchannel' ? 'Confession' : 'Log'} channel set to ${channel}.`, ephemeral: true });
    }

    // 2. Ban Management
    if (subcommand === 'ban') {
      const userId = interaction.options.getString('user_id');
      const duration = interaction.options.getString('duration');
      await client.db.collection('bans').updateOne(
        { user_id: userId },
        { $set: { dur: duration } },
        { upsert: true }
      );
      return interaction.reply({ content: `🚫 Banned \`${userId}\` for: ${duration}`, ephemeral: true });
    }

    if (subcommand === 'unban') {
      const userId = interaction.options.getString('user_id');
      const result = await client.db.collection('bans').deleteOne({ user_id: userId });
      return interaction.reply({ 
        content: result.deletedCount > 0 ? `✅ Unbanned \`${userId}\`.` : `❌ User was not banned.`, 
        ephemeral: true 
      });
    }

    if (subcommand === 'banlist') {
      const bans = await client.db.collection('bans').find().toArray();
      const list = bans.length > 0 ? bans.map(b => `ID: \`${b.user_id}\` (${b.dur})`).join('\n') : 'No active bans.';
      const embed = new EmbedBuilder().setTitle('Confession Ban List').setDescription(list).setColor('#FFA500');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 3. Removal
    if (subcommand === 'remove') {
      const link = interaction.options.getString('link');
      const messageId = link.split('/').pop();
      const config = await client.db.collection('settings').findOne({ _id: 'config' });

      try {
        const channel = await client.channels.fetch(config.confession_channel_id);
        const msg = await channel.messages.fetch(messageId);
        await msg.edit({
          embeds: [new EmbedBuilder().setDescription('**This Confession Got Removed By Staff**').setColor(0xff0000)],
          components: []
        });
        return interaction.reply({ content: 'Confession removed.', ephemeral: true });
      } catch (e) {
        return interaction.reply({ content: '❌ Error: Could not find or edit message.', ephemeral: true });
      }
    }
  }
};