const { SlashCommandBuilder } = require('discord.js');
const { getNowPlaying, setLoopMode } = require('../../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )
    ),
  async execute(interaction) {
    const mode = interaction.options.getString('mode');
    const nowPlaying = getNowPlaying(interaction.guild.id);

    if (!nowPlaying) {
      return interaction.reply({ content: 'Nothing is playing!', ephemeral: true });
    }

    setLoopMode(interaction.guild.id, mode);

    interaction.reply(`🔄 Loop mode set to: **${mode}**`);
  },
};
