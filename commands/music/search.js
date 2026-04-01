const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
} = require('discord.js');
const { formatTime } = require('../../utils/utils');
const spotify = require('../../utils/spotify');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for a song to add to the queue')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Song name or URL')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('source')
        .setDescription('The source you want to search from')
        .addChoices(
          { name: 'Youtube', value: 'ytsearch' },
          { name: 'Youtube Music', value: 'ytmsearch' },
          { name: 'Spotify', value: 'spsearch' },
          { name: 'Soundcloud', value: 'scsearch' },
          { name: 'Deezer', value: 'dzsearch' }
        )
    ),
  async execute(interaction) {
    const client = interaction.client;
    const query = interaction.options.getString('query');
    const member = interaction.member;
    const source = interaction.options.getString('source') || 'spsearch';

    if (!member.voice.channel) {
      return interaction.reply({
        content: '❌ You need to join a voice channel first!',
        ephemeral: true,
      });
    }

    const permissions = member.voice.channel.permissionsFor(client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return interaction.reply({
        content:
          '❌ I need permissions to join and speak in your voice channel!',
        ephemeral: true,
      });
    }

    try {
      let player = client.lavalink.players.get(interaction.guild.id);
      if (!player) {
        player = await client.lavalink.createPlayer({
          guildId: interaction.guild.id,
          voiceChannelId: member.voice.channel.id,
          textChannelId: interaction.channel.id,
          selfDeaf: true,
          selfMute: false,
          volume: 100,
        });
        await player.connect();
      }

      await interaction.deferReply();

      let search;
      let spotifyResults = [];
      if (source === 'spsearch') {
        spotifyResults = await spotify.searchSpotifyTracks(query, 10);
        if (!spotifyResults.length) {
          return interaction.editReply({
            content: '❌ No results found! Try a different search term.',
            ephemeral: true,
          });
        }
      } else {
        search = await player.search({ query, source });
        if (!search?.tracks?.length) {
          return interaction.editReply({
            content: '❌ No results found! Try a different search term.',
            ephemeral: true,
          });
        }
      }

      const tracks = source === 'spsearch' ? spotifyResults : search.tracks.slice(0, 10);

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('search_select')
        .setPlaceholder('Select a song to add to the queue')
        .addOptions(
          tracks.map((track, index) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(
                source === 'spsearch'
                  ? `${index + 1}. ${track.name.slice(0, 95)}`
                  : `${index + 1}. ${track.info.title.slice(0, 95)}`
              )
              .setDescription(
                source === 'spsearch'
                  ? `${track.artists.map((a) => a.name).join(', ')} • ${formatTime(track.duration_ms)}`
                  : `By ${track.info.author} • ${formatTime(track.info.duration)}`
              )
              .setValue(
                source === 'spsearch' ? track.external_urls.spotify : track.info.uri
              )
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
          `🔍 Found ${tracks.length} results from ${getSourceEmoji(source)} ${getSourceName(source)}\n\n` +
            tracks
              .map((track, index) => {
                if (source === 'spsearch') {
                  return `**${index + 1}.** ${track.name}\n${getSourceEmoji(source)} \`${track.artists.map((a) => a.name).join(', ')}\` • ⌛ \`${formatTime(track.duration_ms)}\``;
                }
                return `**${index + 1}.** [${track.info.title}](${track.info.uri})\n${getSourceEmoji(source)} \`${track.info.author}\` • ⌛ \`${formatTime(track.info.duration)}\``;
              })
              .join('\n\n')
        )
        .setThumbnail(
          source === 'spsearch'
            ? tracks[0]?.album?.images?.[0]?.url
            : tracks[0]?.info?.artworkUrl
        )
        .addFields({
          name: '📝 Instructions',
          value:
            'Select a track from the dropdown menu below\nThis menu will timeout in 30 seconds',
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
        let selectedTrack;
        if (source === 'spsearch') {
          const spotifyLink = spotify.parseSpotifyLink(i.values[0]);
          if (!spotifyLink?.type || spotifyLink.type !== 'track') {
            return i.reply({
              content: '❌ Invalid Spotify selection. Please try again.',
              ephemeral: true,
            });
          }

          const spotifyTrack = await spotify.getSpotifyTrack(spotifyLink.id);
          const trackSearch = await player.search({
            query: spotify.buildSpotifyTrackQuery(spotifyTrack),
            source: 'ytsearch',
          });

          if (!trackSearch?.tracks?.length) {
            return i.reply({
              content:
                '❌ Could not find a playable version for that Spotify track.',
              ephemeral: true,
            });
          }

          selectedTrack = trackSearch.tracks[0];
        } else {
          selectedTrack = search.tracks.find(
            (track) => track.info.uri === i.values[0]
          );
        }

        if (!selectedTrack) {
          return i.reply({
            content: '❌ Track not found! Please try searching again.',
            ephemeral: true,
          });
        }

        try {
          player.requester = interaction.user;
          await player.queue.add(selectedTrack);

          if (!player.playing && !player.paused) {
            await player.play();
          }

          const addedEmbed = new EmbedBuilder()
            .setColor('#DDA0DD')
            .setAuthor({
              name: 'Added to Queue 🎵',
              iconURL: client.user.displayAvatarURL(),
            })
            .setTitle(selectedTrack.info.title)
            .setURL(selectedTrack.info.uri)
            .setThumbnail(selectedTrack.info.artworkUrl)
            .addFields([
              {
                name: '👤 Artist',
                value: `\`${selectedTrack.info.author}\``,
                inline: true,
              },
              {
                name: '⌛ Duration',
                value: `\`${formatTime(selectedTrack.info.duration)}\``,
                inline: true,
              },
              {
                name: '🎧 Position in Queue',
                value: `\`#${player.queue.tracks.length}\``,
                inline: true,
              },
              {
                name: '🎵 Source',
                value: `${getSourceEmoji(source)} \`${getSourceName(source)}\``,
                inline: true,
              },
            ])
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
    } catch (error) {
      console.error('Search command error:', error);
      return interaction.editReply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true,
      });
    }
  },
};

function getSourceEmoji(source) {
  const emojis = {
    ytsearch: '📺',
    ytmsearch: '🎵',
    spsearch: '💚',
    scsearch: '🟠',
    dzsearch: '💿',
  };
  return emojis[source] || '🎵';
}

function getSourceName(source) {
  const names = {
    ytsearch: 'YouTube',
    ytmsearch: 'YouTube Music',
    spsearch: 'Spotify',
    scsearch: 'SoundCloud',
    dzsearch: 'Deezer',
  };
  return names[source] || 'Unknown Source';
}
