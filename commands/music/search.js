const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const ytSearch = require('yt-search');
const { addToQueue, joinVoice, getQueueInfo } = require('../../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for a song to add to the queue')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Song name or YouTube URL')
        .setRequired(true)
    ),

  async execute(interaction) {
    const client = interaction.client;
    const query = interaction.options.getString('query');
    const member = interaction.member;

    if (!member.voice.channel) {
      return interaction.reply({
        content: '❌ You need to join a voice channel first!',
        ephemeral: true,
      });
    }

    const permissions = member.voice.channel.permissionsFor(client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return interaction.reply({
        content: '❌ I need permissions to join and speak in your voice channel!',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    let results;
    try {
      results = await ytSearch(query);
    } catch {
      return interaction.editReply({
        content: '❌ An error occurred while searching.',
        ephemeral: true,
      });
    }

    if (!results.videos.length) {
      return interaction.editReply({
        content: '❌ No results found! Try a different search term.',
        ephemeral: true,
      });
    }

    const tracks = results.videos.slice(0, 10);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('search_select')
      .setPlaceholder('Select a song to add to the queue')
      .addOptions(
        tracks.map((track, index) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${index + 1}. ${track.title.slice(0, 95)}`)
            .setDescription(`By ${track.author.name} • ${formatDuration(track.seconds * 1000)}`)
            .setValue(track.url)
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const searchEmbed = new EmbedBuilder()
      .setColor('#DDA0DD')
      .setAuthor({
        name: `Search Results for "${query}"`,
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(
        `🔍 Found ${tracks.length} results from 📺 YouTube\n\n` +
          tracks
            .map(
              (track, index) =>
                `**${index + 1}.** [${track.title}](${track.url})\n` +
                `📺 \`${track.author.name}\` • ⌛ \`${formatDuration(track.seconds * 1000)}\``
            )
            .join('\n\n')
      )
      .setThumbnail(tracks[0].thumbnail)
      .addFields({
        name: '📝 Instructions',
        value: 'Select a track from the dropdown menu below\nThis menu will timeout in 30 seconds',
      })
      .setFooter({
        text: `Requested by ${interaction.user.tag} • Select a track to add to queue`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    const response = await interaction.editReply({
      embeds: [searchEmbed],
      components: [row],
    });

    const filter = (i) => i.user.id === interaction.user.id;
    const collector = response.createMessageComponentCollector({
      filter,
      time: 30000,
    });

    collector.on('collect', async (i) => {
      const selectedUrl = i.values[0];
      const selectedTrack = tracks.find((t) => t.url === selectedUrl);

      if (!selectedTrack) {
        return i.reply({
          content: '❌ Track not found! Please try searching again.',
          ephemeral: true,
        });
      }

      try {
        joinVoice(interaction.guild.id, member.voice.channel);
        addToQueue(interaction.guild.id, {
          title: selectedTrack.title,
          url: selectedTrack.url,
          duration: selectedTrack.seconds * 1000,
          thumbnail: selectedTrack.thumbnail,
          author: selectedTrack.author.name,
          requester: interaction.member,
        }, interaction.channel);

        const queueInfo = getQueueInfo(interaction.guild.id);

        const addedEmbed = new EmbedBuilder()
          .setColor('#DDA0DD')
          .setAuthor({
            name: 'Added to Queue 🎵',
            iconURL: client.user.displayAvatarURL(),
          })
          .setTitle(selectedTrack.title)
          .setURL(selectedTrack.url)
          .setThumbnail(selectedTrack.thumbnail)
          .addFields(
            { name: '👤 Artist', value: `\`${selectedTrack.author.name}\``, inline: true },
            { name: '⌛ Duration', value: `\`${formatDuration(selectedTrack.seconds * 1000)}\``, inline: true },
            { name: '🎧 Position in Queue', value: `\`#${queueInfo.length}\``, inline: true },
            { name: '🎵 Source', value: `\`YouTube\``, inline: true }
          )
          .setFooter({
            text: `Added by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTimestamp();

        await i.update({ embeds: [addedEmbed], components: [] });
      } catch (error) {
        console.error('Error adding track:', error);
        await i.reply({
          content: '❌ Error adding track to queue. Please try again.',
          ephemeral: true,
        });
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        interaction.editReply({
          content: '⏱️ Search timed out. Please try again.',
          components: [],
        });
      }
    });
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
