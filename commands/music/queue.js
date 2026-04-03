const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getQueueInfo, getNowPlaying } = require('../../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Manage the Queue')
    .addSubcommand((subcommand) =>
      subcommand.setName('view').setDescription('View list of tracks in the queue')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption((option) =>
          option.setName('song').setDescription('The position of the song you want to remove').setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('clear').setDescription('Clear the whole queue')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const client = interaction.client;
    const queueInfo = getQueueInfo(interaction.guild.id);
    const nowPlaying = getNowPlaying(interaction.guild.id);

    if (!nowPlaying && queueInfo.tracks.length === 0) {
      return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
    }

    switch (subcommand) {
      case 'view': {
        const tracks = queueInfo.tracks;
        if (tracks.length === 0 && nowPlaying) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('#B0C4DE')
                .setAuthor({ name: 'Now Playing 🎵', iconURL: client.user.displayAvatarURL() })
                .setTitle(nowPlaying.title)
                .setURL(nowPlaying.url)
                .setThumbnail(nowPlaying.thumbnail)
                .setDescription(`🎧 \`${nowPlaying.artist}\` • ⌛ \`${formatDuration(nowPlaying.duration)}\``)
                .setFooter({ text: `Requested by ${nowPlaying.requester?.user?.tag || 'Unknown'}`, iconURL: nowPlaying.requester?.user?.displayAvatarURL() })
                .setTimestamp(),
            ],
          });
        }

        if (tracks.length === 0) {
          return interaction.reply({ content: '❌ Queue is empty!', ephemeral: true });
        }

        const tracksPerPage = 10;
        const totalPages = Math.ceil(tracks.length / tracksPerPage);
        let currentPage = 1;

        const generateEmbed = (page) => {
          const start = (page - 1) * tracksPerPage;
          const end = start + tracksPerPage;
          const pageTracks = tracks.slice(start, end);

          const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

          const queue = pageTracks.map((track, i) =>
            `\`${start + i + 1}.\` [${track.title}](${track.url})\n┗ 📺 \`${track.artist}\` • ⌛ \`${formatDuration(track.duration)}\``
          );

          return new EmbedBuilder()
            .setColor('#B0C4DE')
            .setAuthor({ name: 'Music Queue 🎵', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(nowPlaying?.thumbnail || pageTracks[0]?.thumbnail)
            .setDescription(
              `**Now Playing:**\n[${nowPlaying.title}](${nowPlaying.url})\n┗ 📺 \`${nowPlaying.artist}\` • ⌛ \`${formatDuration(nowPlaying.duration)}\`\n\n**Up Next:**\n${queue.join('\n\n')}`
            )
            .addFields(
              { name: '🎵 Queue Length', value: `\`${tracks.length} tracks\``, inline: true },
              { name: '⌛ Total Duration', value: `\`${formatDuration(totalDuration)}\``, inline: true },
              { name: '🔊 Status', value: '`Playing`', inline: true }
            )
            .setFooter({
              text: `Page ${page}/${totalPages} • Use the buttons below to navigate`,
              iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp();
        };

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prev').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
          new ButtonBuilder().setCustomId('next').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
        );

        const message = await interaction.reply({ embeds: [generateEmbed(currentPage)], components: [row], fetchReply: true });

        const collector = message.createMessageComponentCollector({ filter: (i) => i.user.id === interaction.user.id, time: 60000 });

        collector.on('collect', async (buttonInteraction) => {
          try {
            if (!buttonInteraction.deferred && !buttonInteraction.replied) await buttonInteraction.deferUpdate();

            if (buttonInteraction.customId === 'prev' && currentPage > 1) currentPage--;
            else if (buttonInteraction.customId === 'next' && currentPage < totalPages) currentPage++;

            const updatedRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('prev').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
              new ButtonBuilder().setCustomId('next').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
            );

            await buttonInteraction.message.edit({ embeds: [generateEmbed(currentPage)], components: [updatedRow] });
          } catch (error) {
            if (error.code !== 40060) console.error('Error handling queue interaction:', error);
          }
        });

        collector.on('end', () => {
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('next').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(true)
          );
          message.edit({ components: [disabledRow] }).catch(console.error);
        });
        break;
      }

      case 'remove': {
        const removePos = interaction.options.getInteger('song');
        const tracks = queueInfo.tracks;
        if (tracks.length < removePos) {
          return interaction.reply({ content: "❌ Cannot remove a track that isn't in the queue!", ephemeral: true });
        }

        const removeTrack = tracks[removePos - 1];
        const queue = getQueueInfo(interaction.guild.id);
        const actualQueue = queue.tracks;
        actualQueue.splice(removePos - 1, 1);

        const removedEmbed = new EmbedBuilder()
          .setColor('#B0C4DE')
          .setAuthor({ name: 'Removed from Queue 🗑️', iconURL: client.user.displayAvatarURL() })
          .setDescription(`Removed [${removeTrack.title}](${removeTrack.url})`)
          .setThumbnail(removeTrack.thumbnail)
          .addFields({ name: '🎵 Queue Length', value: `\`${actualQueue.length} tracks remaining\``, inline: true })
          .setFooter({ text: `Removed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        interaction.reply({ embeds: [removedEmbed] });
        break;
      }

      case 'clear': {
        const { clearQueue } = require('../../utils/musicPlayer');
        const queueLength = queueInfo.tracks.length;
        clearQueue(interaction.guild.id);

        const clearEmbed = new EmbedBuilder()
          .setColor('#B0C4DE')
          .setAuthor({ name: 'Queue Cleared 🧹', iconURL: client.user.displayAvatarURL() })
          .setDescription(`Successfully cleared \`${queueLength}\` tracks from the queue`)
          .setFooter({ text: `Cleared by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        interaction.reply({ embeds: [clearEmbed] });
        break;
      }
    }
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
