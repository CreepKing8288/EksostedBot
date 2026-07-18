const { EmbedBuilder } = require('discord.js');
const Starboard = require('../models/Starboard');
const { StarboardPost } = require('../models/Starboard');

async function handleReaction(reaction, user, added) {
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
  const existingPost = await StarboardPost.findOne({ guildId: message.guild.id, originalMessageId: message.id });

  if (added) {
    if (count < config.threshold) return;

    if (existingPost) {
      const starboardMsg = await starboardChannel.messages.fetch(existingPost.starboardMessageId).catch(() => null);
      if (starboardMsg) {
        const embed = buildEmbed(message, count);
        await starboardMsg.edit({ embeds: [embed] }).catch(() => null);
        await StarboardPost.updateOne({ _id: existingPost._id }, { $set: { starCount: count } });
      }
      return;
    }

    const embed = buildEmbed(message, count);
    const sent = await starboardChannel.send({
      content: `${config.emoji} **${count}** • <#${message.channel.id}>`,
      embeds: [embed],
    }).catch(() => null);

    if (sent) {
      await StarboardPost.create({
        guildId: message.guild.id,
        originalMessageId: message.id,
        starboardMessageId: sent.id,
        channelId: message.channel.id,
        starCount: count,
      });
    }
  } else {
    if (!existingPost) return;

    if (count < config.threshold) {
      const starboardMsg = await starboardChannel.messages.fetch(existingPost.starboardMessageId).catch(() => null);
      if (starboardMsg) await starboardMsg.delete().catch(() => null);
      await StarboardPost.deleteOne({ _id: existingPost._id });
      return;
    }

    const starboardMsg = await starboardChannel.messages.fetch(existingPost.starboardMessageId).catch(() => null);
    if (starboardMsg) {
      const embed = buildEmbed(message, count);
      await starboardMsg.edit({ embeds: [embed] }).catch(() => null);
      await StarboardPost.updateOne({ _id: existingPost._id }, { $set: { starCount: count } });
    }
  }
}

function buildEmbed(message, count) {
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
    embed.addFields({ name: 'Attachments', value: message.attachments.map(a => `[${a.name}](${a.url})`).join('\n') });
  }

  return embed;
}

module.exports = { handleReaction };
