const { Events, EmbedBuilder } = require('discord.js');
const Starboard = require('../../models/Starboard');

module.exports = {
  name: Events.MessageReactionAdd,
  once: false,
  async execute(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    const message = reaction.message;
    if (!message.guild) return;

    const config = await Starboard.findOne({ guildId: message.guild.id });
    if (!config || !config.enabled || !config.channelId) return;

    if (config.ignoredChannels.includes(message.channel.id)) return;

    if (reaction.emoji.name !== config.emoji) return;

    const starboardChannel = message.guild.channels.cache.get(config.channelId);
    if (!starboardChannel) return;

    const count = reaction.count;
    if (count < config.threshold) return;

    const existing = await message.channel.messages.fetch().then(msgs =>
      msgs.find(m => m.embeds[0]?.footer?.text?.includes(message.id))
    );

    if (existing) return;

    const starboardMessages = await starboardChannel.messages.fetch({ limit: 100 });
    const alreadyPosted = starboardMessages.find(m =>
      m.embeds[0]?.footer?.text?.includes(message.id)
    );
    if (alreadyPosted) return;

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setDescription(message.content || '*No content*')
      .setFooter({ text: `⭐ ${count} | ${message.id}` })
      .setTimestamp();

    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(attachment.contentType)) {
        embed.setImage(attachment.url);
      }
    }

    if (message.attachments.size > 0) {
      embed.addFields({ name: 'Attachments', value: message.attachments.map(a => `[${a.name}](${a.url})`).join('\n') });
    }

    await starboardChannel.send({
      content: `${config.emoji} **${count}** • <#${message.channel.id}>`,
      embeds: [embed],
    });
  },
};
