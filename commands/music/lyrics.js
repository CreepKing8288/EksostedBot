const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getNowPlaying } = require('../../utils/musicPlayer');
const fetch = require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Fetches lyrics for the currently playing song.'),
  async execute(interaction) {
    try {
      await interaction.deferReply();

      const nowPlaying = getNowPlaying(interaction.guild.id);

      if (!nowPlaying) {
        return interaction.editReply('❌ No song is currently playing.');
      }

      const lyricsUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(nowPlaying.artist)}/${encodeURIComponent(nowPlaying.title)}`;
      const response = await fetch(lyricsUrl);

      if (!response.ok) {
        return interaction.editReply({ content: 'Lyrics not found for this track.', ephemeral: true });
      }

      const data = await response.json();
      const lyricsText = data.lyrics;

      if (!lyricsText) {
        return interaction.editReply({ content: 'Lyrics format not supported.', ephemeral: true });
      }

      const paragraphs = lyricsText.split('\n').filter((p) => p.trim() !== '');
      const pages = [];
      for (let i = 0; i < paragraphs.length; i += 16) {
        pages.push(paragraphs.slice(i, i + 16).join('\n\n'));
      }

      let currentPage = 0;

      const createEmbed = (pageIndex) => {
        return new EmbedBuilder()
          .setTitle(`🎶 Lyrics for: ${nowPlaying.title}`)
          .setDescription(pages[pageIndex])
          .setFooter({ text: `Page ${pageIndex + 1}/${pages.length}` })
          .setTimestamp()
          .setColor(0x11806a);
      };

      if (pages.length === 1) {
        return interaction.editReply({ embeds: [createEmbed(0)] });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('previous').setLabel('◀️ Previous').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('next').setLabel('Next ▶️').setStyle(ButtonStyle.Primary)
      );

      const message = await interaction.editReply({ embeds: [createEmbed(currentPage)], components: [row] });

      const collector = message.createMessageComponentCollector({ time: 120000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'These buttons are not for you!', ephemeral: true });
        }

        if (i.customId === 'previous' && currentPage > 0) {
          currentPage--;
        } else if (i.customId === 'next' && currentPage < pages.length - 1) {
          currentPage++;
        }

        await i.update({ embeds: [createEmbed(currentPage)], components: [row] });
      });

      collector.on('end', async () => {
        try {
          await message.edit({ embeds: [createEmbed(currentPage)], components: [] });
        } catch (err) {
          console.error('Failed to remove buttons:', err);
        }
      });
    } catch (e) {
      console.error('Lyrics error:', e);
      return interaction.editReply({ content: 'An error occurred while fetching lyrics.', ephemeral: true });
    }
  },
};
