const { SlashCommandBuilder } = require('discord.js');
const ytSearch = require('yt-search');
const { addToQueue, getNowPlaying } = require('../../utils/musicPlayer');

const autoplayEnabled = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle autoplay to play recommended tracks when the queue is empty.'),
  async execute(interaction) {
    const nowPlaying = getNowPlaying(interaction.guild.id);

    if (!nowPlaying) {
      return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
    }

    if (!interaction.member.voice.channel) {
      return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
    }

    const guildId = interaction.guild.id;
    const current = autoplayEnabled.get(guildId) || false;
    autoplayEnabled.set(guildId, !current);

    return interaction.reply(`✅ **Autoplay is now ${current ? 'disabled' : 'enabled'}!**`);
  },
};

module.exports.autoplayEnabled = autoplayEnabled;
