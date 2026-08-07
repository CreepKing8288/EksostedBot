const { Events, EmbedBuilder } = require('discord.js');
const ServerLog = require('../../models/serverlogs');

module.exports = {
  name: Events.MessageDelete,
  once: false,
  async execute(message) {
    if (!message.guild || message.author?.bot || message.partial) return;

    const logSettings = await ServerLog.findOne({
      guildId: message.guild.id,
    });
    if (
      !logSettings ||
      !logSettings.logChannel ||
      !logSettings.categories.messages
    )
      return;

    const logChannel = message.guild.channels.cache.get(logSettings.logChannel);
    if (!logChannel) return;

    const attachments = [...message.attachments.values()];
    const image = attachments.find((a) => a.contentType?.startsWith('image/'));

    const embed = new EmbedBuilder()
      .setColor('Red')
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(
        `**Message deleted in ${message.channel}:**\n${message.content || '*Message content not available*'}`
      )
      .setFooter({ text: `User ID: ${message.author.id}` })
      .setTimestamp();

    if (attachments.length > 0)
      embed.addFields({
        name: 'Attachments',
        value: attachments
          .map((a) => `[${a.name}](${a.url})`)
          .join('\n'),
      });
    if (image) embed.setImage(image.url);

    logChannel.send({ embeds: [embed] });
  },
};
