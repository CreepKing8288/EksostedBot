const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getNowPlaying, getPlayer, getConnection, getQueueInfo } = require('../../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show information about the currently playing track'),
  async execute(interaction) {
    const client = interaction.client;
    const nowPlaying = getNowPlaying(interaction.guild.id);

    if (!nowPlaying) {
      return interaction.reply({ content: '🎵 Nothing is playing right now!', ephemeral: true });
    }

    const queueInfo = getQueueInfo(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor('#B0C4DE')
      .setAuthor({ name: 'Now Playing 🎵', iconURL: client.user.displayAvatarURL() })
      .setTitle(nowPlaying.title)
      .setURL(nowPlaying.url)
      .setThumbnail(nowPlaying.thumbnail)
      .addFields(
        { name: '👤 Artist', value: `\`${nowPlaying.artist}\``, inline: true },
        { name: '🎧 Requested by', value: nowPlaying.requester ? `${nowPlaying.requester.user.tag}` : 'Unknown', inline: true },
        { name: '🎶 Up Next', value: queueInfo.tracks.length > 0 ? `${queueInfo.tracks.length} track${queueInfo.tracks.length === 1 ? '' : 's'}` : 'Nothing queued', inline: true },
        { name: '⌛ Duration', value: `\`${formatDuration(nowPlaying.duration)}\``, inline: true },
        { name: '⏯️ Status', value: '`Playing`', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Server: ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() });

    await interaction.reply({ embeds: [embed] });
  },
};

function formatDuration(ms) {
  if (!ms || ms === 0) return 'Live';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
