const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Playlist = require('../../models/Playlist');
const ytSearch = require('yt-search');
const { addToQueue, joinVoice, getNowPlaying } = require('../../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage your playlists')
    .addSubcommand((sub) =>
      sub.setName('create').setDescription('Create a new playlist').addStringOption((opt) =>
        opt.setName('name').setDescription('Name of the playlist').setRequired(true)
      )
    )
    .addSubcommand((sub) =>
      sub.setName('load').setDescription('Load a playlist into the queue').addStringOption((opt) =>
        opt.setName('name').setDescription('Name of the playlist').setRequired(true).setAutocomplete(true)
      )
    )
    .addSubcommand((sub) =>
      sub.setName('addcurrent').setDescription('Add current track to a playlist').addStringOption((opt) =>
        opt.setName('name').setDescription('Name of the playlist').setRequired(true).setAutocomplete(true)
      )
    )
    .addSubcommand((sub) =>
      sub.setName('addqueue').setDescription('Add all tracks from current queue to a playlist').addStringOption((opt) =>
        opt.setName('name').setDescription('Name of the playlist').setRequired(true).setAutocomplete(true)
      )
    )
    .addSubcommand((sub) =>
      sub.setName('add').setDescription('Add a track or playlist to your playlist')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Name of your playlist').setRequired(true).setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt.setName('query').setDescription('Track URL or search query').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Remove a track from your playlist')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Name of the playlist').setRequired(true).setAutocomplete(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('position').setDescription('Position of the track to remove').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View tracks in a playlist').addStringOption((opt) =>
        opt.setName('name').setDescription('Name of the playlist').setRequired(true).setAutocomplete(true)
      )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all your playlists')
    )
    .addSubcommand((sub) =>
      sub.setName('delete').setDescription('Delete a playlist').addStringOption((opt) =>
        opt.setName('name').setDescription('Name of the playlist').setRequired(true).setAutocomplete(true)
      )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand();

    if (focused.name === 'name') {
      const playlists = await Playlist.find({ userId: interaction.user.id });
      return await interaction.respond(
        playlists
          .filter((p) => p.name.toLowerCase().includes(focused.value.toLowerCase()))
          .map((p) => ({ name: `${p.name} (${p.tracks.length} tracks)`, value: p.name }))
      );
    }

    if (subcommand === 'add' && focused.name === 'query') {
      if (!focused.value.trim()) {
        return await interaction.respond([{ name: 'Start typing to search...', value: 'start_typing' }]);
      }

      try {
        const results = await ytSearch(focused.value);
        if (!results.videos.length) {
          return await interaction.respond([{ name: 'No results found', value: 'no_results' }]);
        }

        return await interaction.respond(
          results.videos.slice(0, 25).map((track) => ({
            name: `${track.title} - ${track.author.name}`,
            value: track.url,
          }))
        );
      } catch {
        return await interaction.respond([{ name: 'Error searching tracks', value: 'error' }]);
      }
    }
  },

  async execute(interaction) {
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'create': {
          const name = interaction.options.getString('name');
          await Playlist.create({ userId: interaction.user.id, name, tracks: [] });

          const embed = new EmbedBuilder()
            .setColor('#F0E68C')
            .setTitle('🎵 Playlist Created')
            .setDescription(`Successfully created playlist: **${name}**`)
            .addFields({ name: '📑 Tracks', value: '`0 tracks`', inline: true })
            .setFooter({ text: `Created by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

          return await interaction.editReply({ embeds: [embed] });
        }

        case 'load': {
          const name = interaction.options.getString('name');
          const playlist = await Playlist.findOne({ userId: interaction.user.id, name });

          if (!playlist) return await interaction.editReply('❌ Playlist not found!');
          if (!interaction.member.voice.channel) return await interaction.editReply('❌ You need to join a voice channel first!');

          joinVoice(interaction.guild.id, interaction.member.voice.channel);

          const loadEmbed = new EmbedBuilder()
            .setColor('#F0E68C')
            .setTitle('🎵 Loading Playlist')
            .setDescription(`Loading **${playlist.tracks.length}** tracks from playlist: **${name}**`)
            .addFields(
              { name: '📑 Playlist', value: `\`${name}\``, inline: true },
              { name: '⌛ Total Duration', value: `\`${formatDuration(playlist.tracks.reduce((acc, t) => acc + (t.duration || 0), 0))}\``, inline: true }
            )
            .setFooter({ text: `Loaded by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

          await interaction.editReply({ embeds: [loadEmbed] });

          for (const track of playlist.tracks) {
            const result = await ytSearch(`${track.title} ${track.author || ''}`);
            if (result.videos[0]) {
              addToQueue(interaction.guild.id, {
                title: track.title,
                url: result.videos[0].url,
                duration: result.videos[0].seconds * 1000,
                thumbnail: result.videos[0].thumbnail,
                author: result.videos[0].author.name,
                requester: interaction.member,
              }, interaction.channel);
            }
          }

          return await interaction.editReply(`✅ Loaded ${playlist.tracks.length} tracks from playlist: ${name}`);
        }

        case 'addcurrent': {
          const name = interaction.options.getString('name');
          const nowPlaying = getNowPlaying(interaction.guild.id);

          if (!nowPlaying) return await interaction.editReply('❌ Nothing is playing right now!');

          const playlist = await Playlist.findOne({ userId: interaction.user.id, name });
          if (!playlist) return await interaction.editReply('❌ Playlist not found!');

          playlist.tracks.push({
            title: nowPlaying.title,
            uri: nowPlaying.url,
            author: nowPlaying.artist,
            duration: nowPlaying.duration,
            artworkUrl: nowPlaying.thumbnail,
          });
          await playlist.save();

          const embed = new EmbedBuilder()
            .setColor('#F0E68C')
            .setTitle('🎵 Track Added to Playlist')
            .setDescription(`Added track to playlist: **${name}**`)
            .setThumbnail(nowPlaying.thumbnail)
            .addFields(
              { name: '🎵 Track', value: `[${nowPlaying.title}](${nowPlaying.url})`, inline: true },
              { name: '👤 Artist', value: `\`${nowPlaying.artist}\``, inline: true },
              { name: '⌛ Duration', value: `\`${formatDuration(nowPlaying.duration)}\``, inline: true },
              { name: '📑 Playlist Tracks', value: `\`${playlist.tracks.length} tracks\``, inline: true }
            )
            .setFooter({ text: `Added by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

          return await interaction.editReply({ embeds: [embed] });
        }

        case 'addqueue': {
          const name = interaction.options.getString('name');
          const nowPlaying = getNowPlaying(interaction.guild.id);
          if (!nowPlaying) return await interaction.editReply('❌ Nothing is playing right now!');

          const playlist = await Playlist.findOne({ userId: interaction.user.id, name });
          if (!playlist) return await interaction.editReply('❌ Playlist not found!');

          playlist.tracks.push({
            title: nowPlaying.title,
            uri: nowPlaying.url,
            author: nowPlaying.artist,
            duration: nowPlaying.duration,
            artworkUrl: nowPlaying.thumbnail,
          });

          const { getQueueInfo } = require('../../utils/musicPlayer');
          const queueInfo = getQueueInfo(interaction.guild.id);
          for (const track of queueInfo.tracks) {
            playlist.tracks.push({
              title: track.title,
              uri: track.url,
              author: track.artist,
              duration: track.duration,
              artworkUrl: track.thumbnail,
            });
          }

          await playlist.save();

          const embed = new EmbedBuilder()
            .setColor('#F0E68C')
            .setTitle('🎵 Queue Added to Playlist')
            .setDescription(`Added **${queueInfo.tracks.length + 1}** tracks to playlist: **${name}**`)
            .addFields(
              { name: '📑 Added Tracks', value: `\`${queueInfo.tracks.length + 1} tracks\``, inline: true },
              { name: '📝 Total Tracks', value: `\`${playlist.tracks.length} tracks\``, inline: true },
              { name: '⌛ Total Duration', value: `\`${formatDuration(playlist.tracks.reduce((acc, t) => acc + (t.duration || 0), 0))}\``, inline: true }
            )
            .setFooter({ text: `Added by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

          return await interaction.editReply({ embeds: [embed] });
        }

        case 'add': {
          const name = interaction.options.getString('name');
          const query = interaction.options.getString('query');

          const playlist = await Playlist.findOne({ userId: interaction.user.id, name });
          if (!playlist) return await interaction.editReply('❌ Playlist not found!');

          try {
            const results = await ytSearch(query);
            if (!results.videos.length) return await interaction.editReply('❌ No tracks found!');

            const track = results.videos[0];
            playlist.tracks.push({
              title: track.title,
              uri: track.url,
              author: track.author.name,
              duration: track.seconds * 1000,
              artworkUrl: track.thumbnail,
            });
            await playlist.save();

            return await interaction.editReply(`✅ Added "${track.title}" to playlist: ${name}`);
          } catch {
            return await interaction.editReply('❌ Error searching for track.');
          }
        }

        case 'remove': {
          const name = interaction.options.getString('name');
          const position = interaction.options.getInteger('position') - 1;

          const playlist = await Playlist.findOne({ userId: interaction.user.id, name });
          if (!playlist) return await interaction.editReply('❌ Playlist not found!');
          if (position < 0 || position >= playlist.tracks.length) return await interaction.editReply('❌ Invalid track position!');

          const removedTrack = playlist.tracks.splice(position, 1)[0];
          await playlist.save();

          const embed = new EmbedBuilder()
            .setColor('#F0E68C')
            .setTitle('🎵 Track Removed from Playlist')
            .setDescription(`Removed track from playlist: **${name}**`)
            .addFields(
              { name: '🎵 Removed Track', value: `[${removedTrack.title}](${removedTrack.uri})`, inline: false },
              { name: '📑 Remaining Tracks', value: `\`${playlist.tracks.length} tracks\``, inline: true },
              { name: '⌛ Track Duration', value: `\`${formatDuration(removedTrack.duration)}\``, inline: true }
            )
            .setFooter({ text: `Removed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

          return await interaction.editReply({ embeds: [embed] });
        }

        case 'view': {
          const name = interaction.options.getString('name');
          const playlist = await Playlist.findOne({ userId: interaction.user.id, name });
          if (!playlist) return await interaction.editReply('❌ Playlist not found!');

          const tracksPerPage = 10;
          const totalPages = Math.ceil(playlist.tracks.length / tracksPerPage);
          let currentPage = 1;

          const generateEmbed = (page) => {
            const start = (page - 1) * tracksPerPage;
            const end = start + tracksPerPage;
            const tracks = playlist.tracks.slice(start, end);
            const totalDuration = playlist.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

            return new EmbedBuilder()
              .setColor('#F0E68C')
              .setTitle(`🎵 Playlist: ${playlist.name}`)
              .setDescription(
                tracks.length
                  ? tracks.map((track, i) =>
                      `\`${start + i + 1}.\` [${track.title}](${track.uri})\n┗ 👤 \`${track.author}\` • ⌛ \`${formatDuration(track.duration)}\``
                    ).join('\n\n')
                  : 'No tracks in this playlist'
              )
              .addFields(
                { name: '📑 Total Tracks', value: `\`${playlist.tracks.length} tracks\``, inline: true },
                { name: '⌛ Total Duration', value: `\`${formatDuration(totalDuration)}\``, inline: true }
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

          const message = await interaction.editReply({ embeds: [generateEmbed(currentPage)], components: totalPages > 1 ? [row] : [] });

          if (totalPages > 1) {
            const collector = message.createMessageComponentCollector({ filter: (i) => i.user.id === interaction.user.id, time: 60000 });

            collector.on('collect', async (buttonInteraction) => {
              try {
                if (!buttonInteraction.deferred) await buttonInteraction.deferUpdate();

                if (buttonInteraction.customId === 'prev' && currentPage > 1) currentPage--;
                else if (buttonInteraction.customId === 'next' && currentPage < totalPages) currentPage++;

                const updatedRow = new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('prev').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
                  new ButtonBuilder().setCustomId('next').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
                );

                await buttonInteraction.message.edit({ embeds: [generateEmbed(currentPage)], components: [updatedRow] });
              } catch (error) {
                console.error('Error handling playlist view interaction:', error);
              }
            });

            collector.on('end', () => {
              const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('next').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(true)
              );
              message.edit({ components: [disabledRow] }).catch(console.error);
            });
          }
          break;
        }

        case 'list': {
          const playlists = await Playlist.find({ userId: interaction.user.id });
          if (!playlists.length) return await interaction.editReply('❌ You have no playlists!');

          const embed = new EmbedBuilder()
            .setColor('#F0E68C')
            .setTitle('📑 Your Playlists')
            .setDescription(playlists.map((p) => `**${p.name}** - ${p.tracks.length} tracks`).join('\n'))
            .setTimestamp();

          return await interaction.editReply({ embeds: [embed] });
        }

        case 'delete': {
          const name = interaction.options.getString('name');
          const playlist = await Playlist.findOneAndDelete({ userId: interaction.user.id, name });
          if (!playlist) return await interaction.editReply('❌ Playlist not found!');

          const embed = new EmbedBuilder()
            .setColor('#F0E68C')
            .setTitle('🎵 Playlist Deleted')
            .setDescription(`Successfully deleted playlist: **${name}**`)
            .addFields(
              { name: '📑 Deleted Tracks', value: `\`${playlist.tracks.length} tracks\``, inline: true },
              { name: '⌛ Total Duration', value: `\`${formatDuration(playlist.tracks.reduce((acc, t) => acc + (t.duration || 0), 0))}\``, inline: true }
            )
            .setFooter({ text: `Deleted by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

          return await interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('Playlist command error:', error);
      return await interaction.editReply('❌ An error occurred while processing the command.');
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
